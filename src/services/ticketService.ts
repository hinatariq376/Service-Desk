import { supabase } from "../lib/supabase";
import { cacheUsers, mapComment, mapAuditLog, mapTicket } from "../lib/mappers";
import { computeSLADeadlines, isSLABreached } from "../lib/sla";
import { validateTransition } from "../lib/stateMachine";
import { MOCK_TICKETS, MOCK_MESSAGES, MOCK_AUDIT_LOGS } from "../data/mockData";
import type { Message, Priority, Ticket, TicketStatus, User } from "../types";

async function loadUserDirectory() {
  try {
    const { data } = await supabase.from("users").select("*");
    if (data) cacheUsers(data);
  } catch (_) {}
}

export async function fetchTicketsForUser(user: User): Promise<Ticket[]> {
  try {
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
    if (data && data.length > 0) return data.map(mapTicket);
  } catch (_) {
    // Graceful fallback to mock data when network / database is offline
    if (user.role === "CUSTOMER") {
      return MOCK_TICKETS.filter((t) => t.customerId === user.id || t.customerId === "u1");
    }
    if (user.role === "SUPPORT_AGENT") {
      return MOCK_TICKETS.filter((t) => t.assignedAgentId === user.id || t.assignedAgentId === "u2" || !t.assignedAgentId);
    }
    return MOCK_TICKETS;
  }

  return user.role === "CUSTOMER"
    ? MOCK_TICKETS.filter((t) => t.customerId === user.id || t.customerId === "u1")
    : MOCK_TICKETS;
}

export async function fetchMessagesForTickets(ticketIds: string[]): Promise<Message[]> {
  if (ticketIds.length === 0) return [];

  try {
    await loadUserDirectory();

    const { data, error } = await supabase
      .from("ticket_comments")
      .select("*")
      .in("ticket_id", ticketIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    if (data && data.length > 0) return data.map((row) => mapComment(row));
  } catch (_) {
    return MOCK_MESSAGES.filter((m) => ticketIds.includes(m.ticketId));
  }

  return MOCK_MESSAGES.filter((m) => ticketIds.includes(m.ticketId));
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

  try {
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
    await loadUserDirectory();
    return mapTicket(data);
  } catch (_) {
    // Local mock ticket creation fallback
    const id = `TCK-${Math.floor(10000 + Math.random() * 90000)}`;
    const newTicket: Ticket = {
      id,
      displayId: id,
      title: partial.title,
      description: partial.description,
      category: partial.category,
      priority: partial.priority,
      status: "OPEN",
      customerId: user.id,
      customerName: user.name,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      slaDeadline: sla.slaDeadline,
      slaBreach: false,
      attachments: partial.attachments || [],
      tags: [],
    };
    MOCK_TICKETS.unshift(newTicket);
    return newTicket;
  }
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

  try {
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
    await loadUserDirectory();
    return { ticket: mapTicket(data) };
  } catch (_) {
    ticket.status = nextStatus;
    ticket.updatedAt = now;
    ticket.slaBreach = breached;
    return { ticket };
  }
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

  try {
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
    await loadUserDirectory();
    return { ticket: mapTicket(data) };
  } catch (_) {
    ticket.priority = priority;
    ticket.slaDeadline = sla.slaDeadline;
    return { ticket };
  }
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

  try {
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
    await loadUserDirectory();
    return { ticket: mapTicket(data) };
  } catch (_) {
    ticket.assignedAgentId = agentId;
    ticket.assignedAgentName = agentName;
    ticket.status = nextStatus;
    return { ticket };
  }
}

export async function addComment(
  user: User,
  ticketId: string,
  content: string,
  isInternal: boolean,
): Promise<Message> {
  try {
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
    await loadUserDirectory();
    return mapComment(data);
  } catch (_) {
    const newMsg: Message = {
      id: `m_${Date.now()}`,
      ticketId,
      authorId: user.id,
      authorName: user.name,
      authorRole: user.role,
      content,
      isInternal: isInternal && user.role !== "CUSTOMER",
      createdAt: new Date().toISOString(),
    };
    MOCK_MESSAGES.push(newMsg);
    return newMsg;
  }
}

export async function softDeleteTicket(
  user: User,
  ticketId: string,
): Promise<{ error?: string }> {
  if (user.role !== "ADMIN") {
    return { error: "Only administrators can delete tickets." };
  }

  try {
    const { error } = await supabase
      .from("tickets")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", ticketId);

    if (error) return { error: error.message };
  } catch (_) {
    const idx = MOCK_TICKETS.findIndex((t) => t.id === ticketId);
    if (idx !== -1) MOCK_TICKETS.splice(idx, 1);
  }
  return {};
}

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  try {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);
    if (data && data.length > 0) return data.map(mapAuditLog);
  } catch (_) {}
  return MOCK_AUDIT_LOGS;
}

export async function refreshSLABreaches(tickets: Ticket[]) {
  const overdue = tickets.filter((t) => isSLABreached(t.slaDeadline, t.slaBreach) && !t.slaBreach);
  try {
    await Promise.all(
      overdue.map((t) =>
        supabase.from("tickets").update({ sla_breach: true }).eq("id", t.id),
      ),
    );
  } catch (_) {}
}
