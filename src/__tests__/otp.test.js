import { describe, it, expect, afterAll, beforeAll } from "vitest";
import request from "supertest";
import app from "../app.js";
import prisma from "../config/db.js";
import redis from "../config/redis.js";
import { sendmail } from "../utils/mailer.js";

const OTP_USER = {
  name: "Otp Tester",
  email: `otp_tester_${Date.now()}@test.com`,
  password: "OtpTest@1234",
};

const lastOtpFromMail = () => {
  expect(sendmail).toHaveBeenCalled();
  const payload = sendmail.mock.calls.at(-1)[0];
  const match = payload.text.match(/\b(\d{6})\b/);
  expect(match).not.toBeNull();
  return match[1];
};

beforeAll(async () => {
  sendmail.mockClear();
  const res = await request(app).post("/auth/register").send(OTP_USER);
  expect(res.status).toBe(201);
  expect(res.body.user.isEmailVerified).toBe(false);
});

afterAll(async () => {
  try {
    const email = OTP_USER.email.toLowerCase();
    await redis.del(`otp:${email}`);
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.token.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  } catch (_) {
    // ignore cleanup errors
  }
});

describe("POST /auth/send-otp", () => {
  it("should reject missing email", async () => {
    const res = await request(app).post("/auth/send-otp").send({});
    expect(res.status).toBe(400);
  });

  it("should return the same success message for an unknown email", async () => {
    const callsBefore = sendmail.mock.calls.length;
    const res = await request(app)
      .post("/auth/send-otp")
      .send({ email: `nobody_${Date.now()}@test.com` });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(sendmail.mock.calls.length).toBe(callsBefore);
  });

  it("should send a 6-digit code for an unverified user", async () => {
    sendmail.mockClear();
    const res = await request(app)
      .post("/auth/send-otp")
      .send({ email: OTP_USER.email });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(sendmail).toHaveBeenCalledTimes(1);
    expect(sendmail.mock.calls[0][0].to).toBe(OTP_USER.email.toLowerCase());
    expect(lastOtpFromMail()).toMatch(/^\d{6}$/);
  });
});

describe("POST /auth/verify-otp", () => {
  it("should reject missing fields", async () => {
    const res = await request(app).post("/auth/verify-otp").send({ email: OTP_USER.email });
    expect(res.status).toBe(400);
  });

  it("should reject a wrong OTP", async () => {
    const res = await request(app)
      .post("/auth/verify-otp")
      .send({ email: OTP_USER.email, otp: "000000" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid or Expired Otp");
  });

  it("should verify a valid OTP and allow login", async () => {
    sendmail.mockClear();
    await request(app).post("/auth/send-otp").send({ email: OTP_USER.email });
    const otp = lastOtpFromMail();

    const verify = await request(app)
      .post("/auth/verify-otp")
      .send({ email: OTP_USER.email, otp });

    expect(verify.status).toBe(200);
    expect(verify.body.success).toBe(true);

    const user = await prisma.user.findUnique({
      where: { email: OTP_USER.email.toLowerCase() },
    });
    expect(user.isEmailVerified).toBe(true);

    const stored = await redis.get(`otp:${OTP_USER.email.toLowerCase()}`);
    expect(stored).toBeNull();

    const login = await request(app)
      .post("/auth/login")
      .send({ email: OTP_USER.email, password: OTP_USER.password });

    expect(login.status).toBe(200);
    expect(login.body).toHaveProperty("accessToken");
  });

  it("should reject reusing a consumed OTP", async () => {
    const res = await request(app)
      .post("/auth/verify-otp")
      .send({ email: OTP_USER.email, otp: "123456" });

    expect(res.status).toBe(400);
  });

  it("should not send another OTP after the email is verified", async () => {
    sendmail.mockClear();
    const res = await request(app)
      .post("/auth/send-otp")
      .send({ email: OTP_USER.email });

    expect(res.status).toBe(200);
    expect(sendmail).not.toHaveBeenCalled();
  });
});
