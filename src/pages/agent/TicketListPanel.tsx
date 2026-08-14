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
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center mb-3">
          <span className="text-slate-500 text-lg">✓</span>
        </div>
        <p className="text-sm text-slate-400">{emptyMessage || "No tickets in this queue."}</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      {tickets.map((ticket) => (
        <button
          key={ticket.id}
          onClick={() => onSelect(ticket.id)}
          className={`w-full text-left px-4 py-3.5 border-b border-slate-800/60 transition-all hover:bg-slate-800/40 ${
            selectedId === ticket.id ? "bg-indigo-950/40 border-l-2 border-l-indigo-500 pl-3.5" : ""
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-xs font-bold text-indigo-400">{ticket.displayId}</span>
            <PriorityBadge priority={ticket.priority} />
          </div>
          <div className="text-xs font-medium text-slate-200 leading-snug mb-2 line-clamp-2">{ticket.title}</div>
          <div className="flex items-center justify-between">
            <StatusBadge status={ticket.status} />
            <SLATimer deadline={ticket.slaDeadline} breach={ticket.slaBreach} />
          </div>
          {ticket.assignedAgentName && (
            <div className="text-[10px] text-slate-600 mt-1.5">Agent: {ticket.assignedAgentName}</div>
          )}
        </button>
      ))}
    </div>
  );
}
