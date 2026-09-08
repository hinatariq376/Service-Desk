import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, type TokenPayload } from "../services/authService.js";
import type { UserRole } from "../models/User.js";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication token missing or invalid",
      },
      requestId: req.id,
    });
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: {
        code: "INVALID_TOKEN",
        message: err.name === "TokenExpiredError" ? "Authentication token has expired" : "Invalid authentication token",
      },
      requestId: req.id,
    });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
        requestId: req.id,
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: `Access denied. Requires one of: ${roles.join(", ")}`,
        },
        requestId: req.id,
      });
    }

    next();
  };
}
