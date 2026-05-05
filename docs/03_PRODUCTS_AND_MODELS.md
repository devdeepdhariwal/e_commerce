# 📦 Product Module Documentation

## Overview

The product module provides full CRUD operations for an e-commerce catalog stored in MongoDB. It features auto-generated SEO-friendly slugs, MongoDB Atlas Search with fuzzy matching, pagination, and role-based write protection (ADMIN only).

## API Endpoints

### POST `/products/`

**Purpose:** Create a new product (Admin only).

| Field | Details |
|---|---|
| **Method** | `POST` |
| **Auth Required** | Yes (`Bearer <accessToken>`) |
| **Role Required** | `ADMIN` |
| **Middleware Chain** | `authenticate` → `authorise("ADMIN")` → `createProduct` |

**Request Body:**
```json
{
  "name": "Nike Air Max 90",
  "description": "Premium quality shoes by Nike",
  "category": "Shoes",
  "price": 4999,
  "images": ["https://example.com/image1.jpg"],
  "variants": [
    { "size": "M", "color": "Black", "stock": 50 }
  ]
}
```

**Success Response (201):**
```json
{
  "message": "Product created successfully",
  "product": { ...fullProductObject }
}
```

**Error Responses:**

| Code | Condition |
|---|---|
| 400 | Missing required fields |
| 401 | Not authenticated |
| 403 | Not an ADMIN |
| 409 | Slug already exists (duplicate product name) |

**Internal Flow:**
1. Auth middleware verifies JWT → authorise checks `role === "ADMIN"`
2. Controller validates required fields → extracts `createdBy` from `req.user.userId`
3. `product.service.createProduct()`:
   - Generates slug from name (lowercase, trim, strip special chars, replace spaces with hyphens)
   - Checks slug uniqueness in MongoDB
   - Creates product document with all fields + auto-generated slug

---

### GET `/products/`

**Purpose:** List products with filtering, search, and pagination.

| Field | Details |
|---|---|
| **Auth Required** | No (public) |
| **Search Engine** | MongoDB Atlas Search |

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | Number | 1 | Page number (min: 1) |
| `limit` | Number | 10 | Items per page (min: 1, max: 100) |
| `name` | String | — | Fuzzy text search on product name |
| `category` | String | — | Exact category filter |
| `minPrice` | Number | — | Minimum price (inclusive) |
| `maxPrice` | Number | — | Maximum price (inclusive) |

**Example:** `GET /products?name=nike&category=Shoes&minPrice=1000&maxPrice=5000&page=1&limit=20`

**Success Response (200):**
```json
{
  "success": true,
  "data": [ ...products ],
  "pagination": {
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

**Internal Flow:**
1. Controller parses and sanitizes query params (clamp page ≥ 1, limit 1–100)
2. `product.service.getProducts()` builds MongoDB Atlas Search aggregation pipeline:
   - `should` clauses: fuzzy text search on `name` (maxEdits: 1)
   - `filter` clauses: exact `category` match, price `range`
   - `must` clauses: `isActive === true` (only active products)
3. Pipeline applies `$skip` and `$limit` for pagination
4. Separate `countDocuments` query for total count
5. Controller calculates `totalPages`, `hasNextPage`, `hasPrevPage`

**Search Implementation:**
```
Atlas Search Index: "product_search"
├── should  → fuzzy text match on "name" field (maxEdits: 1)
├── filter  → exact match on "category", range on "price"
└── must    → equals "isActive" = true
```

---

### GET `/products/:slug`

**Purpose:** Get a single product by its URL-friendly slug.

| Field | Details |
|---|---|
| **Auth Required** | No (public) |

**Success Response (200):**
```json
{
  "success": true,
  "product": { ...productObject }
}
```

| Error Code | Condition |
|---|---|
| 404 | Product not found |

---

### PUT `/products/:id`

**Purpose:** Update a product by MongoDB ObjectId (Admin only).

| Field | Details |
|---|---|
| **Auth Required** | Yes |
| **Role Required** | `ADMIN` |
| **Middleware Chain** | `authenticate` → `authorise("ADMIN")` → `updateProduct` |

**Request Body (all fields optional):**
```json
{
  "name": "Updated Product Name",
  "description": "New description",
  "price": 3999,
  "category": "T-Shirts",
  "images": ["https://example.com/new.jpg"],
  "variants": [{ "size": "L", "color": "Red", "stock": 25 }],
  "isActive": false
}
```

**Internal Flow:**
1. If `name` is being updated → regenerate slug → check slug uniqueness (excluding current product by `_id`)
2. `findByIdAndUpdate` with `{ new: true }` to return updated document

---

### DELETE `/products/:id`

**Purpose:** Delete a product by MongoDB ObjectId (Admin only).

| Field | Details |
|---|---|
| **Auth Required** | Yes |
| **Role Required** | `ADMIN` |

**Success Response (200):**
```json
{ "message": "Product deleted Successfully" }
```

---

# 🗄 Database Models

## User Model (PostgreSQL — Prisma)

**Table:** `User`

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | `String` | `@id @default(uuid())` | UUID primary key |
| `name` | `String` | Required | User's display name |
| `email` | `String` | `@unique`, Required | Normalized to lowercase |
| `password` | `String` | Required | bcrypt hash (10 salt rounds) |
| `createdAt` | `DateTime` | `@default(now())` | Auto-set on creation |
| `role` | `ROLE` enum | `@default(CUSTOMER)` | `CUSTOMER` or `ADMIN` |
| `tokens` | `Token[]` | Relation | One-to-many with Token table |

**Enum `ROLE`:** `CUSTOMER` | `ADMIN`

## Token Model (PostgreSQL — Prisma)

**Table:** `Token`

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | `Int` | `@id @default(autoincrement())` | Auto-increment PK |
| `userId` | `String` | FK → `User.id` | Owning user |
| `tokenHash` | `String` | `@unique` | SHA-256 hash of refresh token |
| `expiresAt` | `DateTime` | Required | 7 days from creation |
| `createdAt` | `DateTime` | `@default(now())` | Auto-set on creation |

**Indexes:** `@@index([userId])` — optimizes token lookups by user.

**Relationship:** `Token.user` → `User` via `userId` ↔ `id` (one-to-many).

## Product Model (MongoDB — Mongoose)

**Collection:** `products`

| Field | Type | Constraints | Description |
|---|---|---|---|
| `name` | `String` | Required, trimmed | Product display name |
| `slug` | `String` | Required, unique, lowercase | URL-friendly identifier |
| `description` | `String` | Trimmed | Product description |
| `price` | `Number` | Required, min: 0 | Price in base currency |
| `category` | `String` | Required | Product category |
| `images` | `[String]` | — | Array of image URLs |
| `variants` | `[Object]` | — | Size/color/stock combinations |
| `variants.size` | `String` | — | e.g., "S", "M", "L", "XL" |
| `variants.color` | `String` | — | e.g., "Red", "Black" |
| `variants.stock` | `Number` | min: 0 | Available inventory |
| `createdBy` | `String` | Required | Admin user UUID (from PostgreSQL) |
| `isActive` | `Boolean` | Default: `true` | Soft-delete / visibility flag |
| `createdAt` | `Date` | Auto (timestamps) | Mongoose timestamps |
| `updatedAt` | `Date` | Auto (timestamps) | Mongoose timestamps |

**Cross-Database Relationship:** `createdBy` stores the PostgreSQL User UUID, linking products to their creator across databases.
