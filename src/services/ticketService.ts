import { supabase } from "../lib/supabase";
import { cacheUsers, formatTicketId, mapComment, mapAuditLog, mapTicket } from "../lib/mappers";
import { computeSLADeadlines, isSLABreached } from "../lib/sla";
import { validateTransition } from "../lib/stateMachine";
import { insertAuditLog } from "./auditService";
import type { Message, Priority, Role, Ticket, TicketStatus, User } from "../types";

async function loadUserDirectory() {
  const { data } = await supabase.from("users").select("*");
  if (data) cacheUsers(data);
}

export async function fetchTicketsForUser(user: User): Promise<Ticket[]> {
  await loadUserDirectory();

  let query = supabase.from("tickets").select("*").order("created_at", { ascending: false });

  if (user.role === "CUSTOMER") {
    query = query.eq("customer_id", user.id);
  } else if (user.role === "SUPPORT_AGENT") {
    query = query.eq("assigned_agent_id", user.id);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map(mapTicket);
}

export async function fetchMessagesForTickets(ticketIds: string[]): Promise<Message[]> {
  if (ticketIds.length === 0) return [];

  await loadUserDirectory();

  const { data, error } = await supabase
    .from("ticket_comments")
    .select("*")
    .in("ticket_id", ticketIds)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapComment(row));
}

export async function createTicket(
  user: User,
  partial: {
    title: string;
    description: string;
    category: string;
    priority: Priority;
    attachments?: string[];
  },
): Promise<Ticket> {
  const now = new Date();
  const sla = computeSLADeadlines(partial.priority, now);

  const { data, error } = await supabase
    .from("tickets")
    .insert({
      title: partial.title,
      description: partial.description,
      category: partial.category,
      priority: partial.priority,
      status: "OPEN",
      customer_id: user.id,
      sla_response_deadline: sla.slaResponseDeadline,
      sla_resolution_deadline: sla.slaResolutionDeadline,
      sla_deadline: sla.slaDeadline,
      sla_breach: false,
      attachments: partial.attachments ?? [],
      tags: [],
      updated_at: now.toISOString(),
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await insertAuditLog({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "TICKET_CREATED",
    entityId: formatTicketId(data.id),
    entityType: "Ticket",
    oldValue: {},
    newValue: { title: partial.title, priority: partial.priority, status: "OPEN" },
  });

  await loadUserDirectory();
  return mapTicket(data);
}

export async function updateTicketStatus(
  user: User,
  ticket: Ticket,
  nextStatus: TicketStatus,
): Promise<{ ticket?: Ticket; error?: string }> {
  const validation = validateTransition(ticket.status, nextStatus, user.role);
  if (!validation.ok) {
    return { error: validation.message };
  }

  const now = new Date().toISOString();
  const breached = isSLABreached(ticket.slaDeadline, ticket.slaBreach);

  const { data, error } = await supabase
    .from("tickets")
    .update({
      status: nextStatus,
      updated_at: now,
      sla_breach: breached,
    })
    .eq("id", ticket.id)
    .select("*")
    .single();

  if (error) return { error: error.message };

  await insertAuditLog({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "STATUS_CHANGED",
    entityId: formatTicketId(ticket.id),
    entityType: "Ticket",
    oldValue: { status: ticket.status },
    newValue: { status: nextStatus },
  });

  await loadUserDirectory();
  return { ticket: mapTicket(data) };
}

export async function updateTicketPriority(
  user: User,
  ticket: Ticket,
  priority: Priority,
): Promise<{ ticket?: Ticket; error?: string }> {
  if (user.role !== "ADMIN") {
    return { error: "Only administrators can change ticket priority." };
  }

  const sla = computeSLADeadlines(priority, new Date(ticket.createdAt));

  const { data, error } = await supabase
    .from("tickets")
    .update({
      priority,
      sla_response_deadline: sla.slaResponseDeadline,
      sla_resolution_deadline: sla.slaResolutionDeadline,
      sla_deadline: sla.slaDeadline,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticket.id)
    .select("*")
    .single();

  if (error) return { error: error.message };

  await insertAuditLog({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "PRIORITY_UPDATED",
    entityId: formatTicketId(ticket.id),
    entityType: "Ticket",
    oldValue: { priority: ticket.priority },
    newValue: { priority },
  });

  await loadUserDirectory();
  return { ticket: mapTicket(data) };
}

export async function assignTicketToAgent(
  admin: User,
  ticket: Ticket,
  agentId: string,
  agentName: string,
): Promise<{ ticket?: Ticket; error?: string }> {
  if (admin.role !== "ADMIN") {
    return { error: "Only administrators can assign tickets." };
  }

  const nextStatus: TicketStatus =
    ticket.status === "OPEN" || ticket.status === "TRIAGED" ? "ASSIGNED" : ticket.status;

  const { data, error } = await supabase
    .from("tickets")
    .update({
      assigned_agent_id: agentId,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticket.id)
    .select("*")
    .single();

  if (error) return { error: error.message };

  await insertAuditLog({
    actorId: admin.id,
    actorName: admin.name,
    actorRole: admin.role,
    action: "AGENT_ASSIGNED",
    entityId: formatTicketId(ticket.id),
    entityType: "Ticket",
    oldValue: { assigned_agent_id: ticket.assignedAgentId ?? null },
    newValue: { assigned_agent_id: agentId, assigned_agent: agentName },
  });

  await loadUserDirectory();
  return { ticket: mapTicket(data) };
}

export async function addComment(
  user: User,
  ticketId: string,
  content: string,
  isInternal: boolean,
): Promise<Message> {
  const { data, error } = await supabase
    .from("ticket_comments")
    .insert({
      ticket_id: ticketId,
      author_id: user.id,
      content,
      is_internal: isInternal && user.role !== "CUSTOMER",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await insertAuditLog({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: isInternal ? "INTERNAL_NOTE_ADDED" : "COMMENT_ADDED",
    entityId: formatTicketId(ticketId),
    entityType: "Ticket",
    newValue: { content: content.slice(0, 120) },
  });

  await loadUserDirectory();
  return mapComment(data);
}

export async function fetchAuditLogs(): Promise<import("../types").AuditLog[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapAuditLog);
}

export async function refreshSLABreaches(tickets: Ticket[]) {
  const overdue = tickets.filter((t) => isSLABreached(t.slaDeadline, t.slaBreach) && !t.slaBreach);
  await Promise.all(
    overdue.map((t) =>
      supabase.from("tickets").update({ sla_breach: true }).eq("id", t.id),
    ),
  );
}
