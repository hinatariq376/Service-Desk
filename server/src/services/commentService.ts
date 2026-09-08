import mongoose from "mongoose";
import { Comment, type IComment } from "../models/Comment.js";
import { Ticket } from "../models/Ticket.js";
import type { TokenPayload } from "./authService.js";
import { recordAuditLog } from "./auditService.js";
import { getIO } from "../events/socket.js";

export async function addCommentToTicket(
  ticketId: string,
  data: { content: string; isInternal?: boolean },
  user: TokenPayload
): Promise<IComment> {
  let ticket = null;
  if (mongoose.Types.ObjectId.isValid(ticketId)) {
    ticket = await Ticket.findOne({ _id: ticketId, deletedAt: null });
  }
  if (!ticket) {
    ticket = await Ticket.findOne({ displayId: ticketId, deletedAt: null });
  }

  if (!ticket) {
    const error = new Error("Ticket not found");
    (error as any).statusCode = 404;
    (error as any).code = "TICKET_NOT_FOUND";
    throw error;
  }

  // Customer cannot post internal notes
  const isInternal = user.role !== "CUSTOMER" && !!data.isInternal;

  const comment = new Comment({
    ticketId: ticket._id,
    authorId: new mongoose.Types.ObjectId(user.userId),
    authorName: user.name,
    authorRole: user.role,
    content: data.content,
    isInternal,
  });

  await comment.save();

  await recordAuditLog({
    actorId: user.userId,
    actorName: user.name,
    actorRole: user.role,
    action: isInternal ? "INTERNAL_NOTE_ADDED" : "COMMENT_ADDED",
    entityId: ticket.displayId,
    newValue: {
      commentId: comment._id.toString(),
      isInternal,
      author: user.name,
    },
  });

  // Real-time broadcast
  try {
    const io = getIO();
    io?.emit("ticket:comment_added", {
      eventId: `evt_${Date.now()}_comment_${comment._id}`,
      ticketId: ticket._id.toString(),
      displayId: ticket.displayId,
      comment,
    });
  } catch (_) {}

  return comment;
}

export async function fetchCommentsForTicket(
  ticketId: string,
  user: TokenPayload
): Promise<IComment[]> {
  let ticket = null;
  if (mongoose.Types.ObjectId.isValid(ticketId)) {
    ticket = await Ticket.findOne({ _id: ticketId, deletedAt: null });
  }
  if (!ticket) {
    ticket = await Ticket.findOne({ displayId: ticketId, deletedAt: null });
  }

  if (!ticket) {
    const error = new Error("Ticket not found");
    (error as any).statusCode = 404;
    (error as any).code = "TICKET_NOT_FOUND";
    throw error;
  }

  const filter: any = {
    ticketId: ticket._id,
    deletedAt: null,
  };

  // Customers cannot see internal notes
  if (user.role === "CUSTOMER") {
    filter.isInternal = false;
  }

  return Comment.find(filter).sort({ createdAt: 1 });
}
