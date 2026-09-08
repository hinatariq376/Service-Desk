import type { Request, Response, NextFunction } from "express";
import * as ticketService from "../services/ticketService.js";

export async function getTickets(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await ticketService.fetchTickets(req.user!, req.query as any);
    res.status(200).json({
      success: true,
      data: result,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
}

export async function createTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const ticket = await ticketService.createTicket(req.user!, req.body);
    res.status(201).json({
      success: true,
      data: { ticket },
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
}

export async function getTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const ticket = await ticketService.getTicketById(req.params.id, req.user!);
    res.status(200).json({
      success: true,
      data: { ticket },
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const ticket = await ticketService.updateTicketPriority(req.params.id, req.body.priority, req.user!);
    res.status(200).json({
      success: true,
      data: { ticket },
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const ticket = await ticketService.updateTicketStatus(req.params.id, req.body.status, req.user!);
    res.status(200).json({
      success: true,
      data: { ticket },
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
}

export async function assignTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const ticket = await ticketService.assignTicket(req.params.id, req.body.agentId, req.user!);
    res.status(200).json({
      success: true,
      data: { ticket },
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteTicket(req: Request, res: Response, next: NextFunction) {
  try {
    await ticketService.softDeleteTicket(req.params.id, req.user!);
    res.status(200).json({
      success: true,
      data: { message: "Ticket successfully deleted" },
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
}
