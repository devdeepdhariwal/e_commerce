# 🛒 E-Commerce Industry — Backend API

> A production-grade RESTful E-Commerce Backend demonstrating professional backend engineering with dual-database architecture, secure JWT authentication, and MongoDB Atlas Search.

![Tests](https://github.com/devdeepdhariwal/e_commerce/actions/workflows/test.yml/badge.svg)
![Status](https://img.shields.io/badge/Status-In%20Development-yellow)
![Node.js](https://img.shields.io/badge/Node.js-ES%20Modules-339933?logo=node.js)
![Express](https://img.shields.io/badge/Express-v5-000000?logo=express)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma%20v7-4169E1?logo=postgresql)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose%20v9-47A248?logo=mongodb)

---

## 📊 Development Status

| Module | Status | Description |
|---|---|---|
| Authentication | ✅ Completed | Register, Login, Token Rotation, RBAC |
| Product Management | ✅ Completed | Full CRUD, Atlas Search, Pagination, Slugs |
| Cart | 🔲 Planned | — |
| Orders | 🔲 Planned | — |
| Payments | 🔲 Planned | — |

## 🏗 Architecture

```
Route → Middleware → Controller → Service → Model → Database
```

**Dual-Database Strategy:**
- **PostgreSQL** (Prisma) — Users, Tokens, Roles
- **MongoDB** (Mongoose) — Products, Search

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env  # Configure your DB URLs and secrets

# Run Prisma migrations
npx prisma migrate dev

# Seed products (optional)
node src/seedProduct.js

# Start development server
npm run dev
```

## 📖 Documentation

Full documentation is organized in the [`docs/`](./docs/) directory:

| Document | Contents |
|---|---|
| [01_PROJECT_OVERVIEW.md](./docs/01_PROJECT_OVERVIEW.md) | Project overview, tech stack, folder structure |
| [02_ARCHITECTURE.md](./docs/02_ARCHITECTURE.md) | Architecture deep-dive, Auth module API docs |
| [03_PRODUCTS_AND_MODELS.md](./docs/03_PRODUCTS_AND_MODELS.md) | Product API docs, database schemas |
| [04_FUNCTION_DOCS.md](./docs/04_FUNCTION_DOCS.md) | Detailed function documentation |
| [05_REVIEW_AND_ROADMAP.md](./docs/05_REVIEW_AND_ROADMAP.md) | Code review, portfolio value, roadmap, changelog |

## 📬 API Overview

### Auth Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | No | Create account |
| POST | `/auth/login` | No | Login + get tokens |
| POST | `/auth/refresh-token` | Cookie | Rotate refresh token |
| GET | `/auth/me` | Bearer | Get current user |

### Product Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/products/` | Admin | Create product |
| GET | `/products/` | No | List + search + filter |
| GET | `/products/:slug` | No | Get by slug |
| PUT | `/products/:id` | Admin | Update product |
| DELETE | `/products/:id` | Admin | Delete product |

---

## 🧪 Testing

**36 integration tests** covering the full API using [Vitest](https://vitest.dev/) + [Supertest](https://github.com/visionmedia/supertest).

```bash
npm test           # Run all tests
npm run test:watch # Watch mode
```

| Module | Tests | What's Covered |
|---|---|---|
| Auth - Register | 4 | Success, missing fields, weak password, duplicate email |
| Auth - Login | 4 | Success + cookie, wrong password, non-existent user, missing fields |
| Auth - Get Me | 3 | Valid token, no token, invalid token |
| Auth - Refresh | 3 | Token rotation, missing cookie, reuse prevention |
| Auth - Logout | 2 | Success + token blacklisting |
| Products - Create | 5 | Admin CRUD, no auth (401), customer (403), validation, duplicate slug |
| Products - Read | 7 | Pagination, limit, category filter, price range, slug lookup, 404 |
| Products - Update | 4 | Partial update, RBAC (403/401), non-existent (404) |
| Products - Delete | 4 | RBAC (403/401), success, already-deleted (404) |

---

<p align="center"><em>Built with ❤️ as a portfolio project — April 2026</em></p>
