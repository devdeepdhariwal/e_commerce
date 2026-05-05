import "dotenv/config";
import { beforeAll, afterAll } from "vitest";
import prisma from "../config/db.js";
import { connectMongoDB } from "../config/mongodb.js";
import mongoose from "mongoose";

beforeAll(async () => {
  await connectMongoDB();
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
  await mongoose.disconnect();
});
