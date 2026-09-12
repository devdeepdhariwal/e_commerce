# 🛒 E-Commerce Industry — Backend API

> A production-grade RESTful E-Commerce Backend built with Node.js, Express 5, PostgreSQL (Prisma), MongoDB (Mongoose), and Redis (ioredis). Designed to demonstrate enterprise-level backend engineering, security best practices, and distributed systems patterns.

![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![Tests](https://img.shields.io/badge/Tests-93%2F93%20Passing-brightgreen)
![Node](https://img.shields.io/badge/Node.js-ES%20Modules-green)
![Express](https://img.shields.io/badge/Express-v5-lightgrey)
![Prisma](https://img.shields.io/badge/Prisma-v7-blue)
![Mongoose](https://img.shields.io/badge/Mongoose-v9-emerald)
![Redis](https://img.shields.io/badge/Redis-ioredis-red)
![License](https://img.shields.io/badge/License-ISC-blue)

---

## 📌 Purpose

This project serves as a **production-grade backend system** showcasing:

- RESTful API design with strict layered architecture
- Polyglot persistence / Tri-storage strategy (PostgreSQL + MongoDB + Redis)
- Secure JWT authentication with refresh token rotation & token blacklist
- Email verification via OTP and crypto-token password reset (Nodemailer + Redis)
- Role-based access control (RBAC: `ADMIN` / `CUSTOMER`)
- Comprehensive request validation with Zod schemas on every route
- Flexible E-commerce product catalog with Entity-Attribute-Value (EAV) variant modeling
- Hierarchical category tree with materialized ancestry paths
- MongoDB Atlas Search with fuzzy text matching and dynamic attribute filters
- Both offset-based and cursor-based pagination
- High-performance Redis caching with automated invalidation
- Redis-backed shopping cart with live inventory/price revalidation
- Distributed concurrency locking (`SET NX EX`) to prevent double-checkout race conditions
- Multi-phase order checkout with stock decrement and rollback on failure
- Razorpay payment gateway integration with HMAC-SHA256 webhook signature verification
- Distributed rate limiting via Redis store
- Security hardening with Helmet and CORS
- Structured logging with Winston (daily rotation) and Morgan HTTP stream
- Fail-fast environment variable validation
- 100% automated test coverage with Vitest and Supertest (93 tests)
- Full Postman collection with automated environment variables

---

## 🎯 Skills Demonstrated

| Skill Area | Implementation |
|---|---|
| **REST API Design** | Resource-based routing, semantic HTTP verbs, proper status codes, pagination headers |
| **Authentication** | JWT access/refresh tokens, SHA-256 token hashing, httpOnly cookies, token rotation, Redis blacklist on logout |
| **Account Recovery & Verification** | 6-digit numeric OTP via Nodemailer with 10-min Redis TTL, crypto-random password reset with 15-min Redis TTL |
| **Authorization** | Role-based middleware (`ADMIN` / `CUSTOMER`) with reusable higher-order closures |
| **Tri-Database Strategy** | PostgreSQL (Prisma v7) + MongoDB (Mongoose v9) + Redis (ioredis v5) |
| **Catalog Modeling** | EAV (Entity-Attribute-Value) variant structure (`attributes: [{ name, value }]`) + Materialized Path category tree |
| **Search & Filtering** | MongoDB Atlas Search compound queries (fuzzy `should`, exact `filter`, `must`), dynamic `attr_*` queries |
| **Pagination** | Offset pagination (`page`, `limit`) + Cursor pagination (`cursor`, `limit` using `_id > cursor`) |
| **Caching & Performance** | Redis response caching with selective bypass on dynamic queries, automated cache purging on mutations |
| **Concurrency Control** | Redis distributed lock (`SET checkout_lock:{userId} 1 EX 30 NX`) preventing checkout races |
| **Cart & Order Integrity** | Multi-item cart in Redis, pre-checkout cart revalidation, atomic stock decrement with rollback, Prisma transactions |
| **Payments & Webhooks** | Razorpay order creation, raw-body webhook listener, HMAC-SHA256 signature verification, idempotent fulfillment |
| **Input Validation** | Zod schemas on body, params, and query for all endpoints; strict sanitization and clamping |
| **Security Hardening** | Helmet headers, CORS policies, Redis-backed rate limiting (`rate-limit-redis`), anti-enumeration error handling |
| **Observability** | Winston logger with JSON formatting, file rotation (5MB, 5 max files), Morgan HTTP request streaming |
| **Config Validation** | Zod runtime environment validation at boot time (`env.js`) with fail-fast process exit |
| **Testing** | Vitest + Supertest integration testing across all 7 route modules with 93 passing tests |

---

## 📊 Development Status

> **Last Updated:** September 2026 — **Status: 100% Feature Complete & Fully Tested**

| Module | Status | Endpoints / Features |
|---|---|---|
| **Authentication** | ✅ Completed | Register, Login, Refresh Token, GetMe, Logout, Send OTP, Verify OTP, Forgot Password, Reset Password |
| **Product Management** | ✅ Completed | Full CRUD, EAV Variants, Category Tree, Atlas Search, Offset & Cursor Pagination, Redis Cache |
| **Category Management** | ✅ Completed | Admin CRUD, Materialized Path Hierarchy (`parentId`, `path`), Redis Cache |
| **Shopping Cart** | ✅ Completed | Add to Cart, Get Cart, Item Removal, Clear Cart, Live Revalidation against DB Stock & Prices |
| **Address Management** | ✅ Completed | Multi-address management per user, Default address support, UUID validation |
| **Orders & Checkout** | ✅ Completed | Concurrency-locked checkout, Stock reservation, Transactional order creation, Status lifecycle, Cancellation |
| **Payments & Webhooks** | ✅ Completed | Razorpay order creation, Raw-body webhook handling, HMAC-SHA256 signature verification |
| **Security & Logging** | ✅ Completed | Helmet, CORS, Redis Rate Limiting, Winston log rotation, Morgan HTTP piping |
| **Automated Testing** | ✅ Completed | 7 test suites, 93 tests covering all flows with Vitest & Supertest |

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Runtime** | Node.js (ES Modules) | Asynchronous event-driven server JavaScript |
| **Framework** | Express.js v5 | Modern HTTP routing and middleware framework |
| **Relational DB** | PostgreSQL + Prisma v7 | Relational transactional data: Users, Tokens, Addresses, Orders, OrderItems, Payments |
| **Document DB** | MongoDB + Mongoose v9 | Flexible product catalog with variants, EAV attributes, categories, Atlas Search |
| **In-Memory Store** | Redis (ioredis v5) | Shopping carts, distributed locks, OTPs, reset tokens, token blacklisting, response cache, rate-limiting |
| **Authentication** | JSON Web Tokens (`jsonwebtoken`) | Stateless access tokens (15m) + refresh tokens (7d) |
| **Password Security** | `bcrypt` | Salted password hashing (salt rounds: 10) |
| **Validation** | `zod` v4 | Runtime schema validation for request body, query, params, and `.env` variables |
| **Security** | `helmet`, `cors` | HTTP security headers and Cross-Origin Resource Sharing |
| **Rate Limiting** | `express-rate-limit`, `rate-limit-redis` | Distributed brute-force and DDoS protection |
| **Logging** | `winston`, `morgan` | Production JSON logging, file rotation (`winston-daily-rotate-file`), HTTP request logging |
| **Mailing** | `nodemailer` | SMTP transactional email sending (OTP verification and password reset) |
| **Payments** | `razorpay` | Payment order creation, verification, and webhook handling |
| **Testing** | `vitest`, `supertest` | Fast unit and integration test runner with mocked/offline support |
| **Code Style** | `prettier` | Automated code formatting |

---

## 📁 Folder Structure

```
e_commerce_industry/
├── prisma/
│   ├── schema.prisma              # PostgreSQL schema (User, Token, Address, Order, OrderItem, Payment, Enums)
│   └── migrations/                # Database migrations tracking relational schema evolution
├── src/
│   ├── server.js                  # Application entry point — env validation, DB connections, HTTP boot
│   ├── app.js                     # Express app configuration — middleware stack and route mounting
│   ├── config/
│   │   ├── db.js                  # Prisma client instance (PostgreSQL)
│   │   ├── mongodb.js             # Mongoose connection helper (MongoDB)
│   │   ├── redis.js               # Redis client instance (ioredis)
│   │   ├── env.js                 # Zod-based environment variable schema validation
│   │   ├── logger.js              # Winston logger setup (console + file rotation)
│   │   ├── nodemailer.js          # SMTP transporter configuration
│   │   └── razorpay.js            # Razorpay client instance with test-safe fallback
│   ├── controllers/
│   │   ├── auth.controller.js     # Auth, OTP, password reset, and session handlers
│   │   ├── product.controller.js  # Product CRUD, search, and pagination handlers
│   │   ├── categories.controller.js # Category tree management handlers
│   │   ├── cart.controller.js     # Shopping cart handlers
│   │   ├── address.controller.js  # User shipping address handlers
│   │   ├── order.controller.js    # Checkout, order retrieval, and cancellation handlers
│   │   └── webhook.controller.js  # Razorpay raw-body webhook handler
│   ├── services/
│   │   ├── auth.service.js        # Auth, OTP, token rotation, and password reset logic
│   │   ├── product.service.js     # Product catalog queries, slug gen, Atlas Search, cursor pagination
│   │   ├── categories.service.js  # Hierarchical category tree operations
│   │   ├── cart.service.js        # Redis cart management and live DB inventory revalidation
│   │   ├── address.service.js     # Address database operations
│   │   ├── order.service.js       # Checkout locking, stock deduction, rollback, and Prisma transactions
│   │   └── webhook.service.js     # HMAC signature verification and order settlement
│   ├── middlewares/
│   │   ├── auth.middleware.js     # JWT Bearer token verification & Redis blacklist check
│   │   ├── authorise.js           # Role-based access control closure (`ADMIN` / `CUSTOMER`)
│   │   ├── cache.js               # Generic Redis HTTP response caching middleware
│   │   ├── validate.js            # Zod validation middleware (Express 5 getter-compatible)
│   │   └── errorHandler.js        # Centralized error handler with Winston logging
│   ├── models/
│   │   ├── product.model.js       # Mongoose product schema with nested EAV variant attributes
│   │   └── category.model.js      # Mongoose category schema with parentId & materialized path
│   ├── routes/
│   │   ├── auth.routes.js         # /auth/* routes with Redis rate limiters & Zod validation
│   │   ├── product.routes.js      # /products/* routes with caching & validation
│   │   ├── categories.routes.js   # /categories/* routes with caching & validation
│   │   ├── cart.routes.js         # /cart/* routes
│   │   ├── address.routes.js      # /addresses/* routes
│   │   └── order.routes.js        # /orders/* routes
│   ├── utils/
│   │   ├── AppError.js            # Custom error class with statusCode & isOperational
│   │   ├── hash.js                # bcrypt hash and compare utilities
│   │   ├── token.js               # JWT access and refresh token signers
│   │   └── cacheKeys.js           # Redis cache key generators and bypass predicates
│   ├── __tests__/
│   │   ├── setup.js               # Vitest environment setup and teardown
│   │   ├── auth.test.js           # Auth & JWT integration tests (17 tests)
│   │   ├── product.test.js        # Product & EAV filtering tests (26 tests)
│   │   ├── category.test.js       # Category hierarchy tests (10 tests)
│   │   ├── cart.test.js           # Cart & revalidation tests (14 tests)
│   │   ├── address.test.js        # Address & Zod validation tests (7 tests)
│   │   ├── order.test.js          # Order & checkout validation tests (11 tests)
│   │   └── password-reset.test.js # Forgot & reset password tests (8 tests)
│   ├── validations/
│   │   ├── auth.validation.js     # Zod schemas for auth, OTP, and password reset
│   │   ├── product.validation.js  # Zod schemas for product CRUD and query filters
│   │   ├── category.validation.js # Zod schemas for categories
│   │   ├── cart.validation.js     # Zod schemas for cart operations
│   │   ├── address.validation.js  # Zod schemas for address creation
│   │   └── order.validation.js    # Zod schemas for checkout and order queries
│   └── seedProduct.js             # Random product generator for testing and seeding
├── docs/
│   ├── 01_PROJECT_OVERVIEW.md     # Project overview and technical architecture summary
│   ├── 02_ARCHITECTURE.md         # Request lifecycle, tri-storage design, auth & security
│   ├── 03_PRODUCTS_AND_MODELS.md  # Detailed module docs, EAV catalog, and schema definitions
│   ├── 04_FUNCTION_DOCS.md        # Technical function breakdown of complex business logic
│   ├── 05_REVIEW_AND_ROADMAP.md   # Architectural review, achievements, and future evolution
│   └── ecommerce_api.postman_collection.json # 30+ endpoint automated Postman test collection
├── package.json
├── vitest.config.js
└── .gitignore
```

### Responsibility Map

| Directory | Responsibility |
|---|---|
| `config/` | Database connections, logger setup, emailer, Razorpay client, and runtime environment validation |
| `controllers/` | HTTP transport layer — extract request inputs, invoke domain services, format responses |
| `services/` | Core business logic — data transformations, multi-database transactions, business rules, custom errors |
| `middlewares/` | Cross-cutting concerns — JWT authentication, RBAC authorization, Zod validation, response caching, error formatting |
| `models/` | Mongoose document schemas and indexes for MongoDB |
| `routes/` | API routing — mapping HTTP methods to rate limiters, validation schemas, auth guards, and controllers |
| `validations/` | Declarative Zod schemas defining data contracts for all inbound requests |
| `utils/` | Reusable utilities — standard errors, password hashing, token generation, cache key management |
| `__tests__/` | Automated integration and unit test suites running on Vitest and Supertest |
| `docs/` | System documentation and Postman API collection |
