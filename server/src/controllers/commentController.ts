import type { Request, Response, NextFunction } from "express";
import * as commentService from "../services/commentService.js";

export async function addComment(req: Request, res: Response, next: NextFunction) {
  try {
    const comment = await commentService.addCommentToTicket(req.params.id, req.body, req.user!);
    res.status(201).json({
      success: true,
      data: { comment },
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
}

export async function getComments(req: Request, res: Response, next: NextFunction) {
  try {
    const comments = await commentService.fetchCommentsForTicket(req.params.id, req.user!);
    res.status(200).json({
      success: true,
      data: { comments },
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
}
