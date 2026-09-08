import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { config } from "./config/index.js";
import { logger } from "./observability/logger.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { errorHandler } from "./middleware/errorHandler.js";
import apiRouter from "./routes/index.js";

export function createApp(): Express {
  const app = express();

  // 1. Security Headers
  app.use(helmet());

  // 2. CORS configuration
  app.use(
    cors({
      origin: config.corsOrigin === "*" ? true : config.corsOrigin,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    })
  );

  // 3. Request parsing
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // 4. Request ID & Observability Logging
  app.use(requestIdMiddleware);
  if (config.nodeEnv !== "test") {
    app.use(
      pinoHttp({
        logger,
        genReqId: (req) => (req as any).id,
        customLogLevel: (_req, res, err) => {
          if (res.statusCode >= 500 || err) return "error";
          if (res.statusCode >= 400) return "warn";
          return "info";
        },
      })
    );
  }

  // 5. Rate Limiting for production security
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests, please try again later.",
      },
    },
  });
  app.use("/api/", apiLimiter);

  // 6. Health & Metrics Endpoint
  app.get("/health", (_req, res) => {
    res.status(200).json({
      success: true,
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // 7. API Routes v1
  app.use("/api/v1", apiRouter);

  // 8. 404 Route Handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: "ROUTE_NOT_FOUND",
        message: `Route ${req.method} ${req.originalUrl} not found`,
      },
      requestId: req.id,
    });
  });

  // 9. Centralized Error Handler
  app.use(errorHandler);

  return app;
}
