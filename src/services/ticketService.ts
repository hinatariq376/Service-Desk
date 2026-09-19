import { supabase } from "../lib/supabase";

import type { AuditLog } from '../types';
import { cacheUsers, mapComment, mapAuditLog, mapTicket } from "../lib/mappers";
import { computeSLADeadlines, isSLABreached } from "../lib/sla";
import { validateTransition } from "../lib/stateMachine";
import { MOCK_TICKETS, MOCK_MESSAGES } from "../data/mockData";
import type { Message, Priority, Ticket, TicketStatus, User } from "../types";

async function loadUserDirectory() {
  try {
    const { data } = await supabase.from("users").select("*");
    if (data) cacheUsers(data);
  } catch (_) { }
}

function isValidUUID(str?: string | null): boolean {
  return Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));
}

export async function getTickets(userId?: string, userRole?: string): Promise<Ticket[]> {
  const normalizedRole = userRole?.toUpperCase();
  try {
    await loadUserDirectory();

    let query = supabase
      .from("tickets")
      .select(`
        *,
        customer:users!tickets_customer_id_fkey(id, name, email, avatar),
        agent:users!tickets_assigned_agent_id_fkey(id, name, email, avatar)
      `)
      .order("created_at", { ascending: false });

    if (normalizedRole === "CUSTOMER" && userId) {
      query = query.eq("customer_id", userId);
    }

    const { data, error } = await query;
    let ticketRows = data;

    if (error) {
      console.warn("getTickets primary query error, using fallback queries:", error.message);
      // Fallback 1: Try with column-name references if explicit constraint name differs
      let altQuery = supabase
        .from("tickets")
        .select(`
          *,
          customer:users!customer_id (id, name, email, role, avatar),
          assigned_agent:users!assigned_agent_id (id, name, email, role, avatar)
        `)
        .order("created_at", { ascending: false });

      if (normalizedRole === "CUSTOMER" && userId) {
        altQuery = altQuery.eq("customer_id", userId);
      }

      const altRes = await altQuery;
      if (!altRes.error && altRes.data) {
        ticketRows = altRes.data;
      } else {
        // Fallback 2: Direct select("*") to bypass schema cache foreign key issues
        let fallbackQuery = supabase
          .from("tickets")
          .select("*")
          .order("created_at", { ascending: false });

        if (normalizedRole === "CUSTOMER" && userId) {
          fallbackQuery = fallbackQuery.eq("customer_id", userId);
        }

        const fallbackRes = await fallbackQuery;
        if (!fallbackRes.error && fallbackRes.data) {
          ticketRows = fallbackRes.data;
        }
      }
    }

    if (ticketRows && Array.isArray(ticketRows)) {
      const activeRows = ticketRows.filter((r: any) => !r.deleted_at && !r.is_deleted);
      return activeRows.map(mapTicket);
    }
  } catch (err) {
    console.error("getTickets exception:", err);
  }

  return [];
}

export async function fetchTicketsForUser(user: User): Promise<Ticket[]> {
  return getTickets(user.id, user.role);
}

export type AgentQueueFilter = "assigned" | "active" | "breach";

export async function fetchAgentFilteredTickets(
  agentId: string,
  filter: AgentQueueFilter
): Promise<Ticket[]> {
  try {
    await loadUserDirectory();
    let query = supabase
      .from("tickets")
      .select(`
        *,
        customer:users!customer_id (id, name, email, role, avatar),
        assigned_agent:users!assigned_agent_id (id, name, email, role, avatar)
      `)
      .eq("assigned_agent_id", agentId)
      .order("created_at", { ascending: false });

    if (filter === "assigned") {
      // Show ALL tickets (both OPEN and CLOSED) assigned to agent
    } else if (filter === "active") {
      query = query.not("status", "in", '("CLOSED","RESOLVED")');
    } else if (filter === "breach") {
      query = query.neq("status", "CLOSED").or("sla_breach.eq.true,sla_status.eq.BREACHED");
    }

    const { data, error } = await query;
    if (!error && data && Array.isArray(data)) {
      return data.filter((r: any) => !r.deleted_at && !r.is_deleted).map(mapTicket);
    }
  } catch (_) {}

  const all = await getTickets(agentId, "SUPPORT_AGENT");
  if (filter === "assigned") {
    return all.filter((t) => t.assignedAgentId === agentId);
  } else if (filter === "active") {
    return all.filter(
      (t) => t.assignedAgentId === agentId && !["CLOSED", "RESOLVED"].includes(t.status)
    );
  } else if (filter === "breach") {
    return all.filter(
      (t) =>
        t.assignedAgentId === agentId &&
        t.status !== "CLOSED" &&
        (t.slaBreach || (t as any).sla_status === "BREACHED" || (t as any).slaStatus === "BREACHED" || new Date(t.slaDeadline) < new Date())
    );
  }
  return all;
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

    if (!error && data && Array.isArray(data)) {
      return data.map((row) => mapComment(row));
    }
  } catch (err) {
    console.error("fetchMessagesForTickets error:", err);
  }

  return [];
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
    // Ensure customer user profile exists in public.users to satisfy foreign keys
    if (user && user.id) {
      await supabase.from("users").upsert({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        is_approved: user.isApproved ?? (user.role !== "SUPPORT_AGENT"),
        approval_status: user.approvalStatus ?? (user.role === "SUPPORT_AGENT" ? "PENDING" : "APPROVED"),
      }).select("id").maybeSingle().catch(() => {});
    }

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

    if (error) {
      console.error("Supabase createTicket error:", error);
      throw new Error(error.message);
    }
    await loadUserDirectory();
    return mapTicket(data);
  } catch (err) {
    console.warn("createTicket fallback to memory:", err);
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
      console.error("updateTicketStatus error:", error);
      return { error: error.message };
    }
    await loadUserDirectory();
    return { ticket: mapTicket(data) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update ticket status." };
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
      console.error("updateTicketPriority error:", error);
      return { error: error.message };
    }
    await loadUserDirectory();
    return { ticket: mapTicket(data) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update ticket priority." };
  }
}

export async function assignTicketToAgent(
  admin: User,
  ticket: Ticket,
  agentId: string | null,
  agentName?: string,
): Promise<{ ticket?: Ticket; error?: string }> {
  if (admin.role !== "ADMIN") {
    return { error: "Only administrators can assign tickets." };
  }

  const nextStatus: TicketStatus =
    ticket.status === "OPEN" || ticket.status === "TRIAGED" ? "ASSIGNED" : ticket.status;
  const now = new Date().toISOString();

  // If local mock ticket
  if (!isValidUUID(ticket.id)) {
    ticket.assignedAgentId = agentId || undefined;
    ticket.assignedAgentName = agentName || undefined;
    ticket.status = nextStatus;
    ticket.updatedAt = now;
    const idx = MOCK_TICKETS.findIndex((t) => t.id === ticket.id || t.displayId === ticket.id);
    if (idx !== -1) {
      MOCK_TICKETS[idx].assignedAgentId = agentId || undefined;
      MOCK_TICKETS[idx].assignedAgentName = agentName || undefined;
      MOCK_TICKETS[idx].status = nextStatus;
      MOCK_TICKETS[idx].updatedAt = now;
    }
    return { ticket };
  }

  // If agentId is provided but not a valid UUID (e.g. mock ID like "u2" with a DB ticket)
  if (agentId && !isValidUUID(agentId)) {
    return {
      error: `Invalid agent ID (${agentId}). Make sure agents are registered users in Supabase.`,
    };
  }

  try {
    const { data, error } = await supabase
      .from("tickets")
      .update({
        assigned_agent_id: agentId || null,
        status: nextStatus,
        updated_at: now,
      })
      .eq("id", ticket.id)
      .select("*")
      .single();

    if (error) {
      console.error("assignTicketToAgent error:", error);
      return { error: `Database update failed: ${error.message}` };
    }
    await loadUserDirectory();
    return { ticket: mapTicket(data) };
  } catch (err) {
    console.error("assignTicketToAgent exception:", err);
    return { error: err instanceof Error ? err.message : "Failed to assign ticket in database." };
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
      .update(payload as any)
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
    // 1. Query public.activity_logs
    const { data: activityData, error: activityError } = await supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (!activityError && activityData && activityData.length > 0) {
      return activityData.map(mapAuditLog);
    }

    // 2. Fallback to audit_logs
    const { data: auditData, error: auditError } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (!auditError && auditData && auditData.length > 0) {
      return auditData.map(mapAuditLog);
    }
  } catch (err) {
    console.warn("fetchAuditLogs exception:", err);
  }
  return [];
}

export const getAuditLogs = fetchAuditLogs;


export async function refreshSLABreaches(tickets: Ticket[]) {
  const overdue = tickets.filter((t) => isSLABreached(t.slaDeadline, t.slaBreach) && !t.slaBreach);
  try {
    await Promise.all(
      overdue.map((t) =>
        supabase.from("tickets").update({ sla_breach: true }).eq("id", t.id),
      ),
    );
  } catch (_) { }
}
