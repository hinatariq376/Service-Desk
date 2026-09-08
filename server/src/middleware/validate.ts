import type { Request, Response, NextFunction } from "express";
import { ZodError, type ZodSchema } from "zod";

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const issues = err.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: issues[0]?.message || "Request validation failed",
            details: issues,
          },
          requestId: req.id,
        });
      }
      next(err);
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const issues = err.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: issues[0]?.message || "Query parameter validation failed",
            details: issues,
          },
          requestId: req.id,
        });
      }
      next(err);
    }
  };
}
