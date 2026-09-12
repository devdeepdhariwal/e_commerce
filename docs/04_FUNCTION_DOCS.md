# ⚙️ Critical Function Documentation

> Comprehensive breakdown of mission-critical, non-trivial functions implementing core business rules, concurrency safety, and cryptographic security.

---

## 1. `checkout(userId, addressId)`

| Detail | Value |
|---|---|
| **File** | `src/services/order.service.js` |
| **Purpose** | Execute atomic, concurrency-safe checkout converting a Redis cart into a confirmed order |
| **Input** | `userId` (UUID string), `addressId` (UUID string) |
| **Output** | Object containing PostgreSQL `order` entity and `razorpayOrder` payload |

### Internal Logic:
1. **Concurrency Guard:** Sets Redis distributed lock `checkout_lock:${userId}` with `EX 30` and `NX` flag. If key already exists $\rightarrow$ throws `AppError("Checkout already in progress", 409)`.
2. **Cart Revalidation:** Invokes `revalidateCart(userId)`. If any prices changed, stock was adjusted, or items were removed $\rightarrow$ throws 409 requesting client re-confirmation.
3. **Address Verification:** Fetches shipping address from PostgreSQL confirming ownership by `userId`.
4. **Item Verification:** Loops through items, cross-referencing MongoDB product and variant data for price and quantity consistency.
5. **Atomic Stock Decrement Loop:** For each item, executes atomic MongoDB update:
   ```javascript
   Product.updateOne(
     { _id: line.productId, "variants.sku": line.sku, "variants.stock": { $gte: line.quantity } },
     { $inc: { "variants.$.stock": -line.quantity } }
   );
   ```
6. **Compensating Rollback:** If any single item update fails (`modifiedCount === 0`, indicating stock depletion during checkout), loops through all previously deducted items and increments their stock back:
   ```javascript
   Product.updateOne(
     { _id: item.productId, "variants.sku": item.sku },
     { $inc: { "variants.$.stock": item.quantity } }
   );
   ```
   Throws `AppError("Item out of stock", 409)`.
7. **Payment Order Creation:** Calls Razorpay SDK `orders.create({ amount, currency: "INR" })` (amount in paise).
8. **Prisma Relational Transaction:** Inside `prisma.$transaction`:
   - Creates `Order` record in `PENDING` state with full address snapshot fields.
   - Creates corresponding `OrderItem` records with unit price, SKU, name, and quantity.
9. **Lock Release:** Releases `checkout_lock:${userId}` in a `finally` block to guarantee unlock even if downstream calls fail.

**Why It Matters:** Prevents race conditions, avoids overselling under high concurrency, guarantees database inventory consistency across failures via manual compensating transactions, and captures a permanent immutable snapshot of the shipping address at the moment of order placement.

---

## 2. `revalidateCart(userId)`

| Detail | Value |
|---|---|
| **File** | `src/services/cart.service.js` |
| **Purpose** | Reconcile in-memory Redis cart items with current MongoDB product state |
| **Input** | `userId` (String) |
| **Output** | `{ cart, pricesChanged, stockAdjusted, removed }` |

### Internal Logic:
1. Retrieves raw cart JSON from `cart:${userId}` in Redis.
2. Iterates over every line item:
   - Queries MongoDB product: `Product.findById(item.productId)`.
   - If product is missing or `isActive === false` $\rightarrow$ removes item from cart and adds to `removed` list.
   - Locates variant by SKU. If variant not found $\rightarrow$ removes item.
   - If product price differs from cached cart price $\rightarrow$ updates cart item price, marks `pricesChanged = true`.
   - If requested quantity exceeds current available stock $\rightarrow$ clamps item quantity to available stock, marks `stockAdjusted = true`. (If stock is 0 $\rightarrow$ removes item).
3. If changes occurred $\rightarrow$ updates Redis cart and resets expiration timer.
4. Returns the sanitized cart and change status flags.

**Why It Matters:** Users often leave items in their cart for days. This function guarantees that checkouts never proceed with stale prices, deleted products, or quantities that exceed real inventory.

---

## 3. `handleRazorpayWebhook(rawBody, signature)`

| Detail | Value |
|---|---|
| **File** | `src/services/webhook.service.js` |
| **Purpose** | Validate Razorpay HMAC signature and settle order fulfillment |
| **Input** | `rawBody` (Buffer or raw string), `signature` (header value string) |
| **Output** | `{ received: true }` |

### Internal Logic:
1. Computes expected HMAC-SHA256 signature using `crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)` on the untouched raw payload.
2. Validates signatures using constant-time `crypto.timingSafeEqual` to prevent timing attacks.
3. If valid and event is `payment.captured` or `order.paid`:
   - Extracts `razorpayOrderId` and `razorpayPaymentId`.
   - Finds corresponding `Order` in PostgreSQL.
   - Updates `Order.status = "PAID"`.
   - Upserts `Payment` record with status `CAPTURED` and amount paid.
   - Purges user's shopping cart in Redis (`cart:${order.userId}`).
4. Completely idempotent: If order is already `PAID`, gracefully returns success.

**Why It Matters:** Secures revenue collection. Eliminates webhook spoofing attacks and ensures order payment status is settled reliably, even if user closes the browser before frontend redirection completes.

---

## 4. `getProducts(filters, options)`

| Detail | Value |
|---|---|
| **File** | `src/services/product.service.js` |
| **Purpose** | High-performance product catalog querying with Atlas Search, EAV filters, and dual pagination |
| **Input** | `filters` (name, category, minPrice, maxPrice, attributes), `options` (page, limit, cursor) |
| **Output** | `{ products, totalCount }` or `{ products, nextCursor, hasMore }` |

### Internal Logic:
1. **Dynamic Attribute Parser:** Extracts all `attr_<Name>=<Value>` query params and builds MongoDB match conditions for nested variant attributes:
   ```javascript
   "variants.attributes": { $all: [{ $elemMatch: { name, value } }] }
   ```
2. **Search Strategy Selection:**
   - If `name` or text query present $\rightarrow$ constructs MongoDB Atlas Search compound pipeline (`should` fuzzy text matching, `filter` category/price range, `must` `isActive: true`).
   - If standard catalog view $\rightarrow$ executes indexed Mongoose query with category subtree (`categoryPath: { $in: [...] }`) and price ranges.
3. **Pagination Mode:**
   - **Cursor Pagination:** If `cursor` is supplied $\rightarrow$ queries `{ _id: { $gt: cursor } }`, sorts `{ _id: 1 }`, and fetches `limit + 1` records to calculate `hasMore` and `nextCursor` without expensive `$skip` offsets.
   - **Offset Pagination:** Calculates `(page - 1) * limit` and queries total count.

**Why It Matters:** Enables high-speed catalog browsing across millions of SKUs with sub-second response times, flexible multi-faceted filtering, and scalable pagination.

---

## 5. `refreshToken(req, res, next)`

| Detail | Value |
|---|---|
| **File** | `src/controllers/auth.controller.js` |
| **Purpose** | Issue fresh credentials using single-use refresh token rotation |
| **Input** | Express request containing `refreshToken` httpOnly cookie |
| **Output** | New access token in JSON response and new rotated refresh token in cookie |

### Internal Logic:
1. Reads `refreshToken` from `req.cookies`. If missing $\rightarrow$ 401 Unauthorized.
2. Verifies cryptographic JWT signature against `REFRESH_TOKEN_SECRET`.
3. Hashes token using SHA-256 and searches PostgreSQL `Token` table.
4. If token hash is not found in database:
   - **Replay Attack Warning:** Old token was already used or forged $\rightarrow$ rejects request with 401.
5. Deletes used token record from PostgreSQL (`prisma.token.delete`).
6. Generates brand new refresh token (7-day validity) and new access token (15-minute validity).
7. Hashes new refresh token and writes new record to `Token` table.
8. Attaches new refresh token in `httpOnly`, `SameSite=Strict`, `Secure` cookie and returns new `accessToken`.

**Why It Matters:** Implements OAuth 2.0 / RFC 6749 best practices for refresh token rotation. If a refresh token is compromised and used by an attacker, the legitimate user's subsequent refresh attempt will fail, alerting the system to token theft.

---

## 6. `forgotPasswordService(email)` & `resetPasswordService(token, newPassword)`

| Detail | Value |
|---|---|
| **File** | `src/services/auth.service.js` |
| **Purpose** | Secure out-of-band password recovery with short-lived tokens and session invalidation |
| **Input** | `email` for forgot-password; `token` and `newPassword` for reset-password |
| **Output** | Success confirmation messages |

### Internal Logic:
- **Forgot Password:**
  1. Looks up user by normalized email.
  2. If user does not exist $\rightarrow$ returns generic success message immediately (prevents user enumeration).
  3. Generates 32-byte cryptographically secure random token (`crypto.randomBytes(32).toString("hex")`).
  4. Computes SHA-256 hash of token and stores in Redis: `SET reset_token:<hash> <userId> EX 900` (15-minute TTL).
  5. Sends raw token in transactional email via Nodemailer.
- **Reset Password:**
  1. Computes SHA-256 hash of provided token and looks up key `reset_token:<hash>` in Redis.
  2. If key does not exist or expired $\rightarrow$ throws `AppError("Invalid or expired reset token", 400)`.
  3. Hashes `newPassword` using bcrypt (10 rounds) and updates `User.password` in PostgreSQL.
  4. Deletes `reset_token:<hash>` from Redis.
  5. Deletes all active refresh tokens in PostgreSQL for this user (`prisma.token.deleteMany({ where: { userId } })`), immediately revoking all existing login sessions across all devices.

**Why It Matters:** Protects account recovery against replay, brute-force, and session hijacking by strictly scoping reset tokens to 15 minutes and invalidating all existing device sessions upon password change.

---

## 7. `logout(req, res, next)`

| Detail | Value |
|---|---|
| **File** | `src/controllers/auth.controller.js` |
| **Purpose** | Immediately revoke both refresh tokens and active access tokens |
| **Input** | Authenticated request with Bearer access token and httpOnly cookie |
| **Output** | 200 OK + cleared cookie |

### Internal Logic:
1. Deletes all user refresh token records from PostgreSQL.
2. Extracts raw access token from `Authorization: Bearer <token>` header.
3. Reads JWT `exp` timestamp and calculates remaining seconds: `Math.max(1, exp - Math.floor(Date.now() / 1000))`.
4. Writes token into Redis blacklist: `SET blacklist:<accessToken> "1" EX <remainingSeconds>`.
5. Clears `refreshToken` cookie on the client.

**Why It Matters:** In traditional stateless JWT authentication, tokens remain valid until expiration even after logout. This function solves the "instant revocation" problem by blacklisting access tokens in Redis for their remaining lifetime.

---

## 8. `validate(schema, source)`

| Detail | Value |
|---|---|
| **File** | `src/middlewares/validate.js` |
| **Purpose** | Reusable middleware wrapping Zod schemas with Express 5 getter compatibility |
| **Input** | `schema` (Zod schema), `source` ("body" \| "query" \| "params") |
| **Output** | Express middleware function |

### Internal Logic:
1. Executes `schema.safeParse(req[source])`.
2. If validation fails $\rightarrow$ aggregates error messages into semicolon-separated string and calls `next(new AppError(messages, 400))`.
3. In Express 5, `req.query` is defined with a prototype getter, causing direct assignment `req.query = parsedData` to throw a `TypeError`. The middleware uses safe property redefinition:
   ```javascript
   try {
     req[source] = result.data;
   } catch {
     Object.defineProperty(req, source, {
       value: result.data,
       writable: true,
       enumerable: true,
       configurable: true,
     });
   }
   ```
4. Proceeds to `next()`.

**Why It Matters:** Guarantees strict runtime validation and type coercion across all input channels while ensuring 100% compatibility with Express 5 request prototype behaviors.
