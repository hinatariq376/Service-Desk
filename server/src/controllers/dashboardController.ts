import type { Request, Response, NextFunction } from "express";
import * as dashboardService from "../services/dashboardService.js";

export async function getSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const summary = await dashboardService.getDashboardSummary(req.user!);
    res.status(200).json({
      success: true,
      data: summary,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const analytics = await dashboardService.getDashboardAnalytics(req.user!);
    res.status(200).json({
      success: true,
      data: analytics,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
}
