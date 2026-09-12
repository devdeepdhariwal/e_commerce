import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import app from "../app.js";
import prisma from "../config/db.js";
import redis from "../config/redis.js";

// ─── Test Data ────────────────────────────────────────────
const stamp = Date.now();

const RESET_USER = {
  name: "Reset Tester",
  email: `reset_tester_${stamp}@test.com`,
  password: "OldPass@1234",
};

let userId;

// ─── Setup ────────────────────────────────────────────────

beforeAll(async () => {
  await request(app).post("/auth/register").send(RESET_USER);
  const user = await prisma.user.update({
    where: { email: RESET_USER.email.toLowerCase() },
    data: { isEmailVerified: true },
  });
  userId = user.id;
});

// ─── Cleanup ──────────────────────────────────────────────

afterAll(async () => {
  try {
    const email = RESET_USER.email.toLowerCase();
    // Clean up any reset tokens in Redis
    await redis.del(`pwreset:${email}`);

    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.token.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  } catch (_) {
    // ignore cleanup errors
  }
});

// ─── FORGOT PASSWORD ──────────────────────────────────────

describe("POST /auth/forgot-password", () => {
  it("should reject missing email", async () => {
    const res = await request(app).post("/auth/forgot-password").send({});
    expect(res.status).toBe(400);
  });

  it("should reject invalid email format", async () => {
    const res = await request(app)
      .post("/auth/forgot-password")
      .send({ email: "not-an-email" });

    expect(res.status).toBe(400);
  });

  it("should accept a registered email (does not leak info)", async () => {
    const res = await request(app)
      .post("/auth/forgot-password")
      .send({ email: RESET_USER.email });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("password reset");
  });

  it("should accept an unknown email without error (anti-enumeration)", async () => {
    const res = await request(app)
      .post("/auth/forgot-password")
      .send({ email: "nobody@doesnotexist.test" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── RESET PASSWORD ───────────────────────────────────────

describe("POST /auth/reset-password", () => {
  it("should reject missing fields", async () => {
    const res = await request(app).post("/auth/reset-password").send({});
    expect(res.status).toBe(400);
  });

  it("should reject weak new password", async () => {
    const res = await request(app).post("/auth/reset-password").send({
      email: RESET_USER.email,
      token: "fake-token",
      newPassword: "weak",
    });

    expect(res.status).toBe(400);
  });

  it("should reject an invalid/expired token", async () => {
    const res = await request(app).post("/auth/reset-password").send({
      email: RESET_USER.email,
      token: "0000000000000000000000000000000000000000000000000000000000000000",
      newPassword: "NewStrong@1234",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Invalid or expired");
  });

  it("should reset password with a valid token", async () => {
    // Trigger forgot-password to generate a token
    await request(app)
      .post("/auth/forgot-password")
      .send({ email: RESET_USER.email });

    // Read the hashed token from Redis (we'll craft a matching one)
    const email = RESET_USER.email.toLowerCase();
    const key = `pwreset:${email}`;
    const storedHash = await redis.get(key);
    expect(storedHash).toBeTruthy();

    // We can't easily recover the raw token from the hash,
    // so let's manually set a known token in Redis for this test
    const crypto = await import("crypto");
    const knownToken = "test-reset-token-1234567890abcdef1234567890abcdef";
    const knownHash = crypto.createHash("sha256").update(knownToken).digest("hex");
    await redis.set(key, knownHash, "EX", 900);

    const newPassword = "NewSecure@5678";
    const res = await request(app).post("/auth/reset-password").send({
      email: RESET_USER.email,
      token: knownToken,
      newPassword,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("reset successfully");

    // Verify old password no longer works
    const oldLogin = await request(app)
      .post("/auth/login")
      .send({ email: RESET_USER.email, password: RESET_USER.password });
    expect(oldLogin.status).toBe(401);

    // Verify new password works
    const newLogin = await request(app)
      .post("/auth/login")
      .send({ email: RESET_USER.email, password: newPassword });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body).toHaveProperty("accessToken");

    // Token should be deleted from Redis after use
    const tokenAfter = await redis.get(key);
    expect(tokenAfter).toBeNull();
  });
});
