import "dotenv/config";
import { vi, beforeAll, afterAll } from "vitest";
import prisma from "../config/db.js";
import { connectMongoDB } from "../config/mongodb.js";
import mongoose from "mongoose";

// cart.service.js throws at import time if this is missing (CI has no .env)
if (!process.env.CART_EXPIRES) {
  process.env.CART_EXPIRES = "3600";
}

// env.js rejects an empty webhook secret. Set this before the app (and env.js) loads.
if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
  process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret";
}

// Never hit real SMTP in tests. Register and send-otp both call sendmail.
vi.mock("../utils/mailer.js", () => ({
  sendmail: vi.fn().mockResolvedValue(undefined),
}));

beforeAll(async () => {
  await connectMongoDB();
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
  await mongoose.disconnect();
});
