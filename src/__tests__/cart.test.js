import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../app.js";
import prisma from "../config/db.js";
import redis from "../config/redis.js";
import Product from "../models/product.model.js";
import Category from "../models/category.model.js";

const CART_USER = {
  name: "Cart Tester",
  email: `cart_tester_${Date.now()}@test.com`,
  password: "CartTest@1234",
};

const stamp = Date.now();
let accessToken;
let userId;
let categoryId;
let productId;
const SKU_M = `CART-M-${stamp}`;
const SKU_L = `CART-L-${stamp}`;

beforeAll(async () => {
  await request(app).post("/auth/register").send(CART_USER);
  const user = await prisma.user.update({
    where: { email: CART_USER.email.toLowerCase() },
    data: { isEmailVerified: true },
  });
  userId = user.id;

  const login = await request(app)
    .post("/auth/login")
    .send({ email: CART_USER.email, password: CART_USER.password });
  accessToken = login.body.accessToken;

  const category = await Category.create({
    name: "Cart Test Cat",
    slug: `cart-test-cat-${stamp}`,
  });
  categoryId = category._id;

  const product = await Product.create({
    name: `Cart Test Product ${stamp}`,
    slug: `cart-test-product-${stamp}`,
    description: "Used only in cart tests",
    categoryId,
    categoryPath: [category._id],
    images: ["https://picsum.photos/200"],
    createdBy: userId,
    isActive: true,
    variants: [
      {
        attributes: [{ name: "Size", value: "M" }],
        price: 100,
        stock: 5,
        sku: SKU_M,
      },
      {
        attributes: [{ name: "Size", value: "L" }],
        price: 150,
        stock: 2,
        sku: SKU_L,
      },
    ],
  });
  productId = product._id.toString();
});

afterAll(async () => {
  try {
    if (userId) await redis.del(`cart:${userId}`);
    if (productId) await Product.findByIdAndDelete(productId);
    if (categoryId) await Category.findByIdAndDelete(categoryId);
    const user = await prisma.user.findUnique({
      where: { email: CART_USER.email.toLowerCase() },
    });
    if (user) {
      await prisma.token.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  } catch (_) {
    // ignore cleanup errors
  }
});

const auth = () => ({ Authorization: `Bearer ${accessToken}` });

describe("POST /cart/add", () => {
  it("should reject without a token", async () => {
    const res = await request(app)
      .post("/cart/add")
      .send({ productId, sku: SKU_M, quantity: 1 });

    expect(res.status).toBe(401);
  });

  it("should reject missing fields", async () => {
    const res = await request(app).post("/cart/add").set(auth()).send({ productId });

    expect(res.status).toBe(400);
  });

  it("should reject quantity of 0", async () => {
    const res = await request(app)
      .post("/cart/add")
      .set(auth())
      .send({ productId, sku: SKU_M, quantity: 0 });

    expect(res.status).toBe(400);
  });

  it("should reject an unknown product", async () => {
    const res = await request(app)
      .post("/cart/add")
      .set(auth())
      .send({ productId: "000000000000000000000000", sku: SKU_M, quantity: 1 });

    expect(res.status).toBe(404);
  });

  it("should reject an unknown variant sku", async () => {
    const res = await request(app)
      .post("/cart/add")
      .set(auth())
      .send({ productId, sku: "NO-SUCH-SKU", quantity: 1 });

    expect(res.status).toBe(404);
  });

  it("should add an item to the cart", async () => {
    const res = await request(app)
      .post("/cart/add")
      .set(auth())
      .send({ productId, sku: SKU_M, quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.item.sku).toBe(SKU_M);
    expect(res.body.item.quantity).toBe(2);
    expect(res.body.item.price).toBe(100);
  });

  it("should increment quantity when the same variant is added again", async () => {
    const res = await request(app)
      .post("/cart/add")
      .set(auth())
      .send({ productId, sku: SKU_M, quantity: 1 });

    expect(res.status).toBe(200);
    expect(res.body.item.quantity).toBe(3);
  });

  it("should reject adding more than remaining stock", async () => {
    const res = await request(app)
      .post("/cart/add")
      .set(auth())
      .send({ productId, sku: SKU_M, quantity: 10 });

    expect(res.status).toBe(400);
  });
});

describe("GET /cart", () => {
  it("should reject without a token", async () => {
    const res = await request(app).get("/cart");
    expect(res.status).toBe(401);
  });

  it("should return items, itemCount and subtotal", async () => {
    const res = await request(app).get("/cart").set(auth());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.itemCount).toBe(3);
    expect(res.body.data.subtotal).toBe(300);
  });
});

describe("DELETE /cart/item/:productId/:sku", () => {
  it("should reject without a token", async () => {
    const res = await request(app).delete(`/cart/item/${productId}/${SKU_M}`);
    expect(res.status).toBe(401);
  });

  it("should return 404 when the item is not in the cart", async () => {
    const res = await request(app)
      .delete(`/cart/item/${productId}/${SKU_L}`)
      .set(auth());

    expect(res.status).toBe(404);
  });

  it("should remove one item and return the leftover cart", async () => {
    await request(app)
      .post("/cart/add")
      .set(auth())
      .send({ productId, sku: SKU_L, quantity: 1 });

    const res = await request(app)
      .delete(`/cart/item/${productId}/${SKU_M}`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].sku).toBe(SKU_L);
    expect(res.body.data.itemCount).toBe(1);
    expect(res.body.data.subtotal).toBe(150);
  });
});

describe("DELETE /cart", () => {
  it("should reject without a token", async () => {
    const res = await request(app).delete("/cart");
    expect(res.status).toBe(401);
  });

  it("should clear the cart", async () => {
    const res = await request(app).delete("/cart").set(auth());

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
    expect(res.body.data.itemCount).toBe(0);
    expect(res.body.data.subtotal).toBe(0);
  });

  it("should return an empty cart when already empty", async () => {
    const res = await request(app).delete("/cart").set(auth());

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });
});
