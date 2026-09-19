import { useEffect, useState } from "react";
import { Search, Filter, ArrowUpDown, RefreshCw, UserPlus } from "lucide-react";
import { StatusBadge, PriorityBadge, TransitionErrorBadge } from "../../components/StatusBadge";
import SLATimer from "../../components/SLATimer";
import { useTickets } from "../../context/TicketContext";
import { fetchSupportAgents } from "../../services/userService";
import type { Ticket, TicketStatus, Priority, User } from "../../types";

interface AllSystemTicketsProps {
  tickets: Ticket[];
}

type SortKey = "id" | "priority" | "status" | "createdAt";

const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export default function AllSystemTickets({ tickets }: AllSystemTicketsProps) {
  const { refresh, assignAgent } = useTickets();
  const [agents, setAgents] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "ALL">("ALL");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortAsc, setSortAsc] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState("");

  useEffect(() => {
    fetchSupportAgents().then(setAgents).catch(console.error);
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((p) => !p);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const handleAssign = async (ticket: Ticket, agentId: string) => {
    const agent = agentId ? agents.find((a) => a.id === agentId) || null : null;
    setAssignError("");
    setAssigningId(ticket.id);
    const result = await assignAgent(ticket, agent);
    setAssigningId(null);
    if (result.error) setAssignError(result.error);
  };

  const filtered = tickets
    .filter((t) => {
      const q = search.toLowerCase();
      return (
        (t.displayId.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.customerName.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)) &&
        (statusFilter === "ALL" || t.status === statusFilter) &&
        (priorityFilter === "ALL" || t.priority === priorityFilter)
      );
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "priority") cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      else if (sortKey === "createdAt") cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortKey === "id") cmp = a.displayId.localeCompare(b.displayId);
      else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
      return sortAsc ? cmp : -cmp;
    });

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      type="button"
      onClick={() => handleSort(k)}
      className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider hover:text-slate-900 transition-colors"
    >
      {label}
      <ArrowUpDown className={`w-3.5 h-3.5 ${sortKey === k ? "text-indigo-600" : ""}`} />
    </button>
  );

  // Calculate active ticket load (deleted_at IS NULL and status != 'CLOSED') per agent and sort ASCENDING
  const sortedAgentsByLoad = [...agents]
    .map((agent) => {
      const activeTicketCount = tickets.filter(
        (t) => t.assignedAgentId === agent.id && t.status !== "CLOSED",
      ).length;
      return { ...agent, activeTicketCount };
    })
    .sort((a, b) => a.activeTicketCount - b.activeTicketCount);

  return (
    <div className="space-y-5 max-w-7xl mx-auto w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-up">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">All System Tickets</h2>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
            {tickets.length.toLocaleString()} total tickets in system
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => refresh()}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-300 bg-white transition-all shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter("ALL");
              setPriorityFilter("ALL");
              setSearch("");
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 border border-slate-300 bg-white hover:bg-slate-50 transition-all shadow-sm flex items-center gap-1.5"
          >
            <Filter className="w-3.5 h-3.5" />
            Reset Filters
          </button>
        </div>
      </div>

      {assignError && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 animate-fade-up">
          {assignError}
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm animate-fade-up" style={{ animationDelay: "40ms" }}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ticket ID, title, customer, or category…"
              className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium self-end sm:self-auto">
            Showing {filtered.length} of {tickets.length} tickets
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="font-semibold text-slate-500 text-[11px] uppercase tracking-wider">Status:</span>
            {(["ALL", "OPEN", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  statusFilter === s
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {s === "ALL" ? "All" : s.replace(/_/g, " ")}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap text-xs ml-auto">
            <span className="font-semibold text-slate-500 text-[11px] uppercase tracking-wider">Priority:</span>
            {(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriorityFilter(p)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  priorityFilter === p
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ticket Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm animate-fade-up" style={{ animationDelay: "80ms" }}>
        <div className="overflow-x-auto min-w-0">
          <table className="w-full text-left min-w-[750px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3">
                  <SortBtn k="id" label="Ticket ID" />
                </th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Title &amp; Category</th>
                <th className="px-4 py-3">
                  <SortBtn k="priority" label="Priority" />
                </th>
                <th className="px-4 py-3">
                  <SortBtn k="status" label="Status" />
                </th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assigned Agent (Load: Min → Max)</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Resolution SLA</th>
                <th className="px-4 py-3">
                  <SortBtn k="createdAt" label="Created" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((t, i) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors animate-fade-up" style={{ animationDelay: `${i * 15}ms` }}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-bold text-indigo-600">{t.displayId}</span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <div className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{t.title}</div>
                    <div className="text-[10px] text-slate-500">{t.category}</div>
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-slate-800">{t.customerName}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <select
                        value={t.assignedAgentId ?? ""}
                        disabled={assigningId === t.id}
                        onChange={(e) => handleAssign(t, e.target.value)}
                        className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[200px] shadow-sm"
                      >
                        <option value="">Unassigned</option>
                        {sortedAgentsByLoad.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.activeTicketCount} active ticket{a.activeTicketCount !== 1 ? "s" : ""})
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <SLATimer deadline={t.slaDeadline} breach={t.slaBreach} />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(t.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-16 text-center text-slate-500 text-xs sm:text-sm">
              No tickets match your filter criteria.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}