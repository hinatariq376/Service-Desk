import { useState } from "react";
import { PlusCircle, Search, ArrowRight, Filter } from "lucide-react";
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
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h2 className="text-lg font-bold text-white">My Tickets</h2>
          <p className="text-xs text-slate-500 mt-0.5">{tickets.length} total requests submitted</p>
        </div>
        <button
          onClick={onCreateTicket}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg px-3 py-2 transition-all shadow-md shadow-indigo-900/30"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Create New Ticket
        </button>
      </div>

      <div className="flex items-center gap-3 animate-fade-up" style={{ animationDelay: "40ms" }}>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID or title…"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>
        <div className="flex gap-1.5">
          {(["ALL", "OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                statusFilter === s ? "bg-indigo-600 text-white" : "text-slate-400 border border-slate-700 hover:border-slate-600"
              }`}
            >
              {s === "ALL" ? "All" : s === "WAITING_FOR_CUSTOMER" ? "Waiting" : s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500 ml-auto">{filtered.length} results</span>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden animate-fade-up" style={{ animationDelay: "80ms" }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                {["Ticket ID", "Title", "Category", "Priority", "Status", "SLA Timer", "Last Updated"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">{h}</th>
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
                  <td className="px-4 py-3"><span className="font-mono text-xs font-bold text-indigo-400">{t.displayId}</span></td>
                  <td className="px-4 py-3 max-w-xs"><div className="text-sm text-slate-200 truncate">{t.title}</div></td>
                  <td className="px-4 py-3 text-xs text-slate-400">{t.category}</td>
                  <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3"><SLATimer deadline={t.slaDeadline} breach={t.slaBreach} /></td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(t.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3"><ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-indigo-400 transition-all" /></td>
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
