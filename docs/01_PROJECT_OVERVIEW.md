# 🛒 E-Commerce Industry — Backend API

> A production-grade RESTful E-Commerce Backend built with Node.js, Express 5, PostgreSQL (Prisma), and MongoDB (Mongoose). Designed to demonstrate professional backend engineering skills.

![Status](https://img.shields.io/badge/Status-In%20Development-yellow)
![Node](https://img.shields.io/badge/Node.js-ES%20Modules-green)
![License](https://img.shields.io/badge/License-ISC-blue)

---

## 📌 Purpose

This project serves as a **portfolio-grade backend system** showcasing:

- RESTful API design with layered architecture
- Dual-database strategy (PostgreSQL + MongoDB)
- Secure JWT authentication with refresh token rotation
- Role-based access control (RBAC)
- Full-text search via MongoDB Atlas Search
- Clean separation of concerns (Route → Middleware → Controller → Service → Model)

## 🎯 Skills Demonstrated

| Skill Area | Implementation |
|---|---|
| REST API Design | Resource-based routing, proper HTTP status codes |
| Authentication | JWT access/refresh tokens, SHA-256 hashing, httpOnly cookies |
| Authorization | Role-based middleware (ADMIN / CUSTOMER) |
| Database Design | Prisma ORM (PostgreSQL) + Mongoose ODM (MongoDB) |
| Search | MongoDB Atlas Search with fuzzy matching |
| Error Handling | Custom AppError class, centralized error handler |
| Architecture | Layered service pattern with separation of concerns |
| Security | Password regex validation, bcrypt hashing, token rotation |

## 📊 Current Development Status

> **Last Updated:** April 2026

| Module | Status | Notes |
|---|---|---|
| Authentication | ✅ Completed | Register, Login, Refresh Token, GetMe |
| Product Management | ✅ Completed | Full CRUD, Atlas Search, Pagination, Slugs |
| Cart | 🔲 Planned | — |
| Orders | 🔲 Planned | — |
| Payments | 🔲 Planned | — |
| Admin Dashboard | 🔲 Planned | — |
| Reviews & Ratings | 🔲 Planned | — |
| Wishlist | 🔲 Planned | — |
| Notifications | 🔲 Planned | — |

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Runtime | Node.js (ES Modules) | Server-side JavaScript |
| Framework | Express.js v5 | HTTP routing and middleware |
| Auth DB | PostgreSQL + Prisma v7 | User accounts, tokens, RBAC |
| Product DB | MongoDB + Mongoose v9 | Product catalog, search |
| Authentication | JSON Web Tokens (jsonwebtoken) | Stateless auth |
| Password Security | bcrypt | Password hashing (salt rounds: 10) |
| Cookie Handling | cookie-parser | Secure httpOnly cookie management |
| Environment | dotenv | Environment variable management |
| Dev Server | nodemon | Hot-reload during development |
| Code Style | Prettier | Consistent formatting |

---

## 📁 Folder Structure

```
e_commerce_industry/
├── prisma/
│   ├── schema.prisma          # PostgreSQL schema (User, Token, Role enum)
│   └── migrations/            # 5 migration files tracking schema evolution
├── src/
│   ├── server.js              # Entry point — boots both DBs, starts Express
│   ├── app.js                 # Express app — middleware chain & route mounting
│   ├── config/
│   │   ├── db.js              # Prisma client (PostgreSQL via PrismaPg adapter)
│   │   └── mongodb.js         # Mongoose connection helper
│   ├── controllers/
│   │   ├── auth.controller.js # Auth request handlers (register, login, refresh, getMe)
│   │   └── product.controller.js # Product CRUD handlers
│   ├── services/
│   │   ├── auth.service.js    # Auth business logic (user CRUD, token ops)
│   │   └── product.service.js # Product logic (CRUD, slug gen, Atlas Search)
│   ├── middlewares/
│   │   ├── auth.middleware.js  # JWT verification middleware
│   │   ├── authorise.js       # Role-based authorization middleware
│   │   └── errorHandler.js    # Global error handler (operational vs unexpected)
│   ├── models/
│   │   └── product.model.js   # Mongoose schema for products
│   ├── routes/
│   │   ├── auth.routes.js     # /auth/* route definitions
│   │   └── product.routes.js  # /products/* route definitions
│   ├── utils/
│   │   ├── AppError.js        # Custom error class with statusCode & isOperational
│   │   ├── hash.js            # bcrypt hash & compare wrappers
│   │   └── token.js           # JWT access & refresh token generators
│   └── seedProduct.js         # Seed script — generates 100 randomized products
├── package.json
├── prisma.config.ts
└── .gitignore
```

### Responsibility Map

| Directory | Responsibility |
|---|---|
| `config/` | Database connections and client initialization |
| `controllers/` | HTTP layer — parse requests, call services, send responses |
| `services/` | Business logic — data validation, DB queries, error throwing |
| `middlewares/` | Cross-cutting concerns — auth, authorization, error handling |
| `models/` | Mongoose schemas (MongoDB collections) |
| `routes/` | Route definitions mapping HTTP methods to controllers |
| `utils/` | Reusable helpers — error class, hashing, token generation |
