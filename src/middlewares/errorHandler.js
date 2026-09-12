import logger from "../config/logger.js";

const errorHandler = (err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  // Log 5xx errors with stack trace, 4xx as warnings
  if (statusCode >= 500) {
    logger.error(`${statusCode} ${message}`, {
      method: req.method,
      url: req.originalUrl,
      stack: err.stack,
    });
  } else {
    logger.warn(`${statusCode} ${message}`, {
      method: req.method,
      url: req.originalUrl,
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
};

export default errorHandler;