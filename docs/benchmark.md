# Product list cache benchmark

Measured 2026-10-11T07:30:00.876Z against `http://127.0.0.1:3000/products/`.

## Setup

| Item | Value |
|---|---|
| Seeded product count | 90 |
| Seed | collection already had products; seeder was not run |
| Port | 3000 (from env/config, default 3000) |
| Connections | 10 |
| Duration per run | 10s |
| Pairs | 3 cold/warm |
| Server started by this script | yes |
| Machine | linux 7.1.5-arch1-2 x64 |
| CPU | 11th Gen Intel(R) Core(TM) i5-11260H @ 2.60GHz × 12 |
| Memory | 15.34 GiB |
| Node | v26.5.0 |

p95 is nearest-rank on per-request latencies collected from autocannon `response` events. Average latency and requests/sec are autocannon's reported means.

## Averages of 3 runs

| Cache | Avg latency (ms) | p95 latency (ms) | Requests/sec |
|---|---|---|---|
| Cold | 57.87 | 77.47 | 171.20 |
| Warm | 60.78 | 109.72 | 163.34 |

## Per-run results

### Cold

- run 1: avg 60.18 ms, p95 78.58 ms, 164.30 req/s, samples 1643, 2xx 1643, non2xx 0, errors 0, SCAN deleted 0 keys
- run 2: avg 59.12 ms, p95 88.94 ms, 167.40 req/s, samples 1674, 2xx 1674, non2xx 0, errors 0, SCAN deleted 1 keys
- run 3: avg 54.32 ms, p95 64.89 ms, 181.90 req/s, samples 1819, 2xx 1819, non2xx 0, errors 0, SCAN deleted 1 keys

### Warm

- run 1: avg 57.87 ms, p95 73.88 ms, 170.70 req/s, samples 1707, 2xx 1707, non2xx 0, errors 0
- run 2: avg 57.99 ms, p95 86.51 ms, 170.50 req/s, samples 1705, 2xx 1705, non2xx 0, errors 0
- run 3: avg 66.49 ms, p95 168.76 ms, 148.82 req/s, samples 1637, 2xx 1637, non2xx 0, errors 0

## Exact commands

```bash
node scripts/cache_benchmark.js
autocannon http://127.0.0.1:3000/products/ --connections 10 --duration 10
```

Cold cache: `SCAN MATCH cache:products* COUNT 100` then delete matches, then the autocannon settings above. Warm cache: the same URL immediately after, same settings.

## Cache-hit confirmed run (2026-10-11T07:47:37.978Z)

Product count: 90. collection already had products; seeder was not run.
Port 3000. Connections 10. Duration 10s. Pairs 3.
Server started by this script: no (already listening).
Machine: linux 7.1.5-arch1-2 x64. CPU: 11th Gen Intel(R) Core(TM) i5-11260H @ 2.60GHz × 12. Memory: 15.34 GiB. Node: v26.5.0.

X-Cache is read from a single GET after flush (expect MISS), after the cold autocannon (expect HIT), and after the warm autocannon (expect HIT).
p95 is nearest-rank on autocannon `response` latencies. Avg latency and requests/sec are autocannon means.

### unfiltered list (`/products/`)

| Cache | Avg latency (ms) | p95 latency (ms) | Requests/sec | Warm X-Cache |
|---|---|---|---|---|
| Cold | 57.84 | 69.53 | 171.23 | HIT, HIT, HIT after cold |
| Warm | 57.97 | 92.96 | 171.19 | HIT, HIT, HIT |

Cold per-run:
- run 1: avg 56.90 ms, p95 70.02 ms, 173.80 req/s, samples 1738, 2xx 1738, non2xx 0, errors 0, SCAN deleted 4, X-Cache after flush MISS, after cold HIT
- run 2: avg 61.16 ms, p95 71.06 ms, 161.50 req/s, samples 1615, 2xx 1615, non2xx 0, errors 0, SCAN deleted 1, X-Cache after flush MISS, after cold HIT
- run 3: avg 55.46 ms, p95 67.50 ms, 178.40 req/s, samples 1784, 2xx 1784, non2xx 0, errors 0, SCAN deleted 1, X-Cache after flush MISS, after cold HIT

Warm per-run:
- run 1: avg 63.24 ms, p95 142.77 ms, 156.46 req/s, samples 1721, 2xx 1721, non2xx 0, errors 0, X-Cache after warm HIT
- run 2: avg 55.07 ms, p95 66.38 ms, 179.30 req/s, samples 1793, 2xx 1793, non2xx 0, errors 0, X-Cache after warm HIT
- run 3: avg 55.60 ms, p95 69.72 ms, 177.82 req/s, samples 1956, 2xx 1956, non2xx 0, errors 0, X-Cache after warm HIT

### Atlas search (name=Phone) (`/products/?name=Phone`)

| Cache | Avg latency (ms) | p95 latency (ms) | Requests/sec | Warm X-Cache |
|---|---|---|---|---|
| Cold | 51.34 | 61.74 | 192.30 | HIT, HIT, HIT after cold |
| Warm | 56.61 | 104.74 | 176.13 | HIT, HIT, HIT |

Cold per-run:
- run 1: avg 52.08 ms, p95 63.54 ms, 189.60 req/s, samples 1896, 2xx 1896, non2xx 0, errors 0, SCAN deleted 1, X-Cache after flush MISS, after cold HIT
- run 2: avg 50.52 ms, p95 59.94 ms, 195.30 req/s, samples 1953, 2xx 1953, non2xx 0, errors 0, SCAN deleted 1, X-Cache after flush MISS, after cold HIT
- run 3: avg 51.43 ms, p95 61.75 ms, 192.00 req/s, samples 1920, 2xx 1920, non2xx 0, errors 0, SCAN deleted 1, X-Cache after flush MISS, after cold HIT

Warm per-run:
- run 1: avg 51.42 ms, p95 60.72 ms, 192.20 req/s, samples 1922, 2xx 1922, non2xx 0, errors 0, X-Cache after warm HIT
- run 2: avg 64.07 ms, p95 170.37 ms, 154.50 req/s, samples 1545, 2xx 1545, non2xx 0, errors 0, X-Cache after warm HIT
- run 3: avg 54.33 ms, p95 83.13 ms, 181.70 req/s, samples 1817, 2xx 1817, non2xx 0, errors 0, X-Cache after warm HIT

Commands:

```bash
node scripts/cache_benchmark.js
autocannon http://127.0.0.1:3000/products/ --connections 10 --duration 10
autocannon http://127.0.0.1:3000/products/?name=Phone --connections 10 --duration 10
```

Cold: `SCAN MATCH cache:products* COUNT 100`, delete matches, then autocannon. Warm: same URL immediately after.

