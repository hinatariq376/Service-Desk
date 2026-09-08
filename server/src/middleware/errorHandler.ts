import type { Request, Response, NextFunction } from "express";
import { logger } from "../observability/logger.js";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const statusCode = err.statusCode || 500;
  const code = err.code || (statusCode === 500 ? "INTERNAL_SERVER_ERROR" : "ERROR");
  const message = err.message || "An unexpected error occurred.";

  logger.error(
    {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      statusCode,
      code,
      err: err.stack || err,
    },
    `Request Error: ${message}`
  );

  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: statusCode === 500 && process.env.NODE_ENV === "production" ? "An unexpected server error occurred." : message,
    },
    requestId: req.id,
  });
}
