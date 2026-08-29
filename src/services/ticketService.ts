import { supabase } from "../lib/supabase";
import { cacheUsers, mapComment, mapAuditLog, mapTicket } from "../lib/mappers";
import { computeSLADeadlines, isSLABreached } from "../lib/sla";
import { validateTransition } from "../lib/stateMachine";
import type { Message, Priority, Ticket, TicketStatus, User } from "../types";

async function loadUserDirectory() {
  const { data } = await supabase.from("users").select("*");
  if (data) cacheUsers(data);
}

export async function fetchTicketsForUser(user: User): Promise<Ticket[]> {
  await loadUserDirectory();

  let query = supabase
    .from("tickets")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (user.role === "CUSTOMER") {
    query = query.eq("customer_id", user.id);
  } else if (user.role === "SUPPORT_AGENT") {
    query = query.or(`assigned_agent_id.eq.${user.id},assigned_agent_id.is.null`);
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
    .is("deleted_at", null)
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

  // Note: Audit log is automatically inserted via database trigger `trg_audit_ticket_changes`
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

  // Note: Audit log is automatically inserted via database trigger `trg_audit_ticket_changes`
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

  // Note: Audit log is automatically inserted via database trigger `trg_audit_ticket_changes`
  await loadUserDirectory();
  return { ticket: mapTicket(data) };
}

export async function assignTicketToAgent(
  admin: User,
  ticket: Ticket,
  agentId: string,
  _agentName: string,
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

  // Note: Audit log is automatically inserted via database trigger `trg_audit_ticket_changes`
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

  // Note: Audit log is automatically inserted via database trigger `trg_audit_ticket_comments`
  await loadUserDirectory();
  return mapComment(data);
}

export async function softDeleteTicket(
  user: User,
  ticketId: string,
): Promise<{ error?: string }> {
  if (user.role !== "ADMIN") {
    return { error: "Only administrators can delete tickets." };
  }

  const { error } = await supabase
    .from("tickets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", ticketId);

  if (error) return { error: error.message };
  return {};
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
