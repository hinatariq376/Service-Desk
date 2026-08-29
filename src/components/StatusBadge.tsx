import type { TicketStatus, Priority } from "../types";

const STATUS_CONFIG: Record<TicketStatus, { label: string; bg: string; text: string; dot: string }> = {
  OPEN: { label: "Open", bg: "bg-blue-950/50", text: "text-blue-300", dot: "bg-blue-400" },
  TRIAGED: { label: "Triaged", bg: "bg-purple-950/50", text: "text-purple-300", dot: "bg-purple-400" },
  ASSIGNED: { label: "Assigned", bg: "bg-indigo-950/50", text: "text-indigo-700", dot: "bg-indigo-400" },
  IN_PROGRESS: { label: "In Progress", bg: "bg-amber-950/50", text: "text-amber-300", dot: "bg-amber-400" },
  WAITING_FOR_CUSTOMER: { label: "Waiting", bg: "bg-yellow-50", text: "text-yellow-300", dot: "bg-yellow-400" },
  RESOLVED: { label: "Resolved", bg: "bg-emerald-950/50", text: "text-emerald-300", dot: "bg-emerald-400" },
  CLOSED: { label: "Closed", bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400" },
};

const PRIORITY_CONFIG: Record<Priority, { label: string; bg: string; text: string; border: string }> = {
  CRITICAL: { label: "Critical", bg: "bg-red-50", text: "text-red-300", border: "border-red-800" },
  HIGH: { label: "High", bg: "bg-orange-950/50", text: "text-orange-300", border: "border-orange-800" },
  MEDIUM: { label: "Medium", bg: "bg-yellow-50", text: "text-yellow-300", border: "border-yellow-800" },
  LOW: { label: "Low", bg: "bg-emerald-950/50", text: "text-emerald-300", border: "border-emerald-800" },
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border border-transparent ${cfg.bg} ${cfg.text}`}
      role="status"
      aria-label={`Status: ${cfg.label}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} aria-hidden />
      {cfg.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
      role="status"
      aria-label={`Priority: ${cfg.label}`}
    >
      {cfg.label}
    </span>
  );
}

export function TransitionErrorBadge({ message }: { message: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-950/60 text-red-300 border border-red-800 animate-fade-up"
      role="alert"
    >
      {message}
    </span>
  );
}
