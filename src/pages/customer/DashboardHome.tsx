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
    <div className="space-y-6 max-w-6xl mx-auto w-full min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-up">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Customer Dashboard</h2>
          <p className="text-xs text-slate-500 mt-0.5">Overview of your submitted service requests and support queue</p>
        </div>
        <button
          onClick={onCreateTicket}
          className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-3.5 py-2 transition-all shadow-md shadow-indigo-600/20 shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          Create Request
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-up" style={{ animationDelay: "40ms" }}>
        {[
          { label: "Active Tickets", value: active.length, icon: TicketCheck, color: "text-indigo-600", bg: "bg-white border-slate-200" },
          { label: "Awaiting Your Response", value: awaiting.length, icon: Clock, color: "text-amber-600", bg: "bg-white border-slate-200" },
          { label: "Resolved & Closed", value: resolved.length, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-white border-slate-200" },
        ].map((c) => (
          <div key={c.label} className={`rounded-xl border p-5 shadow-sm ${c.bg}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{c.label}</span>
              <c.icon className={`w-5 h-5 ${c.color}`} />
            </div>
            <div className="text-3xl font-extrabold text-slate-900 tabular-nums">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="animate-fade-up space-y-3" style={{ animationDelay: "80ms" }}>
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-bold text-slate-900">Recent Service Requests</h3>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {["Ticket ID", "Title", "Priority", "Status", "Resolution SLA", "Created"].map((h) => (
                    <th key={h} className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent.map((t, i) => (
                  <tr
                    key={t.id}
                    onClick={() => onViewTicket(t.id)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer group animate-fade-up"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold text-indigo-600">{t.displayId}</span>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <div className="text-sm font-medium text-slate-900 truncate">{t.title}</div>
                      <div className="text-[10px] text-slate-500">{t.category}</div>
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={t.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3">
                      <SLATimer deadline={t.slaDeadline} breach={t.slaBreach} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(t.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {recent.length === 0 && (
              <div className="py-12 text-center text-xs text-slate-500">
                No tickets submitted yet. Click "Create Request" to submit your first ticket.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
