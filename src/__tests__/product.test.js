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
  images: ["https://picsum.photos/400/400"],
  variants: [
    {
      attributes: [
        { name: "Color", value: "Black" },
        { name: "Size", value: "S" },
      ],
      price: 499,
      stock: 12,
      sku: "TP-BLK-S",
    },
    {
      attributes: [
        { name: "Color", value: "Black" },
        { name: "Size", value: "M" },
      ],
      price: 499,
      stock: 5,
      sku: "TP-BLK-M",
    },
    {
      attributes: [
        { name: "Color", value: "White" },
        { name: "Size", value: "M" },
      ],
      price: 599,
      stock: 20,
      sku: "TP-WHT-M",
    },
  ],
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
    // Delete any extra products created for variant search tests
    await product.deleteMany({ name: /^Variant Search Test/i });
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
  it("should create a product with EAV variant attributes as ADMIN", async () => {
    const res = await request(app)
      .post("/products/")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(TEST_PRODUCT);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Product created successfully");
    expect(res.body.product).toHaveProperty("_id");
    expect(res.body.product.name).toBe(TEST_PRODUCT.name);
    expect(res.body.product).toHaveProperty("slug");
    expect(res.body.product.variants).toHaveLength(3);
    expect(res.body.product.variants[0]).toHaveProperty("price");
    expect(res.body.product.variants[0]).toHaveProperty("stock");
    expect(res.body.product.variants[0]).toHaveProperty("sku");
    expect(res.body.product.variants[0]).toHaveProperty("attributes");

    // Verify EAV structure
    const attrs = res.body.product.variants[0].attributes;
    expect(Array.isArray(attrs)).toBe(true);
    expect(attrs[0]).toHaveProperty("name");
    expect(attrs[0]).toHaveProperty("value");
    expect(attrs.find((a) => a.name === "Color").value).toBe("Black");

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

  it("should reject product with empty variants array", async () => {
    const res = await request(app)
      .post("/products/")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        ...TEST_PRODUCT,
        name: `Empty Variants ${Date.now()}`,
        variants: [],
      });

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
    const res = await request(app).get("/products/?minPrice=100&maxPrice=2000");

    expect(res.status).toBe(200);
    if (res.body.data.length > 0) {
      res.body.data.forEach((p) => {
        // At least one variant should have price in range
        const hasMatchingVariant = p.variants.some(
          (v) => v.price >= 100 && v.price <= 2000
        );
        expect(hasMatchingVariant).toBe(true);
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
  it("should return product by slug with EAV variant attributes", async () => {
    const res = await request(app).get(`/products/${createdProductSlug}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.product.slug).toBe(createdProductSlug);
    expect(res.body.product.name).toBe(TEST_PRODUCT.name);
    expect(res.body.product.variants).toHaveLength(3);

    // Verify EAV structure in fetched product
    const firstVariant = res.body.product.variants[0];
    expect(Array.isArray(firstVariant.attributes)).toBe(true);
    expect(firstVariant.attributes[0]).toHaveProperty("name");
    expect(firstVariant.attributes[0]).toHaveProperty("value");
  });

  it("should return 404 for non-existent slug", async () => {
    const res = await request(app).get("/products/non-existent-slug-xyz");

    expect(res.status).toBe(404);
  });
});

// ─── UPDATE PRODUCT ─────────────────────────────────────

describe("PUT /products/:id", () => {
  it("should update product variants as ADMIN", async () => {
    const updatedVariants = [
      {
        attributes: [
          { name: "Color", value: "Red" },
          { name: "Size", value: "L" },
        ],
        price: 1299,
        stock: 8,
        sku: "TP-RED-L",
      },
    ];

    const res = await request(app)
      .put(`/products/${createdProductId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ variants: updatedVariants });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.product.variants).toHaveLength(1);
    expect(res.body.product.variants[0].price).toBe(1299);
    // Name should remain unchanged (partial update)
    expect(res.body.product.name).toBe(TEST_PRODUCT.name);
  });

  it("should reject update as CUSTOMER", async () => {
    const res = await request(app)
      .put(`/products/${createdProductId}`)
      .set("Authorization", `Bearer ${regularToken}`)
      .send({ variants: [{ attributes: [{ name: "Color", value: "Blue" }], price: 1, stock: 1, sku: "X" }] });

    expect(res.status).toBe(403);
  });

  it("should reject update without auth", async () => {
    const res = await request(app)
      .put(`/products/${createdProductId}`)
      .send({ variants: [{ attributes: [{ name: "Color", value: "Blue" }], price: 1, stock: 1, sku: "X" }] });

    expect(res.status).toBe(401);
  });

  it("should return 404 for non-existent product", async () => {
    const res = await request(app)
      .put("/products/000000000000000000000000")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ variants: [{ attributes: [{ name: "Color", value: "Blue" }], price: 100, stock: 5, sku: "XX" }] });

    expect(res.status).toBe(404);
  });
});

// ─── VARIANT-BASED SEARCHING ────────────────────────────

describe("GET /products/ (variant attribute filtering)", () => {
  let variantSearchProductIds = [];

  beforeAll(async () => {
    // Create products with known variant attributes for deterministic testing
    const category_ = await category.findById(testCategoryId);
    const productsToCreate = [
      {
        name: `Variant Search Test Red-L ${Date.now()}`,
        description: "Product with Red/L variant",
        categoryId: testCategoryId,
        categoryPath: category_.path || [category_._id],
        images: ["https://picsum.photos/400/400"],
        variants: [
          {
            attributes: [
              { name: "Color", value: "Red" },
              { name: "Size", value: "L" },
            ],
            price: 800,
            stock: 10,
            sku: `VST-RED-L-${Date.now()}`,
          },
        ],
        slug: `variant-search-test-red-l-${Date.now()}`,
        createdBy: "test-admin",
        isActive: true,
      },
      {
        name: `Variant Search Test Blue-M ${Date.now()}`,
        description: "Product with Blue/M variant",
        categoryId: testCategoryId,
        categoryPath: category_.path || [category_._id],
        images: ["https://picsum.photos/400/400"],
        variants: [
          {
            attributes: [
              { name: "Color", value: "Blue" },
              { name: "Size", value: "M" },
            ],
            price: 1200,
            stock: 5,
            sku: `VST-BLU-M-${Date.now()}`,
          },
        ],
        slug: `variant-search-test-blue-m-${Date.now()}`,
        createdBy: "test-admin",
        isActive: true,
      },
      {
        name: `Variant Search Test Multi ${Date.now()}`,
        description: "Product with multiple variants",
        categoryId: testCategoryId,
        categoryPath: category_.path || [category_._id],
        images: ["https://picsum.photos/400/400"],
        variants: [
          {
            attributes: [
              { name: "Color", value: "Red" },
              { name: "Size", value: "M" },
              { name: "Material", value: "Cotton" },
            ],
            price: 600,
            stock: 15,
            sku: `VST-RED-M-COT-${Date.now()}`,
          },
          {
            attributes: [
              { name: "Color", value: "Green" },
              { name: "Size", value: "XL" },
              { name: "Material", value: "Polyester" },
            ],
            price: 750,
            stock: 8,
            sku: `VST-GRN-XL-POL-${Date.now()}`,
          },
        ],
        slug: `variant-search-test-multi-${Date.now()}`,
        createdBy: "test-admin",
        isActive: true,
      },
    ];

    // Insert directly into MongoDB for deterministic test data
    for (const p of productsToCreate) {
      const created = await product.create(p);
      variantSearchProductIds.push(created._id);
    }
  });

  afterAll(async () => {
    // Clean up variant search test products
    for (const id of variantSearchProductIds) {
      await product.findByIdAndDelete(id);
    }
  });

  it("should filter products by a single variant attribute (Color=Red)", async () => {
    const res = await request(app).get(
      `/products/?category=${testCategorySlug}&attr_Color=Red`
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    if (res.body.data.length > 0) {
      res.body.data.forEach((p) => {
        // At least one variant should have Color=Red
        const hasRedVariant = p.variants.some((v) =>
          v.attributes.some((a) => a.name === "Color" && a.value === "Red")
        );
        expect(hasRedVariant).toBe(true);
      });
    }
  });

  it("should filter products by multiple variant attributes (Color=Red AND Size=M)", async () => {
    const res = await request(app).get(
      `/products/?category=${testCategorySlug}&attr_Color=Red&attr_Size=M`
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    if (res.body.data.length > 0) {
      res.body.data.forEach((p) => {
        // At least one variant should have BOTH Color=Red AND Size=M
        const hasMatchingVariant = p.variants.some((v) => {
          const hasRed = v.attributes.some(
            (a) => a.name === "Color" && a.value === "Red"
          );
          const hasMedium = v.attributes.some(
            (a) => a.name === "Size" && a.value === "M"
          );
          return hasRed && hasMedium;
        });
        expect(hasMatchingVariant).toBe(true);
      });
    }
  });

  it("should return empty results for non-matching variant filters", async () => {
    const res = await request(app).get(
      `/products/?category=${testCategorySlug}&attr_Color=Magenta&attr_Size=XXXL`
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  it("should combine variant filters with price range filters", async () => {
    const res = await request(app).get(
      `/products/?category=${testCategorySlug}&attr_Color=Red&minPrice=100&maxPrice=1000`
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    if (res.body.data.length > 0) {
      res.body.data.forEach((p) => {
        // Should have a Red variant
        const hasRedVariant = p.variants.some((v) =>
          v.attributes.some((a) => a.name === "Color" && a.value === "Red")
        );
        expect(hasRedVariant).toBe(true);

        // Should have at least one variant in price range
        const hasPriceMatch = p.variants.some(
          (v) => v.price >= 100 && v.price <= 1000
        );
        expect(hasPriceMatch).toBe(true);
      });
    }
  });

  it("should filter by a single attribute (Material=Cotton)", async () => {
    const res = await request(app).get(
      `/products/?category=${testCategorySlug}&attr_Material=Cotton`
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    if (res.body.data.length > 0) {
      res.body.data.forEach((p) => {
        const hasCottonVariant = p.variants.some((v) =>
          v.attributes.some(
            (a) => a.name === "Material" && a.value === "Cotton"
          )
        );
        expect(hasCottonVariant).toBe(true);
      });
    }
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
