# ⚙️ Function Documentation

> Only non-trivial functions with meaningful logic are documented here.

---

## 1. `generateSlug(name)`

| Detail | Value |
|---|---|
| **File** | `src/services/product.service.js` |
| **Purpose** | Convert a product name into a URL-friendly slug |
| **Input** | `name` (String) — raw product name |
| **Output** | String — lowercase, hyphenated slug |

**Internal Logic:**
1. Convert to lowercase
2. Trim whitespace
3. Remove all non-word, non-space, non-hyphen characters (`/[^\w\s-]/g`)
4. Replace spaces with single hyphens (`/\s+/g → "-"`)
5. Collapse consecutive hyphens (`/-+/g → "-"`)

**Example:** `"Nike Air Max 90!"` → `"nike-air-max-90"`

**Why It Matters:** SEO-friendly URLs improve discoverability. The function also enables unique slug enforcement, preventing duplicate product entries.

---

## 2. `registeruser({ name, email, password })`

| Detail | Value |
|---|---|
| **File** | `src/services/auth.service.js` |
| **Purpose** | Create a new user account with hashed password |
| **Input** | Object with `name`, `email`, `password` |
| **Output** | User object (id, name, email only — password excluded) |

**Internal Logic:**
1. Normalize email: `trim()` + `toLowerCase()`
2. Check for existing user via `prisma.user.findUnique({ email })`
3. If exists → throw `AppError("User Already Exists", 409)`
4. Hash password with bcrypt (10 salt rounds)
5. Create user via `prisma.user.create()` with `select` to exclude password from return
6. Return safe user object

**Why It Matters:** Demonstrates defense-in-depth — email normalization prevents duplicate accounts with case variations; password never leaves the service layer unhashed; response never includes password hash.

---

## 3. `loginUser({ email, password })`

| Detail | Value |
|---|---|
| **File** | `src/services/auth.service.js` |
| **Purpose** | Verify credentials and return user data |
| **Input** | Object with `email`, `password` |
| **Output** | User object without password field |

**Internal Logic:**
1. Normalize email
2. Find user by email → if not found, throw `AppError("Invalid Credentials", 401)`
3. Compare password with bcrypt → if mismatch, throw same generic error
4. Destructure to remove password: `const { password: _, ...safeUser } = user`
5. Return `safeUser`

**Why It Matters:** Uses identical error messages for "user not found" and "wrong password" — this is a deliberate security pattern to prevent user enumeration attacks.

---

## 4. `refreshToken(req, res, next)` — Controller

| Detail | Value |
|---|---|
| **File** | `src/controllers/auth.controller.js` |
| **Purpose** | Implement secure refresh token rotation |
| **Input** | HTTP request with `refreshToken` cookie |
| **Output** | New access token in JSON + new refresh token in cookie |

**Internal Logic:**
1. Read raw refresh token from `req.cookies.refreshToken`
2. If missing → `AppError("Refresh token missing", 401)`
3. Verify JWT signature → catch failures as "Invalid or expired"
4. SHA-256 hash the raw token → lookup hash in Token table
5. If not found → `AppError("Invalid refresh token", 401)` (token reuse detected)
6. If expired → delete record + return error
7. **Rotation:** Delete old token record → generate new refresh token → hash → store new record
8. Fetch full user data → generate new access token
9. Set new refresh token cookie + return new access token

**Why It Matters:** This is the most security-critical function in the application. It implements refresh token rotation (RFC best practice), preventing token replay attacks. Each refresh token is single-use — if an attacker replays a stolen token after the legitimate user has refreshed, the lookup in step 4 fails.

---

## 5. `getProducts(filters, options)`

| Detail | Value |
|---|---|
| **File** | `src/services/product.service.js` |
| **Purpose** | Query products using MongoDB Atlas Search with pagination |
| **Input** | `filters` (name, category, minPrice, maxPrice), `options` (page, limit) |
| **Output** | `{ products, totalCount }` |

**Internal Logic:**
1. Build three clause arrays: `mustClauses`, `shouldClauses`, `filterClauses`
2. If `name` provided → add fuzzy text search to `shouldClauses` (maxEdits: 1)
3. If `category` provided → add exact match to `filterClauses`
4. If `minPrice`/`maxPrice` provided → add range filter (uses spread to handle partial ranges)
5. Always add `must` clause: `isActive === true`
6. Build aggregation pipeline: `$search` → `$skip` → `$limit`
7. Execute pipeline + separate `countDocuments` for total
8. Return both results

**Why It Matters:** Demonstrates Atlas Search integration — far more powerful than basic regex queries. The fuzzy matching handles typos, and the compound query structure supports complex multi-field filtering.

---

## 6. `authMiddleware(req, res, next)`

| Detail | Value |
|---|---|
| **File** | `src/middlewares/auth.middleware.js` |
| **Purpose** | Verify JWT access token and attach user to request |
| **Input** | HTTP request with `Authorization: Bearer <token>` header |
| **Output** | Sets `req.user` with decoded JWT payload, calls `next()` |

**Internal Logic:**
1. Extract `Authorization` header → validate `Bearer ` prefix
2. Split to get token → `jwt.verify()` with `ACCESS_TOKEN_SECRET`
3. On success → `req.user = decoded` (contains `userId`, `role`) → `next()`
4. On `TokenExpiredError` → 401 with "Token expired"
5. On other errors → 401 with "Invalid token"

**Why It Matters:** The gateway function for all protected routes. Differentiates between expired tokens (client should refresh) and invalid tokens (client should re-login).

---

## 7. `authorise(requiredRole)`

| Detail | Value |
|---|---|
| **File** | `src/middlewares/authorise.js` |
| **Purpose** | Higher-order function that returns role-checking middleware |
| **Input** | `requiredRole` (String) — the role required for access |
| **Output** | Express middleware function |

**Internal Logic:**
1. Returns a closure that captures `requiredRole`
2. Inner function checks `req.user` exists → if not, 401
3. Compares `req.user.role` with `requiredRole` → if mismatch, 403
4. If matched → `next()`

**Why It Matters:** Elegant use of closures to create reusable, configurable middleware. Usage: `authorise("ADMIN")` returns a middleware that only allows admins.

---

## 8. `errorHandler(err, req, res, next)`

| Detail | Value |
|---|---|
| **File** | `src/middlewares/errorHandler.js` |
| **Purpose** | Centralized error handling with operational vs. unexpected distinction |
| **Input** | Error object, Express req/res/next |
| **Output** | JSON error response |

**Internal Logic:**
1. Extract `statusCode` (default 500) and `message` (default "something went wrong")
2. If `err.isOperational === true` → return structured error with correct status code
3. If not operational:
   - Development mode → include full error object + stack trace
   - Production mode → generic "Internal server error" (500)

**Why It Matters:** Critical for both security (never leak stack traces in production) and DX (full debug info in development). The `isOperational` flag from `AppError` distinguishes "expected" errors (404, 409) from bugs.
