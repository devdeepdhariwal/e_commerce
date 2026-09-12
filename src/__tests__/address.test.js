import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../app.js";
import prisma from "../config/db.js";

// ─── Test Data ────────────────────────────────────────────
const stamp = Date.now();

const ADDR_USER = {
  name: "Address Tester",
  email: `addr_tester_${stamp}@test.com`,
  password: "AddrTest@1234",
};

let accessToken;
let userId;
let createdAddressId;

// ─── Setup ────────────────────────────────────────────────

beforeAll(async () => {
  await request(app).post("/auth/register").send(ADDR_USER);
  const user = await prisma.user.update({
    where: { email: ADDR_USER.email.toLowerCase() },
    data: { isEmailVerified: true },
  });
  userId = user.id;

  const login = await request(app)
    .post("/auth/login")
    .send({ email: ADDR_USER.email, password: ADDR_USER.password });
  accessToken = login.body.accessToken;
});

// ─── Cleanup ──────────────────────────────────────────────

afterAll(async () => {
  try {
    const user = await prisma.user.findUnique({
      where: { email: ADDR_USER.email.toLowerCase() },
    });
    if (user) {
      await prisma.address.deleteMany({ where: { userId: user.id } });
      await prisma.token.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  } catch (_) {
    // ignore cleanup errors
  }
});

const auth = () => ({ Authorization: `Bearer ${accessToken}` });

// ─── CREATE ADDRESS ───────────────────────────────────────

describe("POST /addresses", () => {
  it("should reject without auth", async () => {
    const res = await request(app).post("/addresses").send({
      fullName: "Test User",
      phone: "9876543210",
      line1: "123 Street",
      city: "Delhi",
      state: "Delhi",
      postalCode: "110001",
      country: "India",
    });

    expect(res.status).toBe(401);
  });

  it("should reject missing required fields (Zod)", async () => {
    const res = await request(app)
      .post("/addresses")
      .set(auth())
      .send({ fullName: "Test" }); // missing phone, line1, city, state, postalCode, country

    expect(res.status).toBe(400);
    expect(res.body.message).toBeTruthy();
  });

  it("should reject empty fullName", async () => {
    const res = await request(app)
      .post("/addresses")
      .set(auth())
      .send({
        fullName: "",
        phone: "9876543210",
        line1: "123 Street",
        city: "Delhi",
        state: "Delhi",
        postalCode: "110001",
        country: "India",
      });

    expect(res.status).toBe(400);
  });

  it("should create a valid address", async () => {
    const res = await request(app)
      .post("/addresses")
      .set(auth())
      .send({
        fullName: "Address Tester",
        phone: "9876543210",
        line1: "456 Test Lane",
        line2: "Floor 2",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "India",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("id");
    expect(res.body.data.fullName).toBe("Address Tester");
    expect(res.body.data.city).toBe("Mumbai");
    createdAddressId = res.body.data.id;
  });

  it("should create address without optional line2", async () => {
    const res = await request(app)
      .post("/addresses")
      .set(auth())
      .send({
        fullName: "No Line2 User",
        phone: "1234567890",
        line1: "789 Main Road",
        city: "Bangalore",
        state: "Karnataka",
        postalCode: "560001",
        country: "India",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});

// ─── GET ADDRESSES ────────────────────────────────────────

describe("GET /addresses", () => {
  it("should reject without auth", async () => {
    const res = await request(app).get("/addresses");
    expect(res.status).toBe(401);
  });

  it("should return the user's addresses", async () => {
    const res = await request(app).get("/addresses").set(auth());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });
});
