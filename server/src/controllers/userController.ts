import type { Request, Response, NextFunction } from "express";
import { User } from "../models/User.js";

export async function getAllUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: { users },
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
}

export async function getSupportAgents(req: Request, res: Response, next: NextFunction) {
  try {
    const agents = await User.find({ role: "SUPPORT_AGENT" }).select("-password").sort({ name: 1 });
    res.status(200).json({
      success: true,
      data: { agents },
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
}
