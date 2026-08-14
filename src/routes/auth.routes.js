import express from "express";
import rateLimit from "express-rate-limit";
import { register, login, refreshToken, getMe, logout,sendOtp,verifyOtp } from "../controllers/auth.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import redis from "../config/redis.js";
import RedisStore from "rate-limit-redis";
const isTest = process.env.VITEST === "true";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many login attempts, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,

  store : new RedisStore({
    sendCommand : (...args) => redis.call(...args),
    prefix : "r1:login:"
  })
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: "Too many accounts created, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,

  store : new RedisStore({
  sendCommand : (...args) => redis.call(...args),
  prefix : "r1:register:"
  })
});

const verifyOtpLimiter = rateLimit({
 windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many accounts created, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,

  store : new RedisStore({
  sendCommand : (...args) => redis.call(...args),
  prefix : "r1:verify-otp:"
  })
});

const sendOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: "Too many accounts created, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,

  store : new RedisStore({
  sendCommand : (...args) => redis.call(...args),
  prefix : "r1:send-otp:"
  })
})



const router = express.Router();
router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);
router.post("/refresh-token", refreshToken);
router.get("/me", authMiddleware, getMe);
router.post("/logout", authMiddleware, logout);
router.post("/send-otp",sendOtpLimiter,sendOtp);
router.post("/verify-otp",verifyOtpLimiter,verifyOtp)

export default router;