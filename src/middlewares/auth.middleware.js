import jwt from "jsonwebtoken";
import redis from "../config/redis.js";
import AppError from "../utils/AppError.js";

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AppError("Unauthorized: No token provided", 401));
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const isBlacklisted = await redis.get("blacklist:" + token);
    if (isBlacklisted) {
      throw new AppError("Token has been invalidated", 401);
    }

    req.user = decoded;
    next();

  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(new AppError("Token expired", 401));
    }
    if (error.name === "JsonWebTokenError") {
      return next(new AppError("Invalid token", 401));
    }
    next(error);
  }
};

export default authMiddleware;