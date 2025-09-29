import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

// Request logging middleware
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const start = Date.now();

  // Log request
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    body: req.method !== "GET" ? JSON.stringify(req.body) : undefined,
  });

  // Log response when finished
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`, {
      statusCode: res.statusCode,
      duration,
    });
  });

  next();
};

// CORS middleware
export const corsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Allow all origins in development - in production, specify allowed origins
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }

  next();
};

// Response formatting middleware
export const responseFormatter = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Store original json method
  const originalJson = res.json;

  // Override json method to add consistent response format
  res.json = function (data: any) {
    // For API responses, ensure consistent structure
    if (req.url.startsWith("/chat") || req.url.startsWith("/health")) {
      return originalJson.call(this, data);
    }

    // For other responses, keep as is
    return originalJson.call(this, data);
  };

  next();
};

// Error handling middleware
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error("Unhandled error:", err);

  // Don't leak error details in production
  res.status(500).json({
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong",
  });
};
