import { TicketCheck, Clock, CheckCircle2, PlusCircle, ArrowRight, Activity } from "lucide-react";
import { StatusBadge, PriorityBadge } from "../../components/StatusBadge";
import SLATimer from "../../components/SLATimer";
import type { Ticket } from "../../types";

interface DashboardHomeProps {
  tickets: Ticket[];
  onCreateTicket: () => void;
  onViewTicket: (id: string) => void;
}

export default function DashboardHome({ tickets, onCreateTicket, onViewTicket }: DashboardHomeProps) {
  const active = tickets.filter((t) => !["RESOLVED", "CLOSED"].includes(t.status));
  const awaiting = tickets.filter((t) => t.status === "WAITING_FOR_CUSTOMER");
  const resolved = tickets.filter((t) => ["RESOLVED", "CLOSED"].includes(t.status));
  const recent = tickets.slice(0, 5);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="animate-fade-up">
        <h2 className="text-lg font-bold text-white">Dashboard</h2>
        <p className="text-xs text-slate-500 mt-0.5">Overview of your support requests</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 animate-fade-up" style={{ animationDelay: "40ms" }}>
        {[
          { label: "Active Tickets", value: active.length, icon: TicketCheck, color: "text-indigo-400", bg: "bg-indigo-950/40 border-indigo-900/50" },
          { label: "Awaiting Response", value: awaiting.length, icon: Clock, color: "text-amber-400", bg: "bg-amber-950/30 border-amber-900/40" },
          { label: "Resolved", value: resolved.length, icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-950/30 border-emerald-900/40" },
        ].map((c) => (
          <div key={c.label} className={`rounded-xl border p-4 ${c.bg}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{c.label}</span>
              <c.icon className={`w-4 h-4 ${c.color}`} />
            </div>
            <div className={`text-3xl font-bold tabular-nums ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="animate-fade-up" style={{ animationDelay: "80ms" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-white">Recent Tickets</h3>
          </div>
          <button
            onClick={onCreateTicket}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg px-3 py-1.5 transition-all shadow-md shadow-indigo-900/30"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            New Ticket
          </button>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                {["Ticket ID", "Title", "Priority", "Status", "SLA", "Created"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {recent.map((t, i) => (
                <tr
                  key={t.id}
                  onClick={() => onViewTicket(t.id)}
                  className="hover:bg-slate-800/30 transition-colors cursor-pointer group animate-fade-up"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <td className="px-4 py-3"><span className="font-mono text-xs font-bold text-indigo-400">{t.displayId}</span></td>
                  <td className="px-4 py-3 max-w-xs">
                    <div className="text-sm text-slate-200 truncate">{t.title}</div>
                    <div className="text-[10px] text-slate-500">{t.category}</div>
                  </td>
                  <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3"><SLATimer deadline={t.slaDeadline} breach={t.slaBreach} /></td>
                  <td className="px-4 py-3 text-xs text-slate-500">{new Date(t.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</td>
                  <td className="px-4 py-3"><ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
