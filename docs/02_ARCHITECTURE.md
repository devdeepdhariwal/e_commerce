# 🏗 Implemented Architecture

## Request Lifecycle

Every HTTP request traverses a hardened, layered pipeline before reaching business services:

```
                      Client HTTP Request
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│  Security Layer: Helmet (CSP, HSTS, XSS, Frameguard)      │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│  Cross-Origin Layer: CORS (Configured Allowed Origins)    │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│  Observability Layer: Morgan HTTP Logger (Piped to Winston)│
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│  Body & Cookie Parsing: cookie-parser, express.urlencoded │
│  (Note: /webhooks/razorpay intercepted here with raw body) │
│  express.json() for standard API payloads                 │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│  Rate Limiting Layer: Redis Store (r1:*)                  │
│  Protection against brute force & DDoS on sensitive routes│
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│  Validation Layer: Zod Schema Middleware                  │
│  Validates body / query / params; sanitizes & coerces data│
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│  Auth Guard: JWT Verification & Redis Token Blacklist     │
│  Attaches req.user { userId, role }                       │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│  RBAC Guard: Role-Based Access Control (ADMIN / CUSTOMER) │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│  Caching Layer: Redis Cache Middleware (cache:*)          │
│  Returns cached JSON for idempotent GET requests if valid │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│  Transport Controller: Extracts request parameters        │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│  Domain Service: Executes business logic & transactions   │
└─────────────────────────────┬─────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ PostgreSQL       │ │ MongoDB          │ │ Redis            │
│ (Users, Orders,  │ │ (Catalog, EAV    │ │ (Carts, Locks,   │
│  Addresses,      │ │  Variants, Tree  │ │  OTPs, Blacklist,│
│  Payments)       │ │  Categories)     │ │  HTTP Cache)     │
└──────────────────┘ └──────────────────┘ └──────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│  Centralized Error Handler: Winston log, standard JSON    │
└───────────────────────────────────────────────────────────┘
```

---

## Why This Architecture?

| Benefit | Explanation |
|---|---|
| **Separation of Concerns** | Controllers handle transport (HTTP/REST); services contain pure business logic; models define data schemas. Controllers never write raw queries. |
| **Tri-Storage Optimization** | Each persistence engine is matched to its ideal workload rather than forcing a one-size-fits-all database. |
| **Defense-in-Depth Security** | Multi-tier security: Helmet HTTP headers $\rightarrow$ Redis rate limiting $\rightarrow$ Zod schema enforcement $\rightarrow$ JWT cryptographic signature $\rightarrow$ Redis token blacklist $\rightarrow$ RBAC checks. |
| **High-Performance Caching** | Hot read paths (product catalog and category trees) are cached in Redis with automated cache invalidation upon writes. |
| **Concurrency & Integrity** | High-risk checkout actions use distributed Redis locks (`SET NX EX`) and atomic stock reservations, preventing race conditions and overselling. |
| **Centralized Observability** | Uniform error classification via `AppError`, with operational errors logged as warnings and unexpected exceptions logged with stack traces to rotating log files. |

---

## Tri-Storage Strategy

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             POLYGLOT PERSISTENCE                                 │
├───────────────────────┬──────────────────────────┬───────────────────────────────┤
│ PostgreSQL (Prisma)   │ MongoDB (Mongoose)       │ Redis (ioredis)               │
├───────────────────────┼──────────────────────────┼───────────────────────────────┤
│ • Users & Credentials │ • Products Catalog       │ • Active Shopping Carts       │
│ • Refresh Tokens      │ • EAV Variant Attributes │ • Distributed Locks (Checkout)│
│ • Shipping Addresses  │ • Hierarchical Categories│ • Email OTP Codes             │
│ • Orders & Line Items │ • Materialized Paths     │ • Password Reset Tokens       │
│ • Payment Records     │ • Atlas Search Index     │ • Access Token Blacklist      │
│                       │                          │ • HTTP Response Cache         │
│                       │                          │ • Distributed Rate Limiters   │
└───────────────────────┴──────────────────────────┴───────────────────────────────┘
```

### Rationale:
1. **PostgreSQL (ACID & Relational Integrity):**
   Orders, monetary transactions, payment states, and user accounts require strict foreign keys, atomic transactions (`prisma.$transaction`), and strict consistency.
2. **MongoDB (Document Flexibility & Search):**
   E-commerce products have diverse, unpredictable variants (e.g., Clothing: Size/Color/Material; Electronics: Voltage/RAM/Storage). MongoDB handles nested arrays of EAV attributes effortlessly and integrates with Atlas Search for typo-tolerant queries.
3. **Redis (In-Memory Speed & Ephemeral State):**
   Shopping carts expire after a set time; concurrency locks must be lightning fast; rate limiting counters require atomic increments; and blacklisted JWTs need fast sub-millisecond lookups.

---

## Complete Middleware Stack

```javascript
// Global Application Middleware Order (app.js)
1. helmet()                 // Security headers (XSS, CSP, HSTS, Sniffing protection)
2. cors(options)            // Whitelisted origins and credentials support
3. morgan("combined", ...)  // Access logging streamed directly into Winston logger.http
4. cookieParser()           // Reads httpOnly cookies for refresh token rotation
5. express.urlencoded(...)  // Form data parser
6. express.raw(...)         // Mounted ONLY on /webhooks/razorpay to verify HMAC signatures
7. express.json()           // Standard JSON body parser for all API endpoints
8. API Route Handlers       // /auth, /products, /categories, /cart, /addresses, /orders
9. errorHandler             // Centralized terminal error catcher
```

---

## Centralized Error Handling Flow

```
Service Layer throws AppError("Cart changed, please confirm", 409)
                      │
                      ▼
Controller catches in try/catch block → invokes next(error)
                      │
                      ▼
errorHandler Middleware (src/middlewares/errorHandler.js)
                      │
     ┌────────────────┴────────────────┐
     ▼                                 ▼
4xx Operational Error             5xx Unexpected Error
• Logged via logger.warn          • Logged via logger.error (with stack)
• Returns status code             • Development: full stack trace
• Structured JSON:                • Production: "Internal server error"
  { success: false,                 { success: false, message: "..." }
    message: "..." }
```

---

# 🔐 Authentication & Identity Module

## Overview

The authentication module delivers an enterprise-grade security implementation:
- **Dual-Token Strategy:** Short-lived access tokens (15 minutes) + long-lived refresh tokens (7 days).
- **Refresh Token Rotation:** Refresh tokens are single-use; rotation invalidates old tokens immediately upon use.
- **SHA-256 Storage:** Plaintext refresh tokens are never stored; only cryptographic SHA-256 hashes are saved in PostgreSQL.
- **httpOnly Cookies:** Refresh tokens are stored in `httpOnly`, `SameSite=Strict`, `Secure` cookies, impervious to XSS.
- **Token Blacklisting:** On logout, the access token's remaining lifespan is calculated and blacklisted in Redis.
- **Email Verification (OTP):** 6-digit numeric OTP delivered via Nodemailer, stored in Redis with a 10-minute TTL.
- **Password Reset Flow:** Cryptographically secure random tokens hashed into Redis (15-min TTL) with automatic token revocation.
- **Rate Limiting:** Dedicated Redis-backed rate limiters on sensitive auth endpoints.

---

## Token Lifecycle Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TOKEN ROTATION LIFECYCLE                        │
├────────────────────────────────────────────────────────────────────────┤
│ 1. LOGIN / REFRESH                                                     │
│    • Generate Access Token (JWT, 15m)                                  │
│    • Generate Refresh Token (JWT, 7d)                                  │
│    • Compute SHA-256 hash of Refresh Token                             │
│    • Save hash to PostgreSQL `Token` table                             │
│    • Set `refreshToken` in httpOnly cookie                             │
│    • Return `accessToken` in JSON response                             │
│                                                                        │
│ 2. API REQUEST                                                         │
│    • Client sends `Authorization: Bearer <accessToken>`                │
│    • Auth middleware checks Redis blacklist: `blacklist:<accessToken>` │
│    • If found: 401 Unauthorized ("Token has been invalidated")         │
│    • If valid: Verifies JWT signature and extracts user context        │
│                                                                        │
│ 3. ROTATION ON REFRESH                                                 │
│    • Client calls POST /auth/refresh-token (cookie sent)               │
│    • Verify JWT signature                                              │
│    • Hash token and lookup in `Token` table                            │
│    • If NOT found: 401 (Replay attack detected or invalid token)       │
│    • Delete old token record (single-use enforcement)                  │
│    • Issue new token pair (new access token + rotated refresh token)   │
│                                                                        │
│ 4. LOGOUT                                                              │
│    • Delete user's active refresh tokens from PostgreSQL               │
│    • Calculate remaining access token time-to-live                     │
│    • Store access token in Redis: `blacklist:<token>` with remaining TTL│
│    • Clear `refreshToken` cookie                                       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Auth Endpoints Specification

### 1. `POST /auth/register`
- **Rate Limit:** 5 requests per 15 minutes
- **Validation:** `registerSchema` (Zod)
  - `name`: string, min 1 char
  - `email`: valid email, normalized
  - `password`: min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special char (`@$!%*?&`)
- **Behavior:** Hashes password via bcrypt (10 rounds), creates User with `isEmailVerified: false`. Returns 201 with user profile (excluding password).

### 2. `POST /auth/login`
- **Rate Limit:** 10 requests per 15 minutes
- **Validation:** `loginSchema` (Zod)
- **Behavior:**
  - Compares credentials using constant-time comparison.
  - Returns generic 401 `"Invalid Credentials"` on wrong email OR wrong password (anti-enumeration).
  - Enforces email verification: returns 403 `"Please verify your email"` if `isEmailVerified === false`.
  - On success: Generates token pair, stores SHA-256 refresh token hash in PostgreSQL, sets httpOnly cookie, returns `accessToken`.

### 3. `POST /auth/send-otp`
- **Rate Limit:** 5 requests per 15 minutes
- **Validation:** `sendOtpSchema` (Zod)
- **Behavior:** Generates a secure 6-digit numeric OTP, saves `otp:${email}` in Redis with 10-minute TTL, and sends transactional email via SMTP.

### 4. `POST /auth/verify-otp`
- **Rate Limit:** 10 requests per 15 minutes
- **Validation:** `verifyOtpSchema` (Zod)
- **Behavior:** Validates OTP from Redis. If matched, updates `User.isEmailVerified = true` in PostgreSQL and deletes the Redis OTP key.

### 5. `POST /auth/forgot-password`
- **Rate Limit:** 5 requests per 15 minutes
- **Validation:** `forgotPasswordSchema` (Zod)
- **Behavior:**
  - Anti-enumeration: Always returns 200 `"If this email is registered, a password reset link has been sent"`.
  - If user exists: Generates 32-byte crypto hex token, stores `reset_token:<sha256(token)>` $\rightarrow$ `userId` in Redis with 15-minute TTL.
  - Emails the reset token to the user.

### 6. `POST /auth/reset-password`
- **Validation:** `resetPasswordSchema` (Zod)
  - `token`: required string
  - `newPassword`: validated against strong password rules
- **Behavior:**
  - Hashes provided token and looks up `reset_token:<hash>` in Redis.
  - Hashes new password with bcrypt and updates `User.password` in PostgreSQL.
  - Deletes the reset token from Redis.
  - Deletes all existing refresh tokens for the user in PostgreSQL, terminating all existing sessions and forcing re-login.

### 7. `POST /auth/logout`
- **Auth:** Bearer Token required
- **Behavior:**
  - Deletes all refresh tokens belonging to the user from PostgreSQL.
  - Calculates remaining lifetime of current access token (`exp - now`) and writes `SET blacklist:<accessToken> "1" EX <remainingSeconds>` in Redis.
  - Clears `refreshToken` cookie.

### 8. `POST /auth/refresh-token`
- **Auth:** `refreshToken` httpOnly cookie
- **Behavior:** Verifies JWT, matches SHA-256 hash in DB, rotates token, sets new cookie, and returns new `accessToken`.

### 9. `GET /auth/me`
- **Auth:** Bearer Token required
- **Behavior:** Returns sanitized user profile: `{ id, name, email, isEmailVerified, role, createdAt }`.
