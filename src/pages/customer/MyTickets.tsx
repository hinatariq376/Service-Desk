import { useState } from "react";
import { PlusCircle, Search, ArrowRight } from "lucide-react";
import { StatusBadge, PriorityBadge } from "../../components/StatusBadge";
import SLATimer from "../../components/SLATimer";
import type { Ticket, TicketStatus } from "../../types";

interface MyTicketsProps {
  tickets: Ticket[];
  onCreateTicket: () => void;
  onViewTicket: (id: string) => void;
}

export default function MyTickets({ tickets, onCreateTicket, onViewTicket }: MyTicketsProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "ALL">("ALL");

  const filtered = tickets.filter((t) => {
    const q = search.toLowerCase();
    return (
      (t.displayId.toLowerCase().includes(q) || t.title.toLowerCase().includes(q)) &&
      (statusFilter === "ALL" || t.status === statusFilter)
    );
  });

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-5 max-w-6xl mx-auto w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-up">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white">My Tickets</h2>
          <p className="text-xs text-slate-500 mt-0.5">{tickets.length} total requests submitted</p>
        </div>
        <button
          onClick={onCreateTicket}
          className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg px-3 py-2 transition-all shadow-md shadow-indigo-900/30 shrink-0 w-full sm:w-auto"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Create New Ticket
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 animate-fade-up" style={{ animationDelay: "40ms" }}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID or title…"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3.5 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
          <span className="text-xs text-slate-500 self-end sm:self-auto">{filtered.length} results</span>
        </div>

        {/* Scrollable status filter buttons for mobile */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          {(["ALL", "OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
                statusFilter === s ? "bg-indigo-600 text-white" : "text-slate-400 border border-slate-700 hover:border-slate-600"
              }`}
            >
              {s === "ALL" ? "All" : s === "WAITING_FOR_CUSTOMER" ? "Waiting" : s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden animate-fade-up" style={{ animationDelay: "80ms" }}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                {["Ticket ID", "Title", "Category", "Priority", "Status", "SLA Timer", "Last Updated"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filtered.map((t, i) => (
                <tr
                  key={t.id}
                  onClick={() => onViewTicket(t.id)}
                  className="hover:bg-slate-800/20 transition-colors cursor-pointer group animate-fade-up"
                  style={{ animationDelay: `${i * 25}ms` }}
                >
                  <td className="px-4 py-3 whitespace-nowrap"><span className="font-mono text-xs font-bold text-indigo-400">{t.displayId}</span></td>
                  <td className="px-4 py-3 max-w-xs min-w-[150px]"><div className="text-sm text-slate-200 truncate">{t.title}</div></td>
                  <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{t.category}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><PriorityBadge priority={t.priority} /></td>
                  <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3 whitespace-nowrap"><SLATimer deadline={t.slaDeadline} breach={t.slaBreach} /></td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(t.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap"><ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-indigo-400 transition-all" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-slate-500 text-sm">No tickets found. Try adjusting the filters.</p>
              <button onClick={onCreateTicket} className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 underline">
                Create your first ticket
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}