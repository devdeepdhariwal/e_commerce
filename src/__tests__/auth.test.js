import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../app.js";
import prisma from "../config/db.js";

const TEST_USER = {
  name: "Test User",
  email: `testuser_${Date.now()}@test.com`,
  password: "Test@1234",
};

let accessToken;
let refreshCookie;

// Helper: set-cookie can be a string or array depending on Express/supertest version
const parseCookies = (res) => {
  const raw = res.headers["set-cookie"];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
};

// Clean up test user after all tests
afterAll(async () => {
  try {
    const user = await prisma.user.findUnique({
      where: { email: TEST_USER.email.toLowerCase() },
    });
    if (user) {
      await prisma.token.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  } catch (_) {
    // Ignore cleanup errors
  }
});

// ─── REGISTER ────────────────────────────────────────────

describe("POST /auth/register", () => {
  it("should register a new user", async () => {
    const res = await request(app).post("/auth/register").send(TEST_USER);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("User registered successfully");
    expect(res.body.user).toHaveProperty("id");
    expect(res.body.user.email).toBe(TEST_USER.email.toLowerCase());
    expect(res.body.user.isEmailVerified).toBe(false);
  });

  it("should reject registration with missing fields", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "incomplete@test.com" });

    expect(res.status).toBe(400);
  });

  it("should reject weak passwords", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ name: "Weak", email: "weak@test.com", password: "123" });

    expect(res.status).toBe(400);
  });

  it("should reject duplicate email", async () => {
    const res = await request(app).post("/auth/register").send(TEST_USER);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("User Already Exists");
  });
});

// ─── LOGIN ───────────────────────────────────────────────

describe("POST /auth/login", () => {
  it("should reject login when email is not verified", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Please verify your email");
  });

  it("should login and return accessToken + set cookie", async () => {
    await prisma.user.update({
      where: { email: TEST_USER.email.toLowerCase() },
      data: { isEmailVerified: true },
    });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body.message).toBe("Login successful");

    // Check refreshToken cookie is set
    const cookies = parseCookies(res);
    expect(cookies.length).toBeGreaterThan(0);
    expect(cookies.some((c) => c.startsWith("refreshToken="))).toBe(true);

    // Save for subsequent tests
    accessToken = res.body.accessToken;
    refreshCookie = cookies.find((c) => c.startsWith("refreshToken="));
  });

  it("should reject login with wrong password", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: TEST_USER.email, password: "WrongPass@1" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid Credentials");
  });

  it("should reject login with non-existent email", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "nobody@test.com", password: "Test@1234" });

    expect(res.status).toBe(401);
  });

  it("should reject login with missing fields", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: TEST_USER.email });

    expect(res.status).toBe(400);
  });
});

// ─── GET ME ──────────────────────────────────────────────

describe("GET /auth/me", () => {
  it("should return current user with valid token", async () => {
    const res = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty("id");
    expect(res.body.user.email).toBe(TEST_USER.email.toLowerCase());
    expect(res.body.user).toHaveProperty("role");
    expect(res.body.user).not.toHaveProperty("password");
  });

  it("should reject request without token", async () => {
    const res = await request(app).get("/auth/me");

    expect(res.status).toBe(401);
  });

  it("should reject request with invalid token", async () => {
    const res = await request(app)
      .get("/auth/me")
      .set("Authorization", "Bearer invalidtoken123");

    expect(res.status).toBe(401);
  });
});

// ─── REFRESH TOKEN ───────────────────────────────────────

describe("POST /auth/refresh-token", () => {
  let oldRefreshCookie;

  it("should rotate tokens and return new accessToken", async () => {
    // Save the old cookie before consuming it
    oldRefreshCookie = refreshCookie;

    const res = await request(app)
      .post("/auth/refresh-token")
      .set("Cookie", refreshCookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");

    // New cookie should be set
    const cookies = parseCookies(res);
    expect(cookies.length).toBeGreaterThan(0);

    // Update tokens for subsequent tests
    accessToken = res.body.accessToken;
    refreshCookie = cookies.find((c) => c.startsWith("refreshToken="));
  });

  it("should reject refresh without cookie", async () => {
    const res = await request(app).post("/auth/refresh-token");

    expect(res.status).toBe(401);
  });

  it("should reject reuse of old refresh token (rotation)", async () => {
    // The old cookie was already consumed in the first test — reusing it should fail
    const res = await request(app)
      .post("/auth/refresh-token")
      .set("Cookie", oldRefreshCookie);

    expect(res.status).toBe(401);
  });
});

// ─── LOGOUT ──────────────────────────────────────────────

describe("POST /auth/logout", () => {
  it("should logout successfully", async () => {
    const res = await request(app)
      .post("/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Cookie", refreshCookie);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Logged out successfully");
  });

  it("should reject using blacklisted access token after logout", async () => {
    const res = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(401);
  });
});
