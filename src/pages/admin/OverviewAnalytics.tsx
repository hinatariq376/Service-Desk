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
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#0f172a",
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#f59e0b",
  LOW: "#10b981",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "#3b82f6",
  TRIAGED: "#a855f7",
  ASSIGNED: "#6366f1",
  IN_PROGRESS: "#f59e0b",
  WAITING_FOR_CUSTOMER: "#eab308",
  RESOLVED: "#10b981",
  CLOSED: "#64748b",
};

const KPI_COLOR_MAP: Record<string, string> = {
  indigo: "text-indigo-600",
  amber: "text-amber-600",
  red: "text-red-600",
  emerald: "text-emerald-600",
};

interface OverviewAnalyticsProps {
  tickets: TicketType[];
}

export default function OverviewAnalytics({ tickets }: OverviewAnalyticsProps) {
  const open = tickets.filter((t) => t.status === "OPEN").length;
  const inProgress = tickets.filter((t) => t.status === "IN_PROGRESS").length;
  const breached = tickets.filter((t) => t.slaBreach || new Date(t.slaDeadline) < new Date()).length;
  const breachRate = tickets.length ? ((breached / tickets.length) * 100).toFixed(1) : "0.0";

  const priorityData = useMemo(() => {
    const counts: Record<Priority, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    tickets.forEach((t) => {
      counts[t.priority] = (counts[t.priority] || 0) + 1;
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
      fill: STATUS_COLORS[status as TicketStatus] ?? "#64748b",
    }));
  }, [tickets]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Overview Analytics & Telemetry</h2>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
            Live Dashboard Metrics across {tickets.length} total tickets
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up" style={{ animationDelay: "40ms" }}>
        {[
          { label: "Total Tickets", value: tickets.length.toLocaleString(), icon: Ticket, trend: "All time count", up: false, color: "indigo", sub: "Global system volume" },
          { label: "Open Queue", value: open.toLocaleString(), icon: AlertTriangle, trend: "Requires triage", up: open > 0, color: "amber", sub: "OPEN status" },
          { label: "SLA Breach Rate", value: `${breachRate}%`, icon: Clock, trend: `${breached} total breached`, up: breached > 0, color: "red", sub: "Resolution target" },
          { label: "Active In-Progress", value: inProgress.toLocaleString(), icon: Activity, trend: "Under agent resolution", up: false, color: "emerald", sub: "Active work" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{kpi.label}</span>
              <kpi.icon className={`w-5 h-5 ${KPI_COLOR_MAP[kpi.color] ?? "text-slate-500"}`} />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 tabular-nums">{kpi.value}</div>
            <div className={`flex items-center gap-1 mt-1.5 text-xs font-semibold ${kpi.up ? "text-red-600" : "text-emerald-600"}`}>
              {kpi.up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {kpi.trend}
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 animate-fade-up" style={{ animationDelay: "80ms" }}>
        {/* Priority Bar Chart */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-5 shadow-sm min-w-0">
          <h3 className="text-sm font-bold text-slate-900 mb-0.5">Tickets by Priority Distribution</h3>
          <p className="text-xs text-slate-500 mb-4">Volume breakdown across priority tiers</p>
          <div className="w-full h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP} cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {priorityData.map((e, i) => (
                    <Cell key={i} fill={e.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Pie Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm min-w-0 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-0.5">Tickets by Status</h3>
            <p className="text-xs text-slate-500 mb-2">Current state distribution</p>
            <div className="w-full h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={42} outerRadius={68} paddingAngle={4} dataKey="value">
                    {statusData.map((e, i) => (
                      <Cell key={i} fill={e.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-3 border-t border-slate-100">
            {statusData.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                <span className="text-slate-600 truncate text-[11px] font-medium">{d.name}</span>
                <span className="text-slate-900 ml-auto font-mono text-[11px] font-bold shrink-0">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}