import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const reqId = (req.headers["x-request-id"] as string) || `req_${crypto.randomBytes(6).toString("hex")}`;
  req.id = reqId;
  res.setHeader("X-Request-Id", reqId);
  next();
}
