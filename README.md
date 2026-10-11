# 🛒 E-Commerce Industry — Backend API

> A production-grade RESTful E-Commerce Backend demonstrating enterprise-level backend engineering with polyglot persistence (PostgreSQL + MongoDB + Redis), concurrency-safe checkout, secure JWT authentication with refresh token rotation, Zod runtime validation, and Razorpay payment integration.

![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![Tests](https://img.shields.io/badge/Tests-103%2F103%20Passing-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-ES%20Modules-339933?logo=node.js)
![Express](https://img.shields.io/badge/Express-v5-000000?logo=express)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma%20v7-4169E1?logo=postgresql)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose%20v9-47A248?logo=mongodb)
![Redis](https://img.shields.io/badge/Redis-ioredis%20v5-DC382D?logo=redis)
![Zod](https://img.shields.io/badge/Validation-Zod%20v4-3E67B1?logo=zod)
![License](https://img.shields.io/badge/License-ISC-blue)

---

## 📊 Development Status

| Module | Status | Description |
|---|---|---|
| **Authentication** | ✅ Completed | Register, Login, Refresh Token Rotation, GetMe, Logout with Blacklist, Email OTP, Password Reset |
| **Product Management** | ✅ Completed | Full CRUD, EAV Variants, Category Tree, Atlas Search, Offset & Cursor Pagination, Redis Cache |
| **Category Management** | ✅ Completed | Hierarchical Materialized Path Tree (`parentId`, `path`), Redis Cache, Subcategory Protection |
| **Shopping Cart** | ✅ Completed | Redis Session Store (`cart:${userId}`), Live Inventory & Price Revalidation, Item Management |
| **Shipping Addresses** | ✅ Completed | PostgreSQL Address Book per User, UUID Validation, Default Addresses |
| **Orders & Checkout** | ✅ Completed | Concurrency Lock (`SET NX EX`), Atomic Stock Reservation with Rollback, Status Lifecycle |
| **Payments & Webhooks** | ✅ Completed | Razorpay Order Creation, Raw-Body HMAC-SHA256 Signature Verification, Idempotent Settlement |
| **Security & Logging** | ✅ Completed | Helmet, CORS, Redis Rate Limiting (`rate-limit-redis`), Winston size-based rotation (error log 5 MB × 5 files, combined log 10 MB × 5 files), Morgan Stream |
| **Automated Testing** | ✅ Completed | 8 Test Suites, 103/103 tests passing across all routes (Vitest + Supertest) |

---

## 🏗 Architecture & Design Patterns

```
Client Request
     │
     ▼
[Security & Observability]  → Helmet, CORS, Morgan (piped to Winston)
     │
     ▼
[Rate Limiting & Zod]       → Redis Store (r1:*), Declarative Zod Schema Validation
     │
     ▼
[Authentication & RBAC]     → JWT Verify, Redis Blacklist Check, Role-based Authorise (ADMIN / CUSTOMER)
     │
     ▼
[Caching Layer]             → Redis Cache (cache:*) with smart invalidation & dynamic query bypass
     │
     ▼
[Controller & Service]      → Layered separation of transport, business logic, and transactions
     │
     ├──────────────────────┬──────────────────────┐
     ▼                      ▼                      ▼
PostgreSQL (Prisma)     MongoDB (Mongoose)     Redis (ioredis)
• Users & Credentials   • Product Catalog      • Active Carts
• Refresh Tokens        • EAV Variant Models   • Distributed Locks
• Shipping Addresses    • Category Tree Path   • Token Blacklist
• Orders & Line Items   • Atlas Search Index   • OTPs & Reset Tokens
• Payment Records                              • HTTP Response Cache
```

### Key Engineering Highlights:
- **Polyglot Persistence (Tri-Storage):** PostgreSQL for ACID financial/user transactions, MongoDB for multi-variant product catalog, and Redis for high-churn sessions, locks, and cache.
- **Concurrency-Safe Checkout:** Redis distributed locks (`checkout_lock:${userId}`) prevent double-checkout race conditions; atomic MongoDB stock decrement includes automatic compensating rollbacks on partial failure.
- **Single-Use Refresh Token Rotation:** Plaintext refresh tokens are never stored; only SHA-256 hashes are persisted in PostgreSQL. Replayed tokens immediately alert and deny access.
- **Instant Token Revocation:** On logout, active access tokens are blacklisted in Redis for their remaining TTL.
- **Fail-Fast Environment Validation:** `src/config/env.js` validates all configuration variables at boot using Zod, preventing partial runtime crashes.

---

## 🚀 Quick Start

### Prerequisites
- Node.js $\ge$ 18 (ES Modules enabled)
- PostgreSQL running locally or in the cloud
- MongoDB Atlas or local MongoDB instance
- Redis server running locally or hosted

### Setup & Run
```bash
# 1. Clone repository & install dependencies
git clone https://github.com/devdeepdhariwal/e_commerce.git
cd e_commerce
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env and supply your database connections and secrets

# 3. Apply Prisma database migrations
npx prisma migrate dev

# 4. (Optional) Seed sample randomized products
node scripts/seedProducts.js

# 5. Start development server (hot-reload via nodemon)
npm run dev
```

---

## 🧪 Testing

The codebase includes **103/103 tests passing**, covering happy paths and edge cases (authentication, token replay, schema rejections, cart stock adjustments, checkout, webhooks, order pagination, address existence).

```bash
npm test           # Run all 8 test suites via Vitest
npm run test:watch # Run Vitest in interactive watch mode
```

```
 ✓ src/__tests__/order.test.js (18 tests)
 ✓ src/__tests__/product.test.js (27 tests)
 ✓ src/__tests__/cart.test.js (16 tests)
 ✓ src/__tests__/password-reset.test.js (8 tests)
 ✓ src/__tests__/otp.test.js (8 tests)
 ✓ src/__tests__/auth.test.js (17 tests)
 ✓ src/__tests__/address.test.js (7 tests)
 ✓ src/__tests__/webhook.test.js (2 tests)

 Test Files  8 passed (8)
      Tests  103 passed (103)
```

---

## 📬 API Endpoint Reference

### 1. Authentication (`/auth`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register new user account |
| `POST` | `/auth/login` | Public | Authenticate user, receive access token & httpOnly cookie |
| `POST` | `/auth/refresh-token` | Cookie | Single-use refresh token rotation |
| `GET` | `/auth/me` | Bearer | Get authenticated user profile |
| `POST` | `/auth/logout` | Bearer | Revoke refresh token & blacklist access token in Redis |
| `POST` | `/auth/send-otp` | Public | Send 6-digit email verification code |
| `POST` | `/auth/verify-otp` | Public | Verify OTP and set `isEmailVerified = true` |
| `POST` | `/auth/forgot-password`| Public | Request password reset token via email |
| `POST` | `/auth/reset-password` | Public | Reset password & terminate all active sessions |

### 2. Products (`/products`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/products/` | Admin | Create product with EAV variant attributes |
| `GET` | `/products/` | Public | List products (cached; Atlas search, `attr_*` filters, offset/cursor) |
| `GET` | `/products/:slug`| Public | Retrieve product by SEO slug |
| `PUT` | `/products/:id` | Admin | Update product fields and variants |
| `DELETE`| `/products/:id` | Admin | Delete product and invalidate cache |

### 3. Categories (`/categories`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/categories` | Admin | Create hierarchical category with materialized path |
| `GET` | `/categories` | Public | Get category tree (cached in Redis, 30-min TTL) |
| `DELETE`| `/categories/:id`| Admin | Delete category (protected against subcategory orphans) |

### 4. Shopping Cart (`/cart`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/cart/add` | Bearer | Add item or increment variant quantity |
| `GET` | `/cart` | Bearer | Get current user's cart items and total |
| `POST` | `/cart/revalidate` | Bearer | Reconcile cart against real-time MongoDB inventory & prices |
| `DELETE`| `/cart/item/:productId/:sku` | Bearer | Remove single variant item |
| `DELETE`| `/cart` | Bearer | Clear entire shopping cart |

### 5. Addresses (`/addresses`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/addresses` | Bearer | Create a new user shipping address |
| `GET` | `/addresses` | Bearer | List all saved addresses for current user |

### 6. Orders (`/orders`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/orders/checkout` | Bearer | Concurrency-locked checkout, stock reservation, Razorpay order |
| `GET` | `/orders` | Bearer | List user's orders with pagination |
| `GET` | `/orders/:id` | Bearer | Get detailed order summary and line items |
| `POST` | `/orders/:id/cancel` | Bearer | Cancel pending order and restore inventory stock |

### 7. Payments & Webhooks (`/webhooks`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/webhooks/razorpay` | Razorpay | Raw-body HMAC-SHA256 signature verification & order fulfillment |

---

## 📖 In-Depth System Documentation

Detailed technical design documents are maintained in the [`docs/`](./docs/) directory:

| Document | Description |
|---|---|
| [**01_PROJECT_OVERVIEW.md**](./docs/01_PROJECT_OVERVIEW.md) | High-level system architecture, skills demonstrated, tech stack, directory tree |
| [**02_ARCHITECTURE.md**](./docs/02_ARCHITECTURE.md) | Request lifecycle, tri-storage design, complete authentication & security specifications |
| [**03_PRODUCTS_AND_MODELS.md**](./docs/03_PRODUCTS_AND_MODELS.md) | Domain modules (catalog, cart, orders, webhooks) and full PostgreSQL, MongoDB, and Redis schemas |
| [**04_FUNCTION_DOCS.md**](./docs/04_FUNCTION_DOCS.md) | Deep-dive logic breakdowns of checkout locking, cart revalidation, HMAC webhooks, and token rotation |
| [**05_REVIEW_AND_ROADMAP.md**](./docs/05_REVIEW_AND_ROADMAP.md) | Engineering review, resolved gaps, production readiness evaluation, and future roadmap |
| [**ecommerce_api.postman_collection.json**](./docs/ecommerce_api.postman_collection.json) | Ready-to-import Postman collection covering 30+ endpoints with automated token persistence |

---

## Known limitations

- A process crash mid-checkout after stock deduction can leave stock deducted until reconciled (a saga or reconciliation job is the fix).
- Unpaid PENDING orders are not auto-expired; a TTL-based cleanup job is the planned fix.
- Cross-user stock safety relies on the atomic MongoDB `$gte` guard, not on the per-user checkout lock.
- Redis response caching was benchmarked against remote Upstash and Atlas instances and showed no latency gain at this dataset size (~57 ms avg for both hits and misses, dominated by network round trips). Benefits are expected with a co-located Redis instance or heavier queries.

---

## Recent fixes

1. `RAZORPAY_WEBHOOK_SECRET` is required at boot; webhooks read it from the validated env object and reject missing signatures with 400 and invalid signatures with 401.
2. A second checkout while an order is PENDING returns 409 so stock is not deducted twice.
2b. Cancel uses a status-guarded `updateMany` inside a transaction so concurrent cancels restore stock only once.
2c. `payment.captured` on a non-PENDING order (for example CANCELLED) is not marked PAID and does not change stock.
3. `payment.failed` updates order and payment in one transaction; MongoDB stock is restored only if the guarded PENDING → FAILED update succeeded.
4. Webhook events are deduplicated with Redis `SET NX` on `webhook_event:<id>` after signature verification.
5. Product list cache invalidation uses Redis SCAN instead of `KEYS`.
6. Checkout lock value is a request token; release is compare-and-delete so a slow request cannot delete another request's lock.

---

<p align="center"><em>Engineered with modern Node.js, Express 5, Prisma, Mongoose, and Redis.</em></p>
