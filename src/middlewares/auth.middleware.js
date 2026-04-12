import jwt from "jsonwebtoken";

const authMiddleware = (req, res, next) => {

  // STEP 1 — Extract token
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: No token provided"
    });
  }

  const token = authHeader.split(" ")[1]; // "Bearer token" → ["Bearer", "token"]

  // STEP 2 — Verify token
  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    req.user = decoded; // attach user info to request

    next();

  } catch (error) {

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired"
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid token"
    });
  }
};

export default authMiddleware;