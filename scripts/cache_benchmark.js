import "dotenv/config";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import autocannon from "autocannon";
import mongoose from "mongoose";
import Redis from "ioredis";

if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
  process.env.RAZORPAY_WEBHOOK_SECRET = "benchmark_webhook_secret";
}

const { default: env } = await import("../src/config/env.js");
const Product = (await import("../src/models/product.model.js")).default;

const PORT = env.PORT;
const CONNECTIONS = 10;
const DURATION_SECONDS = 10;
const PAIRS = 3;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_PATH = path.join(ROOT, "docs", "benchmark.md");

const TARGETS = [
  { name: "unfiltered list", path: "/products/" },
  { name: "Atlas search (name=Phone)", path: "/products/?name=Phone" },
];

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForPort(port, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isPortOpen(port)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Nothing accepted connections on port ${port} within ${timeoutMs}ms`);
}

async function scanDelete(redis, pattern) {
  let cursor = "0";
  let deleted = 0;
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = String(next);
    if (keys.length > 0) {
      await redis.del(...keys);
      deleted += keys.length;
    }
  } while (cursor !== "0");
  return deleted;
}

function percentileNearestRank(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil((p / 100) * sorted.length)));
  return sorted[rank - 1];
}

function runAutocannon(url) {
  return new Promise((resolve, reject) => {
    const samples = [];
    const instance = autocannon(
      {
        url,
        connections: CONNECTIONS,
        duration: DURATION_SECONDS,
        pipelining: 1,
      },
      (err, result) => {
        if (err) reject(err);
        else resolve({ result, samples });
      }
    );
    instance.on("response", (_client, _statusCode, _resBytes, responseTime) => {
      samples.push(responseTime);
    });
  });
}

function probeXCache(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      {
        hostname: "127.0.0.1",
        port: PORT,
        path: urlPath,
        headers: { Accept: "application/json" },
      },
      (res) => {
        res.resume();
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            xCache: res.headers["x-cache"] || null,
          });
        });
      }
    );
    req.on("error", reject);
  });
}

function avg(numbers) {
  if (numbers.length === 0) return null;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

function fmt(n, digits = 2) {
  return Number(n).toFixed(digits);
}

function summarize(runs) {
  return {
    avgLatencyMs: avg(runs.map((r) => r.avgLatencyMs)),
    p95LatencyMs: avg(runs.map((r) => r.p95LatencyMs)),
    reqPerSec: avg(runs.map((r) => r.reqPerSec)),
  };
}

async function main() {
  let startedServer = false;
  let child = null;

  if (!(await isPortOpen(PORT))) {
    child = spawn(process.execPath, ["src/server.js"], {
      cwd: ROOT,
      env: {
        ...process.env,
        RAZORPAY_WEBHOOK_SECRET:
          process.env.RAZORPAY_WEBHOOK_SECRET || "benchmark_webhook_secret",
        RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || "rzp_test_benchmark",
        RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "benchmark_key_secret",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    startedServer = true;
    let bootLog = "";
    child.stdout.on("data", (chunk) => {
      bootLog += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      bootLog += chunk.toString();
    });
    child.on("exit", (code) => {
      if (startedServer && code && code !== 0) {
        console.error("Server process exited:", code);
        console.error(bootLog.slice(-2000));
      }
    });
    try {
      await waitForPort(PORT, 30000);
    } catch (err) {
      console.error(err.message);
      console.error(bootLog.slice(-2000));
      if (child && !child.killed) child.kill("SIGTERM");
      process.exit(1);
    }
  }

  await mongoose.connect(process.env.MONGODB_URL);
  let productCount = await Product.countDocuments();
  let seedNote = "collection already had products; seeder was not run";

  if (productCount === 0) {
    const actual = path.join(ROOT, "scripts", "seedProducts.js");
    if (!fs.existsSync(actual)) {
      throw new Error("Product collection is empty and scripts/seedProducts.js does not exist");
    }
    await new Promise((resolve, reject) => {
      const seed = spawn(process.execPath, ["scripts/seedProducts.js"], {
        cwd: ROOT,
        env: process.env,
        stdio: "inherit",
      });
      seed.on("exit", (code) =>
        code === 0 ? resolve() : reject(new Error(`seedProducts.js exited ${code}`))
      );
    });
    seedNote = "seeded with node scripts/seedProducts.js because the collection was empty";
    productCount = await Product.countDocuments();
  }

  const redis = new Redis(process.env.REDIS_URL);
  const cpu = os.cpus()[0];
  const specs = {
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    cpu: cpu ? `${cpu.model} × ${os.cpus().length}` : `${os.cpus().length} cores`,
    totalMemoryGiB: (os.totalmem() / 1024 ** 3).toFixed(2),
    node: process.version,
  };

  const urlResults = [];

  for (const target of TARGETS) {
    const url = `http://127.0.0.1:${PORT}${target.path}`;
    const coldRuns = [];
    const warmRuns = [];

    for (let i = 0; i < PAIRS; i++) {
      const deleted = await scanDelete(redis, "cache:products*");
      const afterFlush = await probeXCache(target.path);

      const cold = await runAutocannon(url);
      const afterCold = await probeXCache(target.path);
      coldRuns.push({
        avgLatencyMs: cold.result.latency.average,
        p95LatencyMs: percentileNearestRank(cold.samples, 95),
        reqPerSec: cold.result.requests.average,
        samples: cold.samples.length,
        "2xx": cold.result["2xx"],
        non2xx: cold.result.non2xx,
        errors: cold.result.errors,
        keysDeleted: deleted,
        xCacheAfterFlush: afterFlush.xCache,
        xCacheAfterCold: afterCold.xCache,
      });

      const warm = await runAutocannon(url);
      const afterWarm = await probeXCache(target.path);
      warmRuns.push({
        avgLatencyMs: warm.result.latency.average,
        p95LatencyMs: percentileNearestRank(warm.samples, 95),
        reqPerSec: warm.result.requests.average,
        samples: warm.samples.length,
        "2xx": warm.result["2xx"],
        non2xx: warm.result.non2xx,
        errors: warm.result.errors,
        xCacheAfterWarm: afterWarm.xCache,
      });
    }

    urlResults.push({
      target,
      url,
      coldRuns,
      warmRuns,
      coldAvg: summarize(coldRuns),
      warmAvg: summarize(warmRuns),
    });
  }

  const measuredAt = new Date().toISOString();
  const commands = [
    "node scripts/cache_benchmark.js",
    ...TARGETS.map(
      (t) =>
        `autocannon http://127.0.0.1:${PORT}${t.path} --connections ${CONNECTIONS} --duration ${DURATION_SECONDS}`
    ),
  ];

  let section = `## Cache-hit confirmed run (${measuredAt})

Product count: ${productCount}. ${seedNote}.
Port ${PORT}. Connections ${CONNECTIONS}. Duration ${DURATION_SECONDS}s. Pairs ${PAIRS}.
Server started by this script: ${startedServer ? "yes" : "no (already listening)"}.
Machine: ${specs.platform}. CPU: ${specs.cpu}. Memory: ${specs.totalMemoryGiB} GiB. Node: ${specs.node}.

X-Cache is read from a single GET after flush (expect MISS), after the cold autocannon (expect HIT), and after the warm autocannon (expect HIT).
p95 is nearest-rank on autocannon \`response\` latencies. Avg latency and requests/sec are autocannon means.

`;

  for (const row of urlResults) {
    section += `### ${row.target.name} (\`${row.target.path}\`)

| Cache | Avg latency (ms) | p95 latency (ms) | Requests/sec | Warm X-Cache |
|---|---|---|---|---|
| Cold | ${fmt(row.coldAvg.avgLatencyMs)} | ${fmt(row.coldAvg.p95LatencyMs)} | ${fmt(row.coldAvg.reqPerSec)} | ${row.coldRuns.map((r) => r.xCacheAfterCold).join(", ")} after cold |
| Warm | ${fmt(row.warmAvg.avgLatencyMs)} | ${fmt(row.warmAvg.p95LatencyMs)} | ${fmt(row.warmAvg.reqPerSec)} | ${row.warmRuns.map((r) => r.xCacheAfterWarm).join(", ")} |

Cold per-run:
${row.coldRuns
  .map(
    (r, i) =>
      `- run ${i + 1}: avg ${fmt(r.avgLatencyMs)} ms, p95 ${fmt(r.p95LatencyMs)} ms, ${fmt(r.reqPerSec)} req/s, samples ${r.samples}, 2xx ${r["2xx"]}, non2xx ${r.non2xx}, errors ${r.errors}, SCAN deleted ${r.keysDeleted}, X-Cache after flush ${r.xCacheAfterFlush}, after cold ${r.xCacheAfterCold}`
  )
  .join("\n")}

Warm per-run:
${row.warmRuns
  .map(
    (r, i) =>
      `- run ${i + 1}: avg ${fmt(r.avgLatencyMs)} ms, p95 ${fmt(r.p95LatencyMs)} ms, ${fmt(r.reqPerSec)} req/s, samples ${r.samples}, 2xx ${r["2xx"]}, non2xx ${r.non2xx}, errors ${r.errors}, X-Cache after warm ${r.xCacheAfterWarm}`
  )
  .join("\n")}

`;
  }

  section += `Commands:

\`\`\`bash
${commands.join("\n")}
\`\`\`

Cold: \`SCAN MATCH cache:products* COUNT 100\`, delete matches, then autocannon. Warm: same URL immediately after.

`;

  const previous = fs.existsSync(REPORT_PATH) ? fs.readFileSync(REPORT_PATH, "utf8") : "";
  const next = previous.trimEnd() ? `${previous.trimEnd()}\n\n${section}` : `# Product list cache benchmark\n\n${section}`;
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, next);
  console.log(section);

  await redis.quit();
  await mongoose.disconnect();

  if (startedServer && child && !child.killed) {
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      const t = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 3000);
      child.on("exit", () => {
        clearTimeout(t);
        resolve();
      });
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
