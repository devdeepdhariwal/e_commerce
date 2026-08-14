import "dotenv/config";
import { vi, beforeAll, afterAll } from "vitest";
import prisma from "../config/db.js";
import { connectMongoDB } from "../config/mongodb.js";
import mongoose from "mongoose";

// cart.service.js throws at import time if this is missing (CI has no .env)
if (!process.env.CART_EXPIRES) {
  process.env.CART_EXPIRES = "3600";
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
