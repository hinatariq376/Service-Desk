import type { TicketStatus, Priority } from "../types";

const STATUS_CONFIG: Record<TicketStatus, { label: string; bg: string; text: string; dot: string; border: string }> = {
  OPEN: { label: "Open", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", border: "border-blue-200" },
  TRIAGED: { label: "Triaged", bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500", border: "border-purple-200" },
  ASSIGNED: { label: "Assigned", bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-500", border: "border-indigo-200" },
  IN_PROGRESS: { label: "In Progress", bg: "bg-amber-50", text: "text-amber-800", dot: "bg-amber-500", border: "border-amber-200" },
  WAITING_FOR_CUSTOMER: { label: "Waiting on Customer", bg: "bg-yellow-50", text: "text-yellow-800", dot: "bg-yellow-500", border: "border-yellow-200" },
  RESOLVED: { label: "Resolved", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", border: "border-emerald-200" },
  CLOSED: { label: "Closed", bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400", border: "border-slate-200" },
};

const PRIORITY_CONFIG: Record<Priority, { label: string; bg: string; text: string; border: string }> = {
  CRITICAL: { label: "Critical", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  HIGH: { label: "High", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  MEDIUM: { label: "Medium", bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
  LOW: { label: "Low", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.OPEN;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
      role="status"
      aria-label={`Status: ${cfg.label}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} aria-hidden />
      {cfg.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.MEDIUM;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
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
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200 animate-fade-up"
      role="alert"
    >
      {message}
    </span>
  );
}
