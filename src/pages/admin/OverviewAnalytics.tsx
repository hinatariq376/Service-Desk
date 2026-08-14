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
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h2 className="text-lg font-bold text-zinc-50">Overview Analytics</h2>
          <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            Live — synced from Supabase PostgreSQL
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up" style={{ animationDelay: "40ms" }}>
        {[
          { label: "Total Tickets", value: tickets.length.toLocaleString(), icon: Ticket, trend: "Live count", up: false, color: "indigo", sub: "All roles" },
          { label: "Open Queue", value: open.toLocaleString(), icon: AlertTriangle, trend: "Needs triage", up: open > 0, color: "amber", sub: "OPEN status" },
          { label: "SLA Breach Rate", value: `${breachRate}%`, icon: Clock, trend: `${breached} breached`, up: breached > 0, color: "red", sub: "Resolution SLA" },
          { label: "In Progress", value: inProgress.toLocaleString(), icon: Activity, trend: "Active work", up: false, color: "emerald", sub: "Agent queue" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{kpi.label}</span>
              <kpi.icon className={`w-4 h-4 text-${kpi.color}-400`} />
            </div>
            <div className="text-2xl font-bold text-zinc-50 tabular-nums">{kpi.value}</div>
            <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${kpi.up ? "text-red-400" : "text-emerald-400"}`}>
              {kpi.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {kpi.trend}
              <span className="text-zinc-600 ml-1">{kpi.sub}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 animate-fade-up" style={{ animationDelay: "80ms" }}>
        <div className="lg:col-span-3 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-zinc-50 mb-1">Tickets by Priority</h3>
          <p className="text-xs text-zinc-500 mb-4">Current distribution</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={priorityData} barCategoryGap="30%">
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
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-zinc-50 mb-1">By Status</h3>
          <p className="text-xs text-zinc-500 mb-2">Current snapshot</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={68} paddingAngle={3} dataKey="value">
                {statusData.map((e, i) => (
                  <Cell key={i} fill={e.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-1 gap-1 mt-2">
            {statusData.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                <span className="text-zinc-400 truncate">{d.name}</span>
                <span className="text-zinc-500 ml-auto font-mono text-[10px]">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
