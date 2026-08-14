import type { DbAuditLog, DbComment, DbTicket, DbUser } from "./database.types";
import type { AuditLog, Message, Priority, Role, Ticket, TicketStatus, User } from "../types";

const userCache = new Map<string, DbUser>();

export function cacheUsers(users: DbUser[]) {
  users.forEach((u) => userCache.set(u.id, u));
}

export function getUserName(id: string | null | undefined): string | undefined {
  if (!id) return undefined;
  return userCache.get(id)?.name;
}

export function mapUser(row: DbUser): User {
  userCache.set(row.id, row);
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as Role,
    avatar: row.avatar ?? undefined,
  };
}

function parseAttachments(value: unknown): string[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value.map(String);
  return undefined;
}

export function formatTicketId(id: string): string {
  if (id.startsWith("TCK-")) return id;
  return `TCK-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function mapTicket(row: DbTicket): Ticket {
  const resolutionDeadline =
    row.sla_resolution_deadline ?? row.sla_deadline ?? new Date().toISOString();

  return {
    id: row.id,
    displayId: formatTicketId(row.id),
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority as Priority,
    status: row.status as TicketStatus,
    customerId: row.customer_id,
    customerName: getUserName(row.customer_id) ?? "Unknown Customer",
    assignedAgentId: row.assigned_agent_id ?? undefined,
    assignedAgentName: getUserName(row.assigned_agent_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    slaResponseDeadline: row.sla_response_deadline ?? undefined,
    slaDeadline: resolutionDeadline,
    slaBreach: row.sla_breach ?? false,
    attachments: parseAttachments(row.attachments),
    tags: row.tags ?? undefined,
  };
}

export function mapComment(row: DbComment, author?: DbUser | null): Message {
  const profile = author ?? userCache.get(row.author_id);
  return {
    id: row.id,
    ticketId: row.ticket_id,
    authorId: row.author_id,
    authorName: profile?.name ?? "Unknown",
    authorRole: (profile?.role ?? "CUSTOMER") as Role,
    content: row.content,
    isInternal: row.is_internal,
    createdAt: row.created_at,
  };
}

export function mapAuditLog(row: DbAuditLog): AuditLog {
  return {
    id: row.id,
    timestamp: row.created_at,
    actorName: row.actor_name,
    actorRole: row.actor_role as Role,
    action: row.action,
    entityId: row.entity_id,
    entityType: row.entity_type,
    oldValue: (row.old_value as Record<string, unknown>) ?? undefined,
    newValue: (row.new_value as Record<string, unknown>) ?? undefined,
  };
}
