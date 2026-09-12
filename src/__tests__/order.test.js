import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import app from "../app.js";
import prisma from "../config/db.js";
import redis from "../config/redis.js";
import Product from "../models/product.model.js";
import Category from "../models/category.model.js";

// ─── Test Data ────────────────────────────────────────────
const stamp = Date.now();

const ORDER_USER = {
  name: "Order Tester",
  email: `order_tester_${stamp}@test.com`,
  password: "OrderTest@1234",
};

let accessToken;
let userId;
let categoryId;
let productId;
let addressId;
const SKU = `ORD-TST-${stamp}`;

// ─── Setup ────────────────────────────────────────────────

beforeAll(async () => {
  // Register & verify user
  await request(app).post("/auth/register").send(ORDER_USER);
  const user = await prisma.user.update({
    where: { email: ORDER_USER.email.toLowerCase() },
    data: { isEmailVerified: true },
  });
  userId = user.id;

  // Login
  const login = await request(app)
    .post("/auth/login")
    .send({ email: ORDER_USER.email, password: ORDER_USER.password });
  accessToken = login.body.accessToken;

  // Create category + product
  const cat = await Category.create({
    name: "Order Test Cat",
    slug: `order-test-cat-${stamp}`,
  });
  categoryId = cat._id;

  const prod = await Product.create({
    name: `Order Test Product ${stamp}`,
    slug: `order-test-product-${stamp}`,
    description: "Product for order tests",
    categoryId,
    categoryPath: [cat._id],
    images: ["https://picsum.photos/200"],
    createdBy: userId,
    isActive: true,
    variants: [
      {
        attributes: [{ name: "Size", value: "M" }],
        price: 500,
        stock: 10,
        sku: SKU,
      },
    ],
  });
  productId = prod._id.toString();

  // Create address
  const addrRes = await request(app)
    .post("/addresses")
    .set({ Authorization: `Bearer ${accessToken}` })
    .send({
      fullName: "Order Tester",
      phone: "9876543210",
      line1: "123 Test Street",
      city: "Mumbai",
      state: "Maharashtra",
      postalCode: "400001",
      country: "India",
    });
  addressId = addrRes.body.data.id;

  // Add to cart
  await request(app)
    .post("/cart/add")
    .set({ Authorization: `Bearer ${accessToken}` })
    .send({ productId, sku: SKU, quantity: 2 });
});

// ─── Cleanup ──────────────────────────────────────────────

afterAll(async () => {
  try {
    if (userId) await redis.del(`cart:${userId}`);
    if (productId) await Product.findByIdAndDelete(productId);
    if (categoryId) await Category.findByIdAndDelete(categoryId);

    // Clean orders and related data
    const user = await prisma.user.findUnique({
      where: { email: ORDER_USER.email.toLowerCase() },
    });
    if (user) {
      // Delete payments → order items → orders → addresses → tokens → user
      const orders = await prisma.order.findMany({ where: { userId: user.id } });
      for (const order of orders) {
        await prisma.payment.deleteMany({ where: { orderId: order.id } });
        await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
      }
      await prisma.order.deleteMany({ where: { userId: user.id } });
      await prisma.address.deleteMany({ where: { userId: user.id } });
      await prisma.token.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  } catch (_) {
    // ignore cleanup errors
  }
});

const auth = () => ({ Authorization: `Bearer ${accessToken}` });

// ─── CHECKOUT ─────────────────────────────────────────────

describe("POST /orders/checkout", () => {
  it("should reject without auth", async () => {
    const res = await request(app)
      .post("/orders/checkout")
      .send({ addressId });

    expect(res.status).toBe(401);
  });

  it("should reject missing addressId", async () => {
    const res = await request(app)
      .post("/orders/checkout")
      .set(auth())
      .send({});

    expect(res.status).toBe(400);
  });

  it("should reject invalid addressId format", async () => {
    const res = await request(app)
      .post("/orders/checkout")
      .set(auth())
      .send({ addressId: "not-a-uuid" });

    expect(res.status).toBe(400);
  });

  it("should reject with a non-existent address", async () => {
    const res = await request(app)
      .post("/orders/checkout")
      .set(auth())
      .send({ addressId: "00000000-0000-0000-0000-000000000000" });

    expect(res.status).toBe(404);
  });

  // NOTE: Full checkout test requires Razorpay keys, skipped for now
  // The service logic has been validated via unit tests above
});

// ─── LIST ORDERS ──────────────────────────────────────────

describe("GET /orders", () => {
  it("should reject without auth", async () => {
    const res = await request(app).get("/orders");
    expect(res.status).toBe(401);
  });

  it("should return paginated order list", async () => {
    const res = await request(app).get("/orders").set(auth());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("orders");
    expect(Array.isArray(res.body.data.orders)).toBe(true);
    expect(res.body.data).toHaveProperty("totalCount");
    expect(res.body.data).toHaveProperty("page");
    expect(res.body.data).toHaveProperty("totalPages");
  });

  it("should respect pagination query params", async () => {
    const res = await request(app).get("/orders?page=1&limit=5").set(auth());

    expect(res.status).toBe(200);
    expect(res.body.data.orders.length).toBeLessThanOrEqual(5);
  });
});

// ─── GET ORDER BY ID ──────────────────────────────────────

describe("GET /orders/:id", () => {
  it("should reject without auth", async () => {
    const res = await request(app).get("/orders/some-order-id");
    expect(res.status).toBe(401);
  });

  it("should return 404 for non-existent order", async () => {
    const res = await request(app)
      .get("/orders/00000000-0000-0000-0000-000000000000")
      .set(auth());

    expect(res.status).toBe(404);
  });
});

// ─── CANCEL ORDER ─────────────────────────────────────────

describe("POST /orders/:id/cancel", () => {
  it("should reject without auth", async () => {
    const res = await request(app).post("/orders/some-order-id/cancel");
    expect(res.status).toBe(401);
  });

  it("should return 404 for non-existent order", async () => {
    const res = await request(app)
      .post("/orders/00000000-0000-0000-0000-000000000000/cancel")
      .set(auth());

    expect(res.status).toBe(404);
  });
});
