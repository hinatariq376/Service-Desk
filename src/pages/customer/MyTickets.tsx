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
      (t.displayId.toLowerCase().includes(q) || t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)) &&
      (statusFilter === "ALL" || t.status === statusFilter)
    );
  });

  return (
    <div className="space-y-5 max-w-6xl mx-auto w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-up">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">My Tickets</h2>
          <p className="text-xs text-slate-500 mt-0.5">{tickets.length} total requests submitted</p>
        </div>
        <button
          onClick={onCreateTicket}
          className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-3.5 py-2 transition-all shadow-md shadow-indigo-600/20 shrink-0 w-full sm:w-auto"
        >
          <PlusCircle className="w-4 h-4" />
          Create New Ticket
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 animate-fade-up" style={{ animationDelay: "40ms" }}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, title, or category…"
              className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
            />
          </div>
          <span className="text-xs text-slate-500 self-end sm:self-auto font-medium">{filtered.length} tickets</span>
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {(["ALL", "OPEN", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                statusFilter === s
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 bg-white border border-slate-200 hover:bg-slate-100"
              }`}
            >
              {s === "ALL" ? "All Tickets" : s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm animate-fade-up" style={{ animationDelay: "80ms" }}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {["Ticket ID", "Title", "Category", "Priority", "Status", "Resolution SLA", "Last Updated"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((t, i) => (
                <tr
                  key={t.id}
                  onClick={() => onViewTicket(t.id)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer group animate-fade-up"
                  style={{ animationDelay: `${i * 20}ms` }}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-mono text-xs font-bold text-indigo-600">{t.displayId}</span>
                  </td>
                  <td className="px-4 py-3 max-w-xs min-w-[160px]">
                    <div className="text-sm font-medium text-slate-900 truncate">{t.title}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{t.category}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <SLATimer deadline={t.slaDeadline} breach={t.slaBreach} />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(t.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-all" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-slate-500 text-sm">No tickets found matching your filter.</p>
              <button onClick={onCreateTicket} className="mt-2 text-xs text-indigo-600 font-semibold hover:underline">
                Create a new ticket
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}