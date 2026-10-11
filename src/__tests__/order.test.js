import crypto from "crypto";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import app from "../app.js";
import prisma from "../config/db.js";
import redis from "../config/redis.js";
import Product from "../models/product.model.js";
import Category from "../models/category.model.js";

vi.mock("../config/razorpay.js", () => {
  let seq = 0;
  return {
    default: {
      orders: {
        create: vi.fn(async () => {
          seq += 1;
          return { id: `order_mock_${Date.now()}_${seq}` };
        }),
      },
    },
  };
});

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

async function setStock(stock) {
  await Product.updateOne(
    { _id: productId, "variants.sku": SKU },
    { $set: { "variants.$.stock": stock } }
  );
}

async function stockOf() {
  const prod = await Product.findById(productId);
  return prod.variants.find((variant) => variant.sku === SKU).stock;
}

async function ensureCart(quantity = 2) {
  await redis.del(`cart:${userId}`);
  const res = await request(app)
    .post("/cart/add")
    .set(auth())
    .send({ productId, sku: SKU, quantity });
  expect(res.status).toBe(200);
}

async function cartCount() {
  const res = await request(app).get("/cart").set(auth());
  expect(res.status).toBe(200);
  return res.body.data.itemCount;
}

async function cancelPendingOrders() {
  const pending = await prisma.order.findMany({
    where: { userId, status: "PENDING" },
    select: { id: true },
  });
  for (const order of pending) {
    const res = await request(app).post(`/orders/${order.id}/cancel`).set(auth());
    expect(res.status).toBe(200);
  }
}

function checkout() {
  return request(app).post("/orders/checkout").set(auth()).send({ addressId });
}

function postWebhook(event, { eventId } = {}) {
  const raw = JSON.stringify(event);
  const signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(raw)
    .digest("hex");
  const req = request(app)
    .post("/webhooks/razorpay")
    .set("Content-Type", "application/json")
    .set("x-razorpay-signature", signature);
  if (eventId) {
    req.set("x-razorpay-event-id", eventId);
  }
  return req.send(raw);
}

describe("POST /orders/:id/cancel concurrency", () => {
  it("restores stock once when two cancels race", async () => {
    await cancelPendingOrders();
    await setStock(10);
    await ensureCart(2);

    const created = await checkout();
    expect(created.status).toBe(201);
    expect(await stockOf()).toBe(8);

    const orderId = created.body.data.orderId;
    const [first, second] = await Promise.all([
      request(app).post(`/orders/${orderId}/cancel`).set(auth()),
      request(app).post(`/orders/${orderId}/cancel`).set(auth()),
    ]);

    const statuses = [first.status, second.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 400]);
    expect(await stockOf()).toBe(10);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });
    expect(order.status).toBe("CANCELLED");
    expect(order.payment.status).toBe("FAILED");
  });
});

describe("payment.captured on a non-pending order", () => {
  it("leaves a CANCELLED order cancelled and does not change stock", async () => {
    await cancelPendingOrders();
    await setStock(10);
    await ensureCart(2);

    const created = await checkout();
    expect(created.status).toBe(201);
    const orderId = created.body.data.orderId;

    const cancel = await request(app).post(`/orders/${orderId}/cancel`).set(auth());
    expect(cancel.status).toBe(200);
    const stockAfterCancel = await stockOf();

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    const res = await postWebhook({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: `pay_late_${orderId}`,
            order_id: order.razorpayOrderId,
          },
        },
      },
    });
    expect(res.status).toBe(200);

    const after = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });
    expect(after.status).toBe("CANCELLED");
    expect(after.payment.status).not.toBe("CAPTURED");
    expect(await stockOf()).toBe(stockAfterCancel);
  });
});

describe("payment.failed webhook", () => {
  it("marks the order failed, updates payment, and restores stock once", async () => {
    await cancelPendingOrders();
    await setStock(10);
    await ensureCart(2);

    const created = await checkout();
    expect(created.status).toBe(201);
    expect(await stockOf()).toBe(8);

    const order = await prisma.order.findUnique({
      where: { id: created.body.data.orderId },
    });
    const event = {
      event: "payment.failed",
      payload: {
        payment: {
          entity: {
            id: `pay_fail_once_${order.id}`,
            order_id: order.razorpayOrderId,
          },
        },
      },
    };
    const eventId = `evt_fail_once_${order.id}`;

    const first = await postWebhook(event, { eventId });
    expect(first.status).toBe(200);

    const after = await prisma.order.findUnique({
      where: { id: order.id },
      include: { payment: true },
    });
    expect(after.status).toBe("FAILED");
    expect(after.payment.status).toBe("FAILED");
    expect(after.payment.razorpayPaymentId).toBe(`pay_fail_once_${order.id}`);
    expect(await stockOf()).toBe(10);

    const second = await postWebhook(event, { eventId });
    expect(second.status).toBe(200);
    expect(await stockOf()).toBe(10);

    const still = await prisma.order.findUnique({
      where: { id: order.id },
      include: { payment: true },
    });
    expect(still.status).toBe("FAILED");
    expect(still.payment.status).toBe("FAILED");
  });
});

describe("webhook event deduplication", () => {
  it("processes the same event only once", async () => {
    await cancelPendingOrders();
    await setStock(10);
    await ensureCart(2);

    const created = await checkout();
    expect(created.status).toBe(201);
    const orderId = created.body.data.orderId;
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    const eventId = `evt_dedup_${orderId}`;
    const event = {
      event: "payment.failed",
      payload: {
        payment: {
          entity: {
            id: `pay_dedup_${orderId}`,
            order_id: order.razorpayOrderId,
          },
        },
      },
    };

    const first = await postWebhook(event, { eventId });
    expect(first.status).toBe(200);
    expect((await prisma.order.findUnique({ where: { id: orderId } })).status).toBe("FAILED");
    expect(await stockOf()).toBe(10);

    // Make the order processable again without clearing the dedupe key.
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "PENDING" },
    });
    await prisma.payment.update({
      where: { orderId },
      data: { status: "CREATED", razorpayPaymentId: null },
    });
    await setStock(8);

    const second = await postWebhook(event, { eventId });
    expect(second.status).toBe(200);
    expect((await prisma.order.findUnique({ where: { id: orderId } })).status).toBe("PENDING");
    expect(await stockOf()).toBe(8);
  });
});

describe("pending order guard", () => {
  it("rejects a second checkout while an order is PENDING and deducts stock once", async () => {
    await cancelPendingOrders();
    await setStock(10);
    await ensureCart(2);

    const first = await checkout();
    expect(first.status).toBe(201);
    // The request released its own lock; a later checkout is not blocked by it.
    expect(await redis.get(`checkout_lock:${userId}`)).toBeNull();
    const stockAfterFirst = await stockOf();
    expect(stockAfterFirst).toBe(8);

    const second = await checkout();
    expect(second.status).toBe(409);
    expect(second.body.message).toContain(first.body.data.orderId);
    expect(await stockOf()).toBe(stockAfterFirst);
  });

  it("allows checkout again after the pending order is cancelled", async () => {
    const pending = await prisma.order.findFirst({
      where: { userId, status: "PENDING" },
      select: { id: true },
    });
    expect(pending).toBeTruthy();

    const stockWhilePending = await stockOf();
    const cancel = await request(app)
      .post(`/orders/${pending.id}/cancel`)
      .set(auth());
    expect(cancel.status).toBe(200);
    expect(await stockOf()).toBe(stockWhilePending + 2);

    await ensureCart(2);
    const again = await checkout();
    expect(again.status).toBe(201);
    expect(await stockOf()).toBe(stockWhilePending);
  });

  it("keeps the cart until payment.captured", async () => {
    await cancelPendingOrders();
    await setStock(10);
    await ensureCart(2);

    const created = await checkout();
    expect(created.status).toBe(201);
    expect(await cartCount()).toBe(2);
    expect(await stockOf()).toBe(8);

    const pending = await prisma.order.findUnique({
      where: { id: created.body.data.orderId },
    });
    const failed = await postWebhook({
      event: "payment.failed",
      payload: {
        payment: {
          entity: { id: `pay_fail_${pending.id}`, order_id: pending.razorpayOrderId },
        },
      },
    });
    expect(failed.status).toBe(200);
    expect(await cartCount()).toBe(2);
    expect(await stockOf()).toBe(10);

    const failedOrder = await prisma.order.findUnique({
      where: { id: pending.id },
    });
    expect(failedOrder.status).toBe("FAILED");

    const next = await checkout();
    expect(next.status).toBe(201);
    expect(await cartCount()).toBe(2);
    expect(await stockOf()).toBe(8);

    const capturedOrder = await prisma.order.findUnique({
      where: { id: next.body.data.orderId },
    });
    const captured = await postWebhook({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: `pay_cap_${capturedOrder.id}`,
            order_id: capturedOrder.razorpayOrderId,
          },
        },
      },
    });
    expect(captured.status).toBe(200);

    const paid = await prisma.order.findUnique({
      where: { id: capturedOrder.id },
    });
    expect(paid.status).toBe("PAID");
    expect(await cartCount()).toBe(0);
    expect(await stockOf()).toBe(8);
  });
});
