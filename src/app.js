import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
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

const app = express();

// Security headers
app.use(helmet());

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

// Routes
app.use("/auth", authRoutes);
app.use("/products", productRoutes);
app.use("/categories", categoryRoutes);
app.use("/cart", cartRoutes);
app.use("/addresses", addressRoutes);
app.use("/orders", orderRoutes);

// Global error handler
app.use(errorHandler);

export default app;