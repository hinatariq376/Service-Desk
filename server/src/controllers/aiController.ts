import type { Request, Response, NextFunction } from "express";
import { aiService } from "../services/aiService.js";

export async function summarize(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, description, comments } = req.body;
    const summary = await aiService.summarizeTicket(title, description, comments);
    res.status(200).json({
      success: true,
      data: { summary },
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
}

export async function classify(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, description } = req.body;
    const result = await aiService.classifyTicket(title, description);
    res.status(200).json({
      success: true,
      data: result,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
}
