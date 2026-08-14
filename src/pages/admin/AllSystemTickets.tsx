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
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [sortAsc, setSortAsc] = useState(true);
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
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return;
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
          t.customerName.toLowerCase().includes(q)) &&
        (statusFilter === "ALL" || t.status === statusFilter) &&
        (priorityFilter === "ALL" || t.priority === priorityFilter)
      );
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "priority") cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      else if (sortKey === "createdAt") cmp = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      else if (sortKey === "id") cmp = a.displayId.localeCompare(b.displayId);
      else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
      return sortAsc ? cmp : -cmp;
    });

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      type="button"
      onClick={() => handleSort(k)}
      className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider hover:text-zinc-300 transition-colors"
    >
      {label}
      <ArrowUpDown className={`w-3 h-3 ${sortKey === k ? "text-indigo-400" : ""}`} />
    </button>
  );

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h2 className="text-lg font-bold text-zinc-50">All System Tickets</h2>
          <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            {tickets.length.toLocaleString()} tickets — live via Supabase Realtime
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refresh()}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-700 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 border border-zinc-700 rounded-lg px-3 py-2 hover:border-zinc-600 transition-colors"
          >
            <Filter className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>

      {assignError && <TransitionErrorBadge message={assignError} />}

      <div className="flex flex-wrap items-center gap-3 animate-fade-up" style={{ animationDelay: "40ms" }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets…"
            className="bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-60 transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TicketStatus | "ALL")}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="ALL">All Statuses</option>
          {["OPEN", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"].map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as Priority | "ALL")}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="ALL">All Priorities</option>
          {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <span className="text-xs text-zinc-500 ml-auto">{filtered.length} results</span>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden animate-fade-up" style={{ animationDelay: "80ms" }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-4 py-3 text-left">
                  <SortBtn k="id" label="Ticket ID" />
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Title</th>
                <th className="px-4 py-3 text-left">
                  <SortBtn k="priority" label="Priority" />
                </th>
                <th className="px-4 py-3 text-left">
                  <SortBtn k="status" label="Status" />
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Assign Agent</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-zinc-500 uppercase tracking-wider">SLA</th>
                <th className="px-4 py-3 text-left">
                  <SortBtn k="createdAt" label="Created" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filtered.map((t, i) => (
                <tr key={t.id} className="hover:bg-zinc-800/20 transition-colors group animate-fade-up" style={{ animationDelay: `${i * 20}ms` }}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-indigo-400">{t.displayId}</span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <div className="text-sm text-zinc-200 truncate">{t.title}</div>
                    <div className="text-[10px] text-zinc-500">{t.category}</div>
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-300">{t.customerName}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <UserPlus className="w-3 h-3 text-zinc-500 shrink-0" />
                      <select
                        value={t.assignedAgentId ?? ""}
                        disabled={assigningId === t.id}
                        onChange={(e) => handleAssign(t, e.target.value)}
                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[140px]"
                      >
                        <option value="">Unassigned</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <SLATimer deadline={t.slaDeadline} breach={t.slaBreach} />
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {new Date(t.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-zinc-500 text-sm">No tickets match the current filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
