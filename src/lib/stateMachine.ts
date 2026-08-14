import type { Role, TicketStatus } from "../types";

const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ["TRIAGED"],
  TRIAGED: ["ASSIGNED"],
  ASSIGNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["WAITING_FOR_CUSTOMER", "RESOLVED"],
  WAITING_FOR_CUSTOMER: ["IN_PROGRESS"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
};

export function canTransition(from: TicketStatus, to: TicketStatus, role: Role): boolean {
  if (role === "CUSTOMER") {
    return from === "RESOLVED" && to === "CLOSED";
  }
  if (role === "ADMIN" || role === "SUPPORT_AGENT") {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }
  return false;
}

export function getAllowedTransitions(status: TicketStatus, role: Role): TicketStatus[] {
  if (role === "CUSTOMER") {
    return status === "RESOLVED" ? ["CLOSED"] : [];
  }
  return VALID_TRANSITIONS[status] ?? [];
}

export const TRANSITION_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  TRIAGED: "Mark Triaged",
  ASSIGNED: "Assign",
  IN_PROGRESS: "Start Progress",
  WAITING_FOR_CUSTOMER: "Waiting on Customer",
  RESOLVED: "Resolve Ticket",
  CLOSED: "Close Ticket",
};

export function getTransitionAction(status: TicketStatus, next: TicketStatus): string {
  const labels: Partial<Record<TicketStatus, string>> = {
    TRIAGED: "Mark Triaged",
    ASSIGNED: "Mark Assigned",
    IN_PROGRESS: "Start Progress",
    WAITING_FOR_CUSTOMER: "Waiting on Customer",
    RESOLVED: "Resolve Ticket",
    CLOSED: "Close Ticket",
  };
  return labels[next] ?? TRANSITION_LABELS[next];
}

export function validateTransition(
  from: TicketStatus,
  to: TicketStatus,
  role: Role,
): { ok: true } | { ok: false; message: string } {
  if (from === to) {
    return { ok: false, message: "Ticket is already in this status." };
  }
  if (!canTransition(from, to, role)) {
    return {
      ok: false,
      message: `Invalid transition: ${from.replace(/_/g, " ")} → ${to.replace(/_/g, " ")}`,
    };
  }
  return { ok: true };
}
