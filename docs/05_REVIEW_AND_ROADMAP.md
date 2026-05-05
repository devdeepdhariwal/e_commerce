# 🔍 Code Review

## ✅ Good Practices Followed

| Practice | Evidence |
|---|---|
| **Layered Architecture** | Clean Route → Controller → Service → Model separation across all modules |
| **ES Modules** | Consistent use of `import/export` with `"type": "module"` in package.json |
| **Secure Token Storage** | Refresh tokens SHA-256 hashed before DB storage — industry best practice |
| **Token Rotation** | Old refresh token deleted on each use, new one issued — prevents replay attacks |
| **httpOnly Cookies** | Refresh tokens sent via httpOnly, Secure, SameSite=Strict cookies — mitigates XSS |
| **Password Security** | bcrypt with 10 salt rounds + regex enforcement (upper, lower, digit, special, 8+ chars) |
| **Anti-Enumeration** | Same "Invalid Credentials" error for wrong email AND wrong password |
| **Centralized Error Handling** | Custom `AppError` class with `isOperational` flag + global `errorHandler` middleware |
| **Safe Data Return** | Password excluded from all responses via Prisma `select` or destructuring |
| **Environment Configuration** | Secrets in `.env`, loaded via `dotenv`, `.env` in `.gitignore` |
| **Soft Delete Pattern** | `isActive` flag on products instead of hard deletion in search results |
| **Slug Uniqueness** | Checked on both create and update (excluding self on update via `$ne`) |
| **Input Sanitization** | Email normalization (trim + lowercase), pagination clamping (min/max bounds) |

## ⚠️ Areas for Improvement

### Naming Consistency

| Current | Suggested | Reason |
|---|---|---|
| `registeruser` | `registerUser` | camelCase consistency |
| `hashpassword` | `hashPassword` | camelCase consistency |
| `comparehash` | `compareHash` | camelCase consistency |
| `normalisedemail` | `normalizedEmail` | camelCase + American English consistency |
| `ismatch` | `isMatch` | camelCase consistency |
| `hashedpassword` | `hashedPassword` | camelCase consistency |

### Structural Issues

1. **Missing Logout Endpoint:** The readme mentions "Logout — token invalidation from DB" but no logout route exists. The `deleteRefreshToken` service function exists but isn't exposed via a route.

2. **Missing Input Validation Library:** Currently using manual `if (!field)` checks. A library like `Joi` or `Zod` would provide schema-based validation with better error messages and less boilerplate.

3. **`getProductBySlug` Bug:** In `product.service.js` line 111, `return product` returns the Mongoose **model** instead of the `foundproduct` variable. Should be `return foundproduct`.

4. **Inconsistent Response Formats:**
   - Auth endpoints return `{ message, user }` or `{ message, accessToken }`
   - Product endpoints return `{ success, data, pagination }` or `{ success, product }`
   - Product creation validation returns raw string `res.status(400).json("All fields are neccessary")` instead of object

5. **`pass.js` in Root:** This is a debug/utility file that should not be in the repository. It appears to be for testing password hashing.

6. **Missing Rate Limiting:** No protection against brute-force login attempts. Consider `express-rate-limit`.

7. **No Request Logging:** No HTTP request logging middleware (e.g., `morgan`).

8. **Hardcoded Port:** `const PORT = 3000` should use `process.env.PORT || 3000`.

### Security Considerations

| Area | Status | Recommendation |
|---|---|---|
| CORS | ❌ Not configured | Add `cors` middleware before production |
| Rate Limiting | ❌ Not present | Add `express-rate-limit` on auth routes |
| Helmet | ❌ Not present | Add `helmet` for security headers |
| Input Validation | ⚠️ Manual only | Adopt Zod or Joi for schema validation |
| API Versioning | ❌ Not present | Consider `/api/v1/` prefix for future-proofing |

### Scalability Readiness

| Aspect | Rating | Notes |
|---|---|---|
| Module separation | 🟢 Ready | New modules follow same pattern easily |
| Database strategy | 🟢 Ready | Dual-DB is well-separated |
| Auth system | 🟢 Ready | Token-based, stateless, scalable |
| Search | 🟢 Ready | Atlas Search handles scale well |
| Config management | 🟡 Partial | Needs API versioning and CORS |
| Testing | 🔴 Missing | No test framework or test files |
| CI/CD | 🔴 Missing | No pipeline configuration |

---

# 🎯 Portfolio Value

## What This Project Demonstrates to Recruiters

### 1. Backend Engineering Fundamentals
- Building a REST API from scratch with Express 5
- Understanding HTTP methods, status codes, and response structures
- Middleware chains and request lifecycle management

### 2. Authentication & Security Expertise
- JWT-based stateless authentication (not just following a tutorial)
- **Refresh token rotation** — a sophisticated pattern that most junior developers don't implement
- SHA-256 hashing of stored tokens — shows understanding of defense-in-depth
- httpOnly cookies with SameSite + Secure flags
- Anti-enumeration error messages

### 3. Database Design & Dual-DB Architecture
- PostgreSQL for relational data (users, tokens) with Prisma ORM
- MongoDB for document data (products with nested variants) with Mongoose ODM
- Understanding of when to use relational vs. document databases
- Proper indexing (`@@index`, `@unique`)
- Cross-database references (`createdBy` links PG user to Mongo product)

### 4. Clean Architecture
- Not just "it works" — structured with separation of concerns
- Service layer isolates business logic from HTTP concerns
- Centralized error handling with operational vs. unexpected error distinction
- Reusable middleware (higher-order `authorise` function)

### 5. Search Implementation
- MongoDB Atlas Search with compound queries
- Fuzzy matching for user-friendly search
- Multi-field filtering (category, price range)
- Pagination with metadata (totalPages, hasNext, hasPrev)

### 6. Real-World Patterns
- Slug generation for SEO-friendly URLs
- Seed script for development data (100 randomized products)
- Environment-based configuration (dev vs. production error handling)
- Soft-delete pattern (`isActive` flag)

---

# 🗺 Next Recommended Modules

Based on the current codebase maturity, here's the suggested development roadmap:

### Phase 1 — Core Commerce (Next)

| Priority | Module | Key Features | Database |
|---|---|---|---|
| 1 | **Cart** | Add/remove items, quantity management, cart total calculation | MongoDB |
| 2 | **Orders** | Cart → Order conversion, order status tracking, order history | MongoDB + PostgreSQL (order ownership) |
| 3 | **Payments** | Stripe/Razorpay integration, payment status, webhooks | PostgreSQL (transactions) |

### Phase 2 — User Experience

| Priority | Module | Key Features |
|---|---|---|
| 4 | **Reviews & Ratings** | Product reviews, average rating calculation, review moderation |
| 5 | **Wishlist** | Save products for later, share wishlists |
| 6 | **User Profile** | Update profile, change password, address management |

### Phase 3 — Operations & Admin

| Priority | Module | Key Features |
|---|---|---|
| 7 | **Admin Dashboard API** | Sales analytics, user management, product analytics |
| 8 | **Inventory Management** | Stock tracking, low-stock alerts, variant-level inventory |
| 9 | **Notifications** | Email notifications (order confirmation, shipping updates) |

### Phase 4 — Polish

| Priority | Module | Key Features |
|---|---|---|
| 10 | **Testing Suite** | Jest + Supertest for unit and integration tests |
| 11 | **API Documentation** | Swagger/OpenAPI auto-generated docs |
| 12 | **CI/CD Pipeline** | GitHub Actions for lint, test, deploy |

---

# 📋 Living Changelog

```
┌─────────────────────────────────────────────────┐
│                VERSION HISTORY                  │
├─────────────────────────────────────────────────┤
│                                                 │
│  Version 0.1.0                    March 2026    │
│  ✅ Project scaffolding                         │
│  ✅ Prisma + PostgreSQL setup                   │
│  ✅ MongoDB connection                          │
│  ✅ Express 5 configuration                     │
│                                                 │
│  Version 0.2.0                    March 2026    │
│  ✅ User registration with validation           │
│  ✅ Login with JWT access + refresh tokens      │
│  ✅ Refresh token rotation (SHA-256 hashed)     │
│  ✅ Role-based access control (RBAC)            │
│  ✅ Auth middleware + authorise middleware       │
│  ✅ GetMe protected endpoint                    │
│  ✅ Centralized error handling (AppError)       │
│                                                 │
│  Version 0.3.0                    April 2026    │
│  ✅ Product CRUD (Create, Read, Update, Delete) │
│  ✅ Auto-generated SEO slugs                    │
│  ✅ MongoDB Atlas Search (fuzzy + compound)     │
│  ✅ Pagination with metadata                    │
│  ✅ Product seed script (100 products)          │
│  ✅ Admin-only write protection                 │
│                                                 │
│  Version 0.4.0                    Planned       │
│  🔲 Cart module                                │
│  🔲 Input validation (Zod/Joi)                 │
│  🔲 Logout endpoint                            │
│  🔲 Response format standardization            │
│                                                 │
│  Version 0.5.0                    Planned       │
│  🔲 Order management                           │
│  🔲 Payment integration                        │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

# 📊 Final Score — Current State

| Category | Score | Justification |
|---|---|---|
| **Code Quality** | **7 / 10** | Clean architecture and solid patterns. Deductions for naming inconsistencies, a bug in `getProductBySlug`, inconsistent response formats, and no input validation library. |
| **Architecture** | **8.5 / 10** | Excellent layered design with dual-database strategy. Service layer is well-separated. Middleware chain is clean. Deductions for missing API versioning, CORS, and rate limiting. |
| **Recruiter Appeal** | **8 / 10** | Refresh token rotation and Atlas Search are standout features that differentiate from typical tutorial projects. Dual-database strategy shows architectural thinking. Would score higher with tests and API docs. |
| **Learning Value** | **9 / 10** | Covers authentication, authorization, CRUD, search, pagination, error handling, and database design. The dual-DB approach teaches when to use SQL vs. NoSQL. One of the strongest categories. |

### Overall: **8.1 / 10**

> **Verdict:** This project is well above the typical "CRUD API tutorial" portfolio piece. The refresh token rotation, Atlas Search integration, and dual-database architecture demonstrate genuine backend engineering understanding. Fixing the minor issues listed in the Code Review section and adding a Cart + Orders module would push this into the 9+ range.

---

<p align="center">
  <em>Documentation generated from source code analysis — April 2026</em><br>
  <em>This is living documentation. Update as modules are added.</em>
</p>
