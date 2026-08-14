export type Role = "CUSTOMER" | "SUPPORT_AGENT" | "ADMIN";

export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type TicketStatus =
  | "OPEN"
  | "TRIAGED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "WAITING_FOR_CUSTOMER"
  | "RESOLVED"
  | "CLOSED";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
}

export interface Ticket {
  id: string;
  displayId: string;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  status: TicketStatus;
  customerId: string;
  customerName: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  createdAt: string;
  updatedAt: string;
  slaResponseDeadline?: string;
  slaDeadline: string;
  slaBreach: boolean;
  attachments?: string[];
  tags?: string[];
}

export interface Message {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  content: string;
  isInternal: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: Role;
  action: string;
  entityId: string;
  entityType: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
}

export const DEMO_PASSWORD = "Demo123!";

export const DEMO_EMAILS: Record<Role, string> = {
  CUSTOMER: "customer@servicedesk.com",
  SUPPORT_AGENT: "agent@servicedesk.com",
  ADMIN: "admin@servicedesk.com",
};
