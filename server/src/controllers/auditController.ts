import type { Request, Response, NextFunction } from "express";
import * as auditService from "../services/auditService.js";

export async function getAuditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await auditService.fetchAuditTrail(req.query as any);
    res.status(200).json({
      success: true,
      data: result,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
}
