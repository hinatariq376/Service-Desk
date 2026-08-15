import { useMemo } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, Clock, Ticket, Activity } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { Ticket as TicketType, Priority, TicketStatus } from "../../types";

const TOOLTIP = {
  backgroundColor: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#e4e4e7",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#22c55e",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "#3b82f6",
  TRIAGED: "#a855f7",
  ASSIGNED: "#6366f1",
  IN_PROGRESS: "#f59e0b",
  WAITING_FOR_CUSTOMER: "#eab308",
  RESOLVED: "#10b981",
  CLOSED: "#71717a",
};

const KPI_COLOR_MAP: Record<string, string> = {
  indigo: "text-indigo-400",
  amber: "text-amber-400",
  red: "text-red-400",
  emerald: "text-emerald-400",
};

interface OverviewAnalyticsProps {
  tickets: TicketType[];
}

export default function OverviewAnalytics({ tickets }: OverviewAnalyticsProps) {
  const open = tickets.filter((t) => t.status === "OPEN").length;
  const breached = tickets.filter((t) => t.slaBreach || new Date(t.slaDeadline) < new Date()).length;
  const breachRate = tickets.length ? ((breached / tickets.length) * 100).toFixed(1) : "0.0";
  const inProgress = tickets.filter((t) => t.status === "IN_PROGRESS").length;

  const priorityData = useMemo(() => {
    const counts: Record<Priority, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    tickets.forEach((t) => {
      counts[t.priority]++;
    });
    return (Object.keys(counts) as Priority[]).map((p) => ({
      name: p.charAt(0) + p.slice(1).toLowerCase(),
      value: counts[p],
      fill: PRIORITY_COLORS[p],
    }));
  }, [tickets]);

  const statusData = useMemo(() => {
    const counts = new Map<string, number>();
    tickets.forEach((t) => counts.set(t.status, (counts.get(t.status) ?? 0) + 1));
    return Array.from(counts.entries()).map(([status, value]) => ({
      name: status.replace(/_/g, " "),
      value,
      fill: STATUS_COLORS[status as TicketStatus] ?? "#71717a",
    }));
  }, [tickets]);

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto w-full min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-zinc-50">Overview Analytics</h2>
          <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            Live — synced from Supabase PostgreSQL
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 animate-fade-up" style={{ animationDelay: "40ms" }}>
        {[
          { label: "Total Tickets", value: tickets.length.toLocaleString(), icon: Ticket, trend: "Live count", up: false, color: "indigo", sub: "All roles" },
          { label: "Open Queue", value: open.toLocaleString(), icon: AlertTriangle, trend: "Needs triage", up: open > 0, color: "amber", sub: "OPEN status" },
          { label: "SLA Breach Rate", value: `${breachRate}%`, icon: Clock, trend: `${breached} breached`, up: breached > 0, color: "red", sub: "Resolution SLA" },
          { label: "In Progress", value: inProgress.toLocaleString(), icon: Activity, trend: "Active work", up: false, color: "emerald", sub: "Agent queue" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 sm:p-4 hover:border-zinc-700 transition-colors">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-[11px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider">{kpi.label}</span>
              <kpi.icon className={`w-4 h-4 ${KPI_COLOR_MAP[kpi.color] ?? "text-zinc-400"}`} />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-zinc-50 tabular-nums">{kpi.value}</div>
            <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${kpi.up ? "text-red-400" : "text-emerald-400"}`}>
              {kpi.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {kpi.trend}
              <span className="text-zinc-600 ml-1 truncate">{kpi.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 animate-fade-up" style={{ animationDelay: "80ms" }}>
        {/* Priority Bar Chart */}
        <div className="lg:col-span-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-5 min-w-0">
          <h3 className="text-xs sm:text-sm font-semibold text-zinc-50 mb-0.5">Tickets by Priority</h3>
          <p className="text-xs text-zinc-500 mb-4">Current distribution</p>
          <div className="w-full h-[200px] sm:h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP} cursor={{ fill: "#27272a" }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {priorityData.map((e, i) => (
                    <Cell key={i} fill={e.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Pie Chart */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-5 min-w-0 flex flex-col justify-between">
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-zinc-50 mb-0.5">By Status</h3>
            <p className="text-xs text-zinc-500 mb-2">Current snapshot</p>
            <div className="w-full h-[160px] sm:h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                    {statusData.map((e, i) => (
                      <Cell key={i} fill={e.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-1.5 mt-2 pt-2 border-t border-zinc-800/60">
            {statusData.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                <span className="text-zinc-400 truncate text-[11px]">{d.name}</span>
                <span className="text-zinc-500 ml-auto font-mono text-[10px] shrink-0">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}