import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../app.js";
import prisma from "../config/db.js";
import product from "../models/product.model.js";
import category from "../models/category.model.js";

// ─── Test Data ───────────────────────────────────────────

const ADMIN_USER = {
  name: "Admin Tester",
  email: `admin_tester_${Date.now()}@test.com`,
  password: "Admin@1234",
};

const REGULAR_USER = {
  name: "Regular Tester",
  email: `regular_tester_${Date.now()}@test.com`,
  password: "Regular@1234",
};

let TEST_PRODUCT = {
  name: `Test Product ${Date.now()}`,
  description: "A test product for integration tests",
  price: 999,
  images: ["https://picsum.photos/400/400"],
  attributes: [{ key: "size", value: "M" }, { key: "color", value: "Black" }],
};

let adminToken;
let regularToken;
let createdProductId;
let createdProductSlug;
let testCategoryId;
let testCategorySlug;

// ─── Setup: Register users, promote one to ADMIN ────────

beforeAll(async () => {
  // Create test category
  const testCategory = await category.create({
    name: "T-Shirts",
    slug: "t-shirts-" + Date.now(),
  });
  testCategoryId = testCategory._id;
  testCategorySlug = testCategory.slug;
  TEST_PRODUCT.categoryId = testCategoryId;

  // Register admin user
  await request(app).post("/auth/register").send(ADMIN_USER);

  // Promote to ADMIN directly in DB
  await prisma.user.update({
    where: { email: ADMIN_USER.email.toLowerCase() },
    data: { role: "ADMIN" },
  });

  // Login as admin
  const adminLogin = await request(app)
    .post("/auth/login")
    .send({ email: ADMIN_USER.email, password: ADMIN_USER.password });
  adminToken = adminLogin.body.accessToken;

  // Register and login as regular user
  await request(app).post("/auth/register").send(REGULAR_USER);
  const regularLogin = await request(app)
    .post("/auth/login")
    .send({ email: REGULAR_USER.email, password: REGULAR_USER.password });
  regularToken = regularLogin.body.accessToken;
});

// ─── Cleanup: Remove test data ──────────────────────────

afterAll(async () => {
  try {
    // Delete test product and category from MongoDB
    if (createdProductId) {
      await product.findByIdAndDelete(createdProductId);
    }
    if (testCategoryId) {
      await category.findByIdAndDelete(testCategoryId);
    }

    // Delete test users from PostgreSQL (cascade deletes tokens)
    for (const email of [ADMIN_USER.email, REGULAR_USER.email]) {
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });
      if (user) {
        await prisma.user.delete({ where: { id: user.id } });
      }
    }
  } catch (_) {
    // Ignore cleanup errors
  }
});

// ─── CREATE PRODUCT ──────────────────────────────────────

describe("POST /products/", () => {
  it("should create a product as ADMIN", async () => {
    const res = await request(app)
      .post("/products/")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(TEST_PRODUCT);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Product created successfully");
    expect(res.body.product).toHaveProperty("_id");
    expect(res.body.product.name).toBe(TEST_PRODUCT.name);
    expect(res.body.product).toHaveProperty("slug");
    expect(res.body.product.price).toBe(TEST_PRODUCT.price);

    createdProductId = res.body.product._id;
    createdProductSlug = res.body.product.slug;
  });

  it("should reject product creation without auth", async () => {
    const res = await request(app).post("/products/").send(TEST_PRODUCT);

    expect(res.status).toBe(401);
  });

  it("should reject product creation as CUSTOMER", async () => {
    const res = await request(app)
      .post("/products/")
      .set("Authorization", `Bearer ${regularToken}`)
      .send(TEST_PRODUCT);

    expect(res.status).toBe(403);
  });

  it("should reject product with missing required fields", async () => {
    const res = await request(app)
      .post("/products/")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Incomplete Product" });

    expect(res.status).toBe(400);
  });

  it("should reject duplicate slug", async () => {
    const res = await request(app)
      .post("/products/")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(TEST_PRODUCT);

    expect(res.status).toBe(409);
  });
});

// ─── GET PRODUCTS (LIST) ────────────────────────────────

describe("GET /products/", () => {
  it("should return paginated product list", async () => {
    const res = await request(app).get("/products/");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty("data");
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty("pagination");
    expect(res.body.pagination).toHaveProperty("totalPages");
    expect(res.body.pagination).toHaveProperty("hasNextPage");
    expect(res.body.pagination).toHaveProperty("hasPrevPage");
  });

  it("should respect pagination params", async () => {
    const res = await request(app).get("/products/?page=1&limit=5");

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
  });

  it("should filter by category", async () => {
    const res = await request(app).get(`/products/?category=${testCategorySlug}`);

    expect(res.status).toBe(200);
    if (res.body.data.length > 0) {
      res.body.data.forEach((p) => {
        expect(p.categoryId).toBe(testCategoryId.toString());
      });
    }
  });

  it("should filter by price range", async () => {
    const res = await request(app).get("/products/?minPrice=500&maxPrice=2000");

    expect(res.status).toBe(200);
    if (res.body.data.length > 0) {
      res.body.data.forEach((p) => {
        expect(p.price).toBeGreaterThanOrEqual(500);
        expect(p.price).toBeLessThanOrEqual(2000);
      });
    }
  });

  it("should clamp invalid page/limit values", async () => {
    const res = await request(app).get("/products/?page=-1&limit=9999");

    expect(res.status).toBe(200);
    // limit should be clamped to 100
    expect(res.body.data.length).toBeLessThanOrEqual(100);
  });
});

// ─── GET PRODUCT BY SLUG ────────────────────────────────

describe("GET /products/:slug", () => {
  it("should return product by slug", async () => {
    const res = await request(app).get(`/products/${createdProductSlug}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.product.slug).toBe(createdProductSlug);
    expect(res.body.product.name).toBe(TEST_PRODUCT.name);
  });

  it("should return 404 for non-existent slug", async () => {
    const res = await request(app).get("/products/non-existent-slug-xyz");

    expect(res.status).toBe(404);
  });
});

// ─── UPDATE PRODUCT ─────────────────────────────────────

describe("PUT /products/:id", () => {
  it("should update product as ADMIN", async () => {
    const res = await request(app)
      .put(`/products/${createdProductId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ price: 1299 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.product.price).toBe(1299);
    // Name should remain unchanged (partial update)
    expect(res.body.product.name).toBe(TEST_PRODUCT.name);
  });

  it("should reject update as CUSTOMER", async () => {
    const res = await request(app)
      .put(`/products/${createdProductId}`)
      .set("Authorization", `Bearer ${regularToken}`)
      .send({ price: 1 });

    expect(res.status).toBe(403);
  });

  it("should reject update without auth", async () => {
    const res = await request(app)
      .put(`/products/${createdProductId}`)
      .send({ price: 1 });

    expect(res.status).toBe(401);
  });

  it("should return 404 for non-existent product", async () => {
    const res = await request(app)
      .put("/products/000000000000000000000000")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ price: 100 });

    expect(res.status).toBe(404);
  });
});

// ─── DELETE PRODUCT ─────────────────────────────────────

describe("DELETE /products/:id", () => {
  it("should reject delete as CUSTOMER", async () => {
    const res = await request(app)
      .delete(`/products/${createdProductId}`)
      .set("Authorization", `Bearer ${regularToken}`);

    expect(res.status).toBe(403);
  });

  it("should reject delete without auth", async () => {
    const res = await request(app).delete(`/products/${createdProductId}`);

    expect(res.status).toBe(401);
  });

  it("should delete product as ADMIN", async () => {
    const res = await request(app)
      .delete(`/products/${createdProductId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Product deleted Successfully");

    // Mark as deleted so cleanup doesn't try again
    createdProductId = null;
  });

  it("should return 404 when deleting already-deleted product", async () => {
    const res = await request(app)
      .delete("/products/000000000000000000000000")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});
