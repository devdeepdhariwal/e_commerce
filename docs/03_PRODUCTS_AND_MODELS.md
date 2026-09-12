# 📦 Domain Modules & Data Models

---

## 1. Product Catalog Module

The product catalog is stored in MongoDB to provide elastic schema support for multi-variant products using an **Entity-Attribute-Value (EAV)** design pattern. It integrates with **MongoDB Atlas Search** for full-text fuzzy querying and **Redis** for HTTP response caching.

### Product Schema Features:
- **EAV Variant Modeling:** Every product has an array of `variants`, each containing a list of dynamic key-value attributes (e.g. `[{ name: "Color", value: "Red" }, { name: "Size", value: "XL" }]`), dedicated `sku`, `price`, and `stock`.
- **Category Hierarchy:** Products store their direct `categoryId` and materialized `categoryPath` array for subtree queries.
- **Dual Pagination:** Supports traditional offset pagination (`page`, `limit`) and high-performance cursor pagination (`cursor`, `limit`).
- **Response Caching:** Standard queries are cached in Redis (`cache:products`) with a 10-minute TTL. The cache is selectively bypassed if query filters are active, and purged whenever a product is created, updated, or deleted.

---

### Product Endpoints

#### `POST /products/`
- **Access:** Private (`ADMIN` only)
- **Validation:** `createProductSchema` (Zod)
- **Body:**
```json
{
  "name": "Men's Classic Cotton Crewneck",
  "description": "100% breathable organic cotton",
  "categoryId": "64f1a2b3c4d5e6f7a8b9c0d1",
  "images": ["https://cdn.example.com/products/shirt-red.jpg"],
  "variants": [
    {
      "sku": "TSHIRT-RED-M",
      "price": 799,
      "stock": 50,
      "attributes": [
        { "name": "Color", "value": "Red" },
        { "name": "Size", "value": "M" }
      ]
    }
  ],
  "isActive": true
}
```
- **Behavior:** Auto-generates unique SEO slug, verifies category path, stores product, and purges Redis product cache.

#### `GET /products/`
- **Access:** Public
- **Validation:** `productQuerySchema` (Zod)
- **Query Parameters:**
  - `page`: number (default: 1)
  - `limit`: number (default: 10, max: 100)
  - `cursor`: MongoDB ObjectId for cursor-based pagination
  - `name`: Text search with typo-tolerant fuzzy matching
  - `category`: Category slug/ID
  - `minPrice`, `maxPrice`: Price range filter
  - `attr_<Name>=<Value>`: Dynamic EAV variant attribute filter (e.g. `attr_Color=Red&attr_Size=M`)
- **Response Shape (Offset Mode):**
```json
{
  "success": true,
  "data": [ /* products */ ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```
- **Response Shape (Cursor Mode):**
```json
{
  "success": true,
  "data": [ /* products */ ],
  "pagination": {
    "nextCursor": "65b9f1...",
    "hasMore": true
  }
}
```

#### `GET /products/:slug`
- **Access:** Public
- **Behavior:** Returns single active product by SEO slug with full variant details.

#### `PUT /products/:id`
- **Access:** Private (`ADMIN` only)
- **Validation:** `updateProductSchema` (Zod)
- **Behavior:** Updates product fields and variants, regenerates slug if name changed, purges product cache.

#### `DELETE /products/:id`
- **Access:** Private (`ADMIN` only)
- **Behavior:** Deletes product document and invalidates product cache.

---

## 2. Category Hierarchy Module

Categories are organized as an arbitrary-depth tree in MongoDB using the **Materialized Path** pattern for fast ancestor and subtree lookups.

### Category Schema:
- `name`: Category label
- `slug`: Auto-generated unique slug
- `parentId`: Self-referencing ObjectId (or `null` for root categories)
- `path`: Array of ancestor `ObjectId`s `[rootId, parentId, selfId]`
- `isActive`: Boolean flag

### Category Endpoints:
- `POST /categories`: Admin creates category. Automatically constructs `path` by inheriting the parent's path. Purges `cache:categories`.
- `GET /categories`: Public. Cached in Redis (`cache:categories`, 30-min TTL). Returns all active categories.
- `DELETE /categories/:id`: Admin removes category. Prevents deletion if subcategories exist. Purges `cache:categories`.

---

## 3. Shopping Cart Module

The shopping cart is stored in Redis under key `cart:${userId}` with an automatic expiration (`CART_EXPIRES` seconds). Storing carts in Redis provides sub-millisecond read/write latency and leaves PostgreSQL/MongoDB free of high-frequency cart churn.

### Cart Item Structure (Redis):
```json
{
  "items": [
    {
      "productId": "64f1a2b3c4d5e6f7a8b9c0d1",
      "sku": "TSHIRT-RED-M",
      "quantity": 2,
      "price": 799,
      "name": "Men's Classic Cotton Crewneck",
      "image": "https://cdn.example.com/shirt.jpg"
    }
  ],
  "updatedAt": "2026-09-12T10:00:00.000Z"
}
```

### Cart Endpoints:
- `POST /cart/add`: Validates item, verifies product exists, is active, and the variant has sufficient stock before adding or incrementing quantity.
- `GET /cart`: Returns current cart items and computed subtotal.
- `POST /cart/revalidate`: **Pre-checkout safety check.** Compares each cart item against real-time MongoDB data. Checks if:
  1. Product was deleted or set `isActive: false` $\rightarrow$ item removed from cart.
  2. Variant price changed $\rightarrow$ updates cart item price and flags `pricesChanged: true`.
  3. Available stock is less than requested quantity $\rightarrow$ clamps quantity to available stock and flags `stockAdjusted: true`.
- `DELETE /cart/item/:productId/:sku`: Removes specific variant item from user's cart.
- `DELETE /cart`: Clears entire cart from Redis.

---

## 4. Shipping Address Module

User addresses are stored in PostgreSQL using Prisma, providing referential integrity to users and historical orders.

### Address Endpoints:
- `POST /addresses`: Creates a shipping address (validated via `createAddressSchema`: `fullName`, `phone`, `line1`, `line2`, `city`, `state`, `postalCode`, `country`).
- `GET /addresses`: Returns all saved addresses for the authenticated user.

---

## 5. Orders & Checkout Module

The order checkout workflow is engineered for high concurrency and financial consistency:

```
                      POST /orders/checkout
                                │
                                ▼
         Acquire Redis Concurrency Lock (SET NX EX 30)
         `checkout_lock:${userId}` (Prevents double clicks)
                                │
                                ▼
         Revalidate Cart against live MongoDB inventory
         (Abort if prices changed or items out of stock)
                                │
                                ▼
         Verify Shipping Address exists in PostgreSQL
                                │
                                ▼
         Atomic Stock Decrement Loop (MongoDB)
         `Product.updateOne({ "variants.stock": { $gte: qty } })`
                                │
              ┌─────────────────┴─────────────────┐
              ▼                                   ▼
         All Succeeded?                         Failed?
              │                                   │
              ▼                                   ▼
         Create Razorpay Order          Rollback previously deducted
         `amount in paise, currency`     stock in MongoDB & Throw 409
              │
              ▼
         Prisma $transaction (PostgreSQL)
         • Create `Order` (status: PENDING)
         • Create `OrderItem` records
         • Snapshot delivery address directly onto Order
              │
              ▼
         Release Redis Concurrency Lock
              │
              ▼
         Return Order & Razorpay credentials to client
```

### Order Endpoints:
- `POST /orders/checkout`: Executes locked checkout flow. Returns 201 with created Order and Razorpay payment details.
- `GET /orders`: Returns paginated list of user orders (`page`, `limit`) with line items.
- `GET /orders/:id`: Returns single order by UUID with payment and item breakdown.
- `POST /orders/:id/cancel`: Cancels an unpaid (`PENDING`) order, updates status to `CANCELLED`, and atomically restores product stock back into MongoDB.

---

## 6. Payments & Webhooks Module

### Razorpay Webhook Handler
- **Path:** `POST /webhooks/razorpay`
- **Security:** Mounts `express.raw({ type: "application/json" })` before standard body parsing to preserve exact payload bytes.
- **Verification:** Computes HMAC-SHA256 signature using `RAZORPAY_WEBHOOK_SECRET` and matches against `x-razorpay-signature` header.
- **Handling `payment.captured` / `order.paid`:**
  1. Finds `Order` via `razorpayOrderId`.
  2. Updates `Order.status = PAID`.
  3. Upserts `Payment` record with `razorpayPaymentId`, amount, and status `CAPTURED`.
  4. Automatically purges the user's active Redis cart.
  5. Completely **idempotent** — subsequent deliveries of the same webhook safely return 200 without duplicate processing.

---

## 🗄 Complete Data Model Reference

### 1. PostgreSQL Schema (Prisma ORM)

```prisma
enum ROLE {
  CUSTOMER 
  ADMIN
}

enum ORDER_STATUS {
  PENDING
  PAID
  CANCELLED
  FAILED
}

enum PAYMENT_STATUS {
  CREATED 
  CAPTURED
  FAILED
}

model User {
  id              String     @id @default(uuid())
  name            String
  email           String     @unique
  isEmailVerified Boolean    @default(false)
  password        String
  role            ROLE       @default(CUSTOMER)
  createdAt       DateTime   @default(now())
  tokens          Token[]
  addresses       Address[]
  orders          Order[]
}

model Token {
  id        Int      @id @default(autoincrement())
  userId    String
  tokenHash String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model Address {
  id         String   @id @default(uuid())
  userId     String
  fullName   String
  phone      String
  line1      String
  line2      String?
  city       String
  state      String
  postalCode String
  country    String
  createdAt  DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  orders     Order[]

  @@index([userId])
}

model Order {
  id              String       @id @default(uuid())
  userId          String
  addressId       String?
  status          ORDER_STATUS @default(PENDING)
  totalAmount     Decimal      @db.Decimal(10,2)
  razorpayOrderId String?      @unique
  shipFullName    String
  shipPhone       String
  shipLine1       String
  shipLine2       String?
  shipCity        String
  shipState       String
  shipPostalCode  String
  shipCountry     String
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  user            User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  address         Address?     @relation(fields: [addressId], references: [id], onDelete: SetNull)
  items           OrderItem[]
  payment         Payment?

  @@index([userId])
}

model OrderItem {
  id        String  @id @default(uuid())
  orderId   String  
  productId String
  sku       String
  name      String
  price     Decimal @db.Decimal(10,2)
  quantity  Int
  image     String?
  order     Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId])
}

model Payment {
  id                String         @id @default(uuid())
  orderId           String         @unique
  razorpayOrderId   String
  razorpayPaymentId String?        @unique
  status            PAYMENT_STATUS @default(CREATED)
  amount            Decimal        @db.Decimal(10,2)
  createdAt         DateTime       @default(now())
  order             Order          @relation(fields: [orderId], references: [id], onDelete: Cascade)
}
```

---

### 2. MongoDB Schema (Mongoose ODM)

#### `Category` Collection
```javascript
const categorySchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  slug:     { type: String, required: true, unique: true, lowercase: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "category", default: null },
  path:     [mongoose.Schema.Types.ObjectId],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

categorySchema.index({ isActive: 1, parentId: 1 });
```

#### `Product` Collection
```javascript
const attributeSchema = new mongoose.Schema({
  name:  { type: String, required: true },
  value: { type: String, required: true },
}, { _id: false });

const variantSchema = new mongoose.Schema({
  sku:        { type: String, required: true },
  price:      { type: Number, required: true, min: 0 },
  stock:      { type: Number, required: true, default: 0, min: 0 },
  attributes: { type: [attributeSchema], required: true, validate: v => v.length > 0 },
});

const productSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  slug:         { type: String, required: true, unique: true, lowercase: true },
  description:  { type: String, trim: true },
  categoryId:   { type: mongoose.Schema.Types.ObjectId, ref: "category", required: true },
  categoryPath: [mongoose.Schema.Types.ObjectId],
  images:       [String],
  variants:     { type: [variantSchema], required: true, validate: v => v.length > 0 },
  createdBy:    { type: String, required: true },
  isActive:     { type: Boolean, default: true },
}, { timestamps: true });

// Compound Indexes for fast querying
productSchema.index({ "variants.price": 1 });
productSchema.index({ isActive: 1, categoryPath: 1 });
productSchema.index({ "variants.attributes.name": 1, "variants.attributes.value": 1 });
```

---

### 3. Redis Key Namespaces

| Pattern | Type | TTL | Purpose |
|---|---|---|---|
| `cart:<userId>` | String (JSON) | `CART_EXPIRES` (e.g. 7 days) | Active shopping cart session |
| `checkout_lock:<userId>` | String | 30 seconds | Concurrency lock during checkout (`SET NX EX`) |
| `otp:<email>` | String | 10 minutes | 6-digit email verification code |
| `reset_token:<sha256(token)>` | String (`userId`) | 15 minutes | Single-use password reset authorization |
| `blacklist:<accessToken>` | String ("1") | Remaining JWT lifespan | Revoked access tokens after user logout |
| `cache:products` | String (JSON) | 10 minutes | Unfiltered products catalog response cache |
| `cache:categories` | String (JSON) | 30 minutes | Hierarchical category tree response cache |
| `r1:<action>:<ip>` | String (Integer) | 15 minutes | Distributed rate limit request counters |
