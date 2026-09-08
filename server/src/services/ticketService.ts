import mongoose from "mongoose";
import { Ticket, type ITicket, type TicketPriority, type TicketStatus } from "../models/Ticket.js";
import { User } from "../models/User.js";
import type { TokenPayload } from "./authService.js";
import { computeSLADeadlines, isSLABreached } from "./slaService.js";
import { validateTransition } from "./stateMachineService.js";
import { recordAuditLog } from "./auditService.js";
import { getIO } from "../events/socket.js";

function generateDisplayId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let random = "";
  for (let i = 0; i < 6; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TCK-${random}`;
}

export async function fetchTickets(
  user: TokenPayload,
  query: {
    status?: string;
    priority?: string;
    category?: string;
    search?: string;
    assignedAgentId?: string;
    customerId?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }
): Promise<{ tickets: ITicket[]; total: number; page: number; limit: number; totalPages: number }> {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, query.limit || 20);
  const skip = (page - 1) * limit;

  const filter: any = { deletedAt: null };

  // Strict Role-Based Isolation
  if (user.role === "CUSTOMER") {
    filter.customerId = new mongoose.Types.ObjectId(user.userId);
  } else if (user.role === "SUPPORT_AGENT") {
    filter.$or = [
      { assignedAgentId: new mongoose.Types.ObjectId(user.userId) },
      { assignedAgentId: null },
    ];
  }

  // Filter options
  if (query.status && query.status !== "ALL") {
    filter.status = query.status;
  }

  if (query.priority && query.priority !== "ALL") {
    filter.priority = query.priority;
  }

  if (query.category && query.category !== "ALL") {
    filter.category = query.category;
  }

  if (query.assignedAgentId) {
    filter.assignedAgentId =
      query.assignedAgentId === "unassigned"
        ? null
        : new mongoose.Types.ObjectId(query.assignedAgentId);
  }

  if (query.customerId && user.role === "ADMIN") {
    filter.customerId = new mongoose.Types.ObjectId(query.customerId);
  }

  if (query.search) {
    const s = query.search.trim();
    filter.$or = [
      { displayId: { $regex: s, $options: "i" } },
      { title: { $regex: s, $options: "i" } },
      { customerName: { $regex: s, $options: "i" } },
      { category: { $regex: s, $options: "i" } },
    ];
  }

  const sortField = query.sortBy || "createdAt";
  const sortDir = query.sortOrder === "asc" ? 1 : -1;
  const sortObj: any = { [sortField]: sortDir };

  const [tickets, total] = await Promise.all([
    Ticket.find(filter).sort(sortObj).skip(skip).limit(limit),
    Ticket.countDocuments(filter),
  ]);

  return {
    tickets,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function createTicket(
  user: TokenPayload,
  data: {
    title: string;
    description: string;
    category?: string;
    priority?: TicketPriority;
    tags?: string[];
    attachments?: string[];
  }
): Promise<ITicket> {
  const priority = data.priority || "MEDIUM";
  const now = new Date();
  const sla = computeSLADeadlines(priority, now);
  const displayId = generateDisplayId();

  const ticket = new Ticket({
    displayId,
    title: data.title,
    description: data.description,
    category: data.category || "General",
    priority,
    status: "OPEN",
    customerId: new mongoose.Types.ObjectId(user.userId),
    customerName: user.name,
    slaResponseDeadline: sla.slaResponseDeadline,
    slaResolutionDeadline: sla.slaResolutionDeadline,
    slaDeadline: sla.slaDeadline,
    slaBreach: false,
    tags: data.tags || [],
    attachments: data.attachments || [],
  });

  await ticket.save();

  await recordAuditLog({
    actorId: user.userId,
    actorName: user.name,
    actorRole: user.role,
    action: "TICKET_CREATED",
    entityId: ticket.displayId,
    newValue: {
      id: ticket._id.toString(),
      title: ticket.title,
      priority: ticket.priority,
      status: ticket.status,
    },
  });

  // Real-time broadcast
  try {
    const io = getIO();
    io?.emit("ticket:created", {
      eventId: `evt_${Date.now()}_${ticket.displayId}`,
      ticket,
    });
  } catch (_) {}

  return ticket;
}

export async function getTicketById(ticketId: string, user: TokenPayload): Promise<ITicket> {
  let ticket: ITicket | null = null;

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

  // Role validation
  if (user.role === "CUSTOMER" && ticket.customerId.toString() !== user.userId) {
    const error = new Error("Unauthorized to access this ticket");
    (error as any).statusCode = 403;
    (error as any).code = "FORBIDDEN";
    throw error;
  }

  // Update SLA breach flag if passed deadline
  if (!ticket.slaBreach && isSLABreached(ticket.slaDeadline)) {
    ticket.slaBreach = true;
    await ticket.save();
  }

  return ticket;
}

export async function updateTicketStatus(
  ticketId: string,
  nextStatus: TicketStatus,
  user: TokenPayload
): Promise<ITicket> {
  const ticket = await getTicketById(ticketId, user);
  const oldStatus = ticket.status;

  const validation = validateTransition(oldStatus, nextStatus, user.role);
  if (!validation.ok) {
    const error = new Error(validation.message);
    (error as any).statusCode = 400;
    (error as any).code = validation.code;
    throw error;
  }

  ticket.status = nextStatus;
  ticket.slaBreach = isSLABreached(ticket.slaDeadline, ticket.slaBreach);
  await ticket.save();

  await recordAuditLog({
    actorId: user.userId,
    actorName: user.name,
    actorRole: user.role,
    action: "STATUS_CHANGED",
    entityId: ticket.displayId,
    oldValue: { status: oldStatus },
    newValue: { status: nextStatus },
  });

  // Real-time broadcast
  try {
    const io = getIO();
    io?.emit("ticket:status_changed", {
      eventId: `evt_${Date.now()}_status_${ticket.displayId}`,
      ticketId: ticket._id.toString(),
      displayId: ticket.displayId,
      oldStatus,
      newStatus: nextStatus,
    });
  } catch (_) {}

  return ticket;
}

export async function updateTicketPriority(
  ticketId: string,
  priority: TicketPriority,
  user: TokenPayload
): Promise<ITicket> {
  if (user.role !== "ADMIN") {
    const error = new Error("Only administrators can update ticket priority");
    (error as any).statusCode = 403;
    (error as any).code = "FORBIDDEN";
    throw error;
  }

  const ticket = await getTicketById(ticketId, user);
  const oldPriority = ticket.priority;

  if (oldPriority === priority) return ticket;

  const sla = computeSLADeadlines(priority, ticket.createdAt);
  ticket.priority = priority;
  ticket.slaResponseDeadline = sla.slaResponseDeadline;
  ticket.slaResolutionDeadline = sla.slaResolutionDeadline;
  ticket.slaDeadline = sla.slaDeadline;
  ticket.slaBreach = isSLABreached(sla.slaDeadline);

  await ticket.save();

  await recordAuditLog({
    actorId: user.userId,
    actorName: user.name,
    actorRole: user.role,
    action: "PRIORITY_UPDATED",
    entityId: ticket.displayId,
    oldValue: { priority: oldPriority },
    newValue: { priority },
  });

  return ticket;
}

export async function assignTicket(
  ticketId: string,
  agentId: string,
  user: TokenPayload
): Promise<ITicket> {
  if (user.role !== "ADMIN") {
    const error = new Error("Only administrators can assign tickets");
    (error as any).statusCode = 403;
    (error as any).code = "FORBIDDEN";
    throw error;
  }

  const agent = await User.findById(agentId);
  if (!agent || agent.role !== "SUPPORT_AGENT") {
    const error = new Error("Target user must be an active support agent");
    (error as any).statusCode = 400;
    (error as any).code = "INVALID_AGENT";
    throw error;
  }

  const ticket = await getTicketById(ticketId, user);
  const oldAgentName = ticket.assignedAgentName || "Unassigned";

  ticket.assignedAgentId = agent._id;
  ticket.assignedAgentName = agent.name;

  if (ticket.status === "OPEN" || ticket.status === "TRIAGED") {
    ticket.status = "ASSIGNED";
  }

  await ticket.save();

  await recordAuditLog({
    actorId: user.userId,
    actorName: user.name,
    actorRole: user.role,
    action: "AGENT_ASSIGNED",
    entityId: ticket.displayId,
    oldValue: { assignedAgent: oldAgentName },
    newValue: { assignedAgent: agent.name },
  });

  // Real-time broadcast
  try {
    const io = getIO();
    io?.emit("ticket:assigned", {
      eventId: `evt_${Date.now()}_assign_${ticket.displayId}`,
      ticketId: ticket._id.toString(),
      displayId: ticket.displayId,
      agentId: agent._id.toString(),
      agentName: agent.name,
    });
  } catch (_) {}

  return ticket;
}

export async function softDeleteTicket(ticketId: string, user: TokenPayload): Promise<void> {
  if (user.role !== "ADMIN") {
    const error = new Error("Only administrators can delete tickets");
    (error as any).statusCode = 403;
    (error as any).code = "FORBIDDEN";
    throw error;
  }

  const ticket = await getTicketById(ticketId, user);
  ticket.deletedAt = new Date();
  await ticket.save();

  await recordAuditLog({
    actorId: user.userId,
    actorName: user.name,
    actorRole: user.role,
    action: "TICKET_SOFT_DELETED",
    entityId: ticket.displayId,
    oldValue: { active: true },
    newValue: { deletedAt: ticket.deletedAt },
  });
}
