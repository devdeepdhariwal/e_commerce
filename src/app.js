import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js";
import categoryRoutes from "./routes/categories.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import addressRoutes from "./routes/address.routes.js";
import orderRoutes from "./routes/order.routes.js";
import { webhookHandler } from "./controllers/webhook.controller.js";
import errorHandler from "./middlewares/errorHandler.js";
import cookieParser from "cookie-parser";
import logger from "./config/logger.js";
import { mountSwagger } from "./swagger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Security headers — relaxed CSP so the UI page and Google Fonts work
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
      },
    },
  })
);

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: true,
}));

// Morgan HTTP request logging → piped through Winston
const morganStream = { write: (message) => logger.http(message.trim()) };
app.use(morgan("combined", { stream: morganStream }));

// Parsers
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Razorpay webhook needs raw body BEFORE express.json()
app.post("/webhooks/razorpay", express.raw({ type: "application/json" }), webhookHandler);

app.use(express.json());

// Serve static UI from public/
app.use(express.static(path.join(__dirname, "..", "public")));

// Routes
app.use("/auth", authRoutes);
app.use("/products", productRoutes);
app.use("/categories", categoryRoutes);
app.use("/cart", cartRoutes);
app.use("/addresses", addressRoutes);
app.use("/orders", orderRoutes);

// Swagger docs at /docs (CSP override handled inside mountSwagger)
mountSwagger(app);

// Global error handler
app.use(errorHandler);

export default app;