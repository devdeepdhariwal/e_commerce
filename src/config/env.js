import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  // PostgreSQL
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // MongoDB
  MONGODB_URL: z.string().min(1, "MONGODB_URL is required"),

  // Redis
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  // JWT
  ACCESS_TOKEN_SECRET: z.string().min(16, "ACCESS_TOKEN_SECRET must be at least 16 characters"),
  REFRESH_TOKEN_SECRET: z.string().min(16, "REFRESH_TOKEN_SECRET must be at least 16 characters"),

  // Cart
  CART_EXPIRES: z.coerce.number().int().positive("CART_EXPIRES must be a positive integer"),

  // SMTP
  SMTP_HOST: z.string().min(1, "SMTP_HOST is required"),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().min(1, "SMTP_USER is required"),
  SMTP_PASS: z.string().min(1, "SMTP_PASS is required"),
  SMTP_FROM: z.string().email("SMTP_FROM must be a valid email"),

  // Razorpay (optional in dev, required in production)
  RAZORPAY_KEY_ID: z.string().default(""),
  RAZORPAY_KEY_SECRET: z.string().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(""),

  // CORS
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`   ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;
export default env;
