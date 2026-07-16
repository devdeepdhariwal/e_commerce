import express from "express";
import rateLimit from "express-rate-limit";
import { register, login, refreshToken, getMe, logout } from "../controllers/auth.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const isTest = process.env.VITEST === "true";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many login attempts, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: "Too many accounts created, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
});

const router = express.Router();
router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);
router.post("/refresh-token", refreshToken);
router.get("/me", authMiddleware, getMe);
router.post("/logout", authMiddleware, logout);

export default router;