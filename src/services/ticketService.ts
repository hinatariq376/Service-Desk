import { supabase } from "../lib/supabase";

import type { AuditLog } from '../types'; 
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

function isValidUUID(str?: string | null): boolean {
  return Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));
}

export async function getTickets(userId?: string, userRole?: string): Promise<Ticket[]> {
  try {
    await loadUserDirectory();

    let query = supabase
      .from("tickets")
      .select("*")
      .or("is_deleted.is.null,is_deleted.eq.false")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    const normalizedRole = userRole?.toLowerCase();
    if (userRole === "customer" || normalizedRole === "customer") {
      query = query.eq("customer_id", userId);
    } else if (userRole === "support_agent" || normalizedRole === "support_agent") {
      if (userId) {
        query = query.or(`assigned_agent_id.eq.${userId},assigned_agent_id.is.null`);
      }
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    if (data) {
      const dbTickets = data.map(mapTicket);
      const localTickets = MOCK_TICKETS.filter(
        (t) =>
          !(t as any).isDeleted &&
          !(t as any).is_deleted &&
          (userRole === "customer" || normalizedRole === "customer"
            ? t.customerId === userId
            : true) &&
          !dbTickets.some((db) => db.id === t.id || db.displayId === t.displayId),
      );
      return [...localTickets, ...dbTickets];
    }
    return [];
  } catch (_) {
    // Graceful fallback to mock data when network / database is offline
    const normalizedRole = userRole?.toLowerCase();
    if (userRole === "customer" || normalizedRole === "customer") {
      return MOCK_TICKETS.filter(
        (t) => !(t as any).isDeleted && !(t as any).is_deleted && t.customerId === userId,
      );
    }
    if (userRole === "support_agent" || normalizedRole === "support_agent") {
      return MOCK_TICKETS.filter(
        (t) =>
          !(t as any).isDeleted &&
          !(t as any).is_deleted &&
          (!userId || t.assignedAgentId === userId || !t.assignedAgentId),
      );
    }
    return MOCK_TICKETS.filter((t) => !(t as any).isDeleted && !(t as any).is_deleted);
  }
}

export async function fetchTicketsForUser(user: User): Promise<Ticket[]> {
  return getTickets(user.id, user.role);
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
    const id = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "00000000-0000-4000-8000-" + Math.floor(100000000000 + Math.random() * 900000000000);
    const displayId = `TCK-${Math.floor(10000 + Math.random() * 90000)}`;
    const newTicket: Ticket = {
      id,
      displayId,
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

  if (!isValidUUID(ticket.id)) {
    ticket.status = nextStatus;
    ticket.updatedAt = now;
    ticket.slaBreach = breached;
    const idx = MOCK_TICKETS.findIndex((t) => t.id === ticket.id || t.displayId === ticket.id);
    if (idx !== -1) {
      MOCK_TICKETS[idx].status = nextStatus;
      MOCK_TICKETS[idx].updatedAt = now;
      MOCK_TICKETS[idx].slaBreach = breached;
    }
    return { ticket };
  }

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

    if (error) {
      ticket.status = nextStatus;
      ticket.updatedAt = now;
      ticket.slaBreach = breached;
      return { ticket };
    }
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
  const now = new Date().toISOString();

  if (!isValidUUID(ticket.id)) {
    ticket.priority = priority;
    ticket.slaDeadline = sla.slaDeadline;
    ticket.updatedAt = now;
    const idx = MOCK_TICKETS.findIndex((t) => t.id === ticket.id || t.displayId === ticket.id);
    if (idx !== -1) {
      MOCK_TICKETS[idx].priority = priority;
      MOCK_TICKETS[idx].slaDeadline = sla.slaDeadline;
      MOCK_TICKETS[idx].updatedAt = now;
    }
    return { ticket };
  }

  try {
    const { data, error } = await supabase
      .from("tickets")
      .update({
        priority,
        sla_response_deadline: sla.slaResponseDeadline,
        sla_resolution_deadline: sla.slaResolutionDeadline,
        sla_deadline: sla.slaDeadline,
        updated_at: now,
      })
      .eq("id", ticket.id)
      .select("*")
      .single();

    if (error) {
      ticket.priority = priority;
      ticket.slaDeadline = sla.slaDeadline;
      ticket.updatedAt = now;
      return { ticket };
    }
    await loadUserDirectory();
    return { ticket: mapTicket(data) };
  } catch (_) {
    ticket.priority = priority;
    ticket.slaDeadline = sla.slaDeadline;
    ticket.updatedAt = now;
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
  const now = new Date().toISOString();

  if (!isValidUUID(ticket.id) || !isValidUUID(agentId)) {
    ticket.assignedAgentId = agentId;
    ticket.assignedAgentName = agentName;
    ticket.status = nextStatus;
    ticket.updatedAt = now;
    const idx = MOCK_TICKETS.findIndex((t) => t.id === ticket.id || t.displayId === ticket.id);
    if (idx !== -1) {
      MOCK_TICKETS[idx].assignedAgentId = agentId;
      MOCK_TICKETS[idx].assignedAgentName = agentName;
      MOCK_TICKETS[idx].status = nextStatus;
      MOCK_TICKETS[idx].updatedAt = now;
    }
    return { ticket };
  }

  try {
    const { data, error } = await supabase
      .from("tickets")
      .update({
        assigned_agent_id: agentId,
        status: nextStatus,
        updated_at: now,
      })
      .eq("id", ticket.id)
      .select("*")
      .single();

    if (error) {
      ticket.assignedAgentId = agentId;
      ticket.assignedAgentName = agentName;
      ticket.status = nextStatus;
      ticket.updatedAt = now;
      return { ticket };
    }
    await loadUserDirectory();
    return { ticket: mapTicket(data) };
  } catch (_) {
    ticket.assignedAgentId = agentId;
    ticket.assignedAgentName = agentName;
    ticket.status = nextStatus;
    ticket.updatedAt = now;
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

export async function softDeleteTicket(id: string): Promise<{ error?: string }>;
export async function softDeleteTicket(user: User, ticketId: string): Promise<{ error?: string }>;
export async function softDeleteTicket(
  userOrId: User | string,
  ticketId?: string,
): Promise<{ error?: string }> {
  let id: string;
  const isUserObj = typeof userOrId === "object" && userOrId !== null;
  if (isUserObj) {
    if (userOrId.role !== "ADMIN") {
      return { error: "Only administrators can delete tickets." };
    }
    id = ticketId!;
  } else {
    id = userOrId;
  }

  const now = new Date().toISOString();

  if (!isValidUUID(id)) {
    const idx = MOCK_TICKETS.findIndex((t) => t.id === id || t.displayId === id);
    if (idx !== -1) {
      (MOCK_TICKETS[idx] as any).isDeleted = true;
      (MOCK_TICKETS[idx] as any).is_deleted = true;
      MOCK_TICKETS[idx].updatedAt = now;
      MOCK_TICKETS.splice(idx, 1);
    }
    return {};
  }

  try {
    const payload = isUserObj
      ? { is_deleted: true, deleted_at: now, updated_at: now }
      : { is_deleted: true, updated_at: now };

    const { error } = await supabase
      .from("tickets")
      .update(payload)
      .eq("id", id);

    if (error) {
      const idx = MOCK_TICKETS.findIndex((t) => t.id === id || t.displayId === id);
      if (idx !== -1) {
        (MOCK_TICKETS[idx] as any).isDeleted = true;
        (MOCK_TICKETS[idx] as any).is_deleted = true;
        MOCK_TICKETS[idx].updatedAt = now;
        MOCK_TICKETS.splice(idx, 1);
      }
      return {};
    }
  } catch (_) {
    const idx = MOCK_TICKETS.findIndex((t) => t.id === id || t.displayId === id);
    if (idx !== -1) {
      (MOCK_TICKETS[idx] as any).isDeleted = true;
      (MOCK_TICKETS[idx] as any).is_deleted = true;
      MOCK_TICKETS[idx].updatedAt = now;
      MOCK_TICKETS.splice(idx, 1);
    }
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
