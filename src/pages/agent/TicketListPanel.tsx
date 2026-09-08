import { StatusBadge, PriorityBadge } from "../../components/StatusBadge";
import SLATimer from "../../components/SLATimer";
import type { Ticket } from "../../types";

interface TicketListPanelProps {
  tickets: Ticket[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyMessage?: string;
}

export default function TicketListPanel({ tickets, selectedId, onSelect, emptyMessage }: TicketListPanelProps) {
  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6 sm:p-8">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-3 shrink-0">
          <span className="text-slate-400 text-lg font-bold">✓</span>
        </div>
        <p className="text-xs sm:text-sm text-slate-500">{emptyMessage || "No tickets in this queue."}</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full divide-y divide-slate-100 min-w-0 w-full bg-white">
      {tickets.map((ticket) => (
        <button
          key={ticket.id}
          onClick={() => onSelect(ticket.id)}
          className={`w-full text-left px-3.5 py-3 sm:px-4 sm:py-3.5 transition-all hover:bg-slate-50 block min-w-0 ${
            selectedId === ticket.id ? "bg-indigo-50/70 border-l-4 border-l-indigo-600 pl-3 sm:pl-3" : ""
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="font-mono text-xs font-bold text-indigo-600 truncate">{ticket.displayId}</span>
            <div className="shrink-0">
              <PriorityBadge priority={ticket.priority} />
            </div>
          </div>
          <div className="text-xs font-semibold text-slate-900 leading-snug mb-2 line-clamp-2 break-words">
            {ticket.title}
          </div>
          <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
            <div className="shrink-0">
              <StatusBadge status={ticket.status} />
            </div>
            <div className="shrink-0">
              <SLATimer deadline={ticket.slaDeadline} breach={ticket.slaBreach} />
            </div>
          </div>
          {ticket.assignedAgentName && (
            <div className="text-[10px] text-slate-500 mt-1.5 truncate">
              Agent: <span className="font-medium text-slate-700">{ticket.assignedAgentName}</span>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}