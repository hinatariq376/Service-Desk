import type { TicketStatus } from "../models/Ticket.js";
import type { UserRole } from "../models/User.js";

const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ["TRIAGED"],
  TRIAGED: ["ASSIGNED"],
  ASSIGNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["WAITING_FOR_CUSTOMER", "RESOLVED"],
  WAITING_FOR_CUSTOMER: ["IN_PROGRESS"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
};

export function canTransition(from: TicketStatus, to: TicketStatus, role: UserRole): boolean {
  if (role === "CUSTOMER") {
    return from === "RESOLVED" && to === "CLOSED";
  }
  if (role === "ADMIN" || role === "SUPPORT_AGENT") {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }
  return false;
}

export function getAllowedTransitions(status: TicketStatus, role: UserRole): TicketStatus[] {
  if (role === "CUSTOMER") {
    return status === "RESOLVED" ? ["CLOSED"] : [];
  }
  return VALID_TRANSITIONS[status] ?? [];
}

export function validateTransition(
  from: TicketStatus,
  to: TicketStatus,
  role: UserRole
): { ok: true } | { ok: false; code: string; message: string } {
  if (from === to) {
    return {
      ok: false,
      code: "INVALID_STATUS_TRANSITION",
      message: `Ticket is already in ${from} status.`,
    };
  }

  if (!canTransition(from, to, role)) {
    return {
      ok: false,
      code: "INVALID_STATUS_TRANSITION",
      message: `A ticket in ${from.replace(/_/g, " ")} status cannot transition directly to ${to.replace(
        /_/g,
        " "
      )}.`,
    };
  }

  return { ok: true };
}
