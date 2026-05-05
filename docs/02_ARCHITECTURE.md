# 🏗 Implemented Architecture

## Request Lifecycle

Every HTTP request flows through a strict layered pipeline:

```
Client Request
     │
     ▼
┌──────────┐
│  Routes  │  Defines HTTP method + path → maps to controller
└────┬─────┘
     │
     ▼
┌──────────────┐
│  Middleware   │  Authentication (JWT verify), Authorization (role check)
└────┬─────────┘
     │
     ▼
┌──────────────┐
│  Controller  │  Parses req.body/params/query → calls service → sends res
└────┬─────────┘
     │
     ▼
┌──────────────┐
│   Service    │  Business logic, DB queries via Prisma/Mongoose
└────┬─────────┘
     │
     ▼
┌──────────────┐
│    Model     │  Schema definitions (Prisma for PG, Mongoose for Mongo)
└────┬─────────┘
     │
     ▼
┌──────────────┐
│  Database    │  PostgreSQL (Users/Tokens) + MongoDB (Products)
└──────────────┘
```

## Why This Architecture?

| Benefit | Explanation |
|---|---|
| **Separation of Concerns** | Each layer has a single responsibility. Controllers never touch the DB directly. |
| **Testability** | Services can be unit-tested without HTTP concerns. Controllers can be tested with mocked services. |
| **Scalability** | Adding a new module (Cart, Orders) means creating new route/controller/service/model files — zero changes to existing code. |
| **Error Isolation** | Errors thrown in services bubble up through controllers to the centralized error handler. |
| **Maintainability** | A developer can understand the system by reading any single layer in isolation. |

## Dual-Database Strategy

| Database | ORM/ODM | Used For | Rationale |
|---|---|---|---|
| PostgreSQL | Prisma v7 | Users, Tokens, Roles | Relational data with ACID transactions; ideal for auth and user management |
| MongoDB | Mongoose v9 | Products | Flexible schema for variants/images; Atlas Search for full-text queries |

This is a deliberate architectural decision — not accidental complexity. Each database is used where its strengths align with the data model requirements.

## Middleware Chain

```
express.json()          →  Parse JSON request bodies
express.urlencoded()    →  Parse URL-encoded form data
cookieParser()          →  Parse cookies (refresh tokens)
     │
     ├── /auth/*        →  Auth routes (some protected by authMiddleware)
     ├── /products/*    →  Product routes (write ops protected by authenticate + authorise)
     │
     └── errorHandler   →  Catches all errors, returns structured JSON responses
```

## Error Handling Flow

```
Service throws AppError("Product not found", 404)
     │
     ▼
Controller catches → calls next(error)
     │
     ▼
errorHandler middleware
     ├── isOperational: true  → Return { success: false, message } with correct statusCode
     └── isOperational: false → Development: full stack trace | Production: "Internal server error"
```

---

# 🔐 Authentication Module Documentation

## Overview

The authentication system implements a **dual-token strategy** with secure refresh token rotation. User data lives in PostgreSQL via Prisma. Tokens are SHA-256 hashed before storage.

### Security Architecture

```
┌─────────────────────────────────────────────────────┐
│                  TOKEN FLOW                         │
│                                                     │
│  Login → Generate Access Token (JWT, 15min)         │
│        → Generate Refresh Token (JWT, 7 days)       │
│        → SHA-256 hash refresh token                 │
│        → Store hash in PostgreSQL Token table       │
│        → Set refresh token as httpOnly cookie       │
│                                                     │
│  API Call → Send Access Token in Authorization hdr  │
│           → Middleware verifies JWT signature        │
│           → Attach decoded user to req.user          │
│                                                     │
│  Refresh → Read refresh token from httpOnly cookie  │
│          → Verify JWT signature                     │
│          → SHA-256 hash → lookup in Token table     │
│          → Delete old token (rotation)              │
│          → Generate new token pair                  │
│          → Store new hash, set new cookie           │
└─────────────────────────────────────────────────────┘
```

## API Endpoints

### POST `/auth/register`

**Purpose:** Create a new user account.

| Field | Details |
|---|---|
| **Method** | `POST` |
| **Auth Required** | No |
| **Content-Type** | `application/json` |

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecureP@ss1"
}
```

**Validation Rules:**
- All fields required (`name`, `email`, `password`)
- Password: min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special char (`@$!%*?&`)
- Email: normalized to lowercase, trimmed
- Duplicate email check (409 Conflict)

**Success Response (201):**
```json
{
  "message": "User registered successfully",
  "user": { "id": "uuid", "name": "John Doe", "email": "john@example.com" }
}
```

**Error Responses:**

| Code | Condition |
|---|---|
| 400 | Missing fields or weak password |
| 409 | Email already registered |

**Internal Flow:**
1. Controller validates presence of all fields
2. Password tested against regex
3. `auth.service.registeruser()` → normalizes email → checks uniqueness → bcrypt hashes password → `prisma.user.create()` → returns safe user (no password)

---

### POST `/auth/login`

**Purpose:** Authenticate user and issue token pair.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecureP@ss1"
}
```

**Success Response (200):**
```json
{
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIs..."
}
```
+ Sets `refreshToken` as httpOnly cookie (7-day expiry, Strict SameSite, Secure in production)

**Error Responses:**

| Code | Condition |
|---|---|
| 400 | Missing email or password |
| 401 | Invalid credentials (same message for wrong email OR wrong password — prevents enumeration) |

**Internal Flow:**
1. Controller validates presence of fields
2. `auth.service.loginUser()` → normalize email → find user → bcrypt compare → return user without password
3. Generate access token (15min, contains `userId` + `role`)
4. Generate refresh token (7d, contains `userId`)
5. SHA-256 hash refresh token → store in `Token` table with expiry
6. Set refresh token as httpOnly cookie

**Security Notes:**
- Same "Invalid Credentials" error for both wrong email and wrong password prevents user enumeration
- Refresh token is never stored in plaintext — only SHA-256 hash is persisted
- httpOnly cookie prevents XSS-based token theft

---

### POST `/auth/refresh-token`

**Purpose:** Rotate refresh token and issue new access token.

| Field | Details |
|---|---|
| **Auth Required** | No (uses cookie) |
| **Cookie Required** | `refreshToken` |

**Success Response (200):**
```json
{ "accessToken": "eyJhbGciOiJIUzI1NiIs..." }
```

**Internal Flow:**
1. Read `refreshToken` from cookie
2. Verify JWT signature (catch expired/invalid)
3. SHA-256 hash → look up in Token table
4. Check expiry → delete old token record
5. Generate new refresh token → hash → store
6. Generate new access token from user data
7. Set new cookie

**Security:** This implements **refresh token rotation** — each refresh token is single-use. If a stolen token is replayed after the legitimate user has refreshed, the lookup fails and access is denied.

---

### GET `/auth/me`

**Purpose:** Return current authenticated user's profile.

| Field | Details |
|---|---|
| **Auth Required** | Yes (`Bearer <accessToken>`) |
| **Middleware** | `authMiddleware` |

**Success Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "createdAt": "2026-04-28T...",
    "role": "CUSTOMER"
  }
}
```

**Internal Flow:**
1. `authMiddleware` extracts Bearer token → verifies JWT → attaches `req.user`
2. Controller reads `req.user.userId`
3. `auth.service.getUserById()` → Prisma query with safe `select` (excludes password)
