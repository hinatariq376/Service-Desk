import { useState } from "react";
import { Search, Download, ChevronDown, Info, RefreshCw } from "lucide-react";
import type { AuditLog } from "../../types";

const ACTION_STYLES: Record<string, string> = {
  STATUS_CHANGED: "text-indigo-700 bg-indigo-50 border-indigo-200",
  SLA_BREACHED: "text-red-700 bg-red-50 border-red-200",
  AGENT_ASSIGNED: "text-blue-700 bg-blue-50 border-blue-200",
  TICKET_CREATED: "text-emerald-700 bg-emerald-50 border-emerald-200",
  SLA_SETTINGS_UPDATED: "text-amber-800 bg-amber-50 border-amber-200",
  PRIORITY_UPDATED: "text-orange-700 bg-orange-50 border-orange-200",
  COMMENT_ADDED: "text-cyan-700 bg-cyan-50 border-cyan-200",
  INTERNAL_NOTE_ADDED: "text-purple-700 bg-purple-50 border-purple-200",
};

function Diff({ old: o, newVal: n }: { old?: Record<string, unknown>; newVal?: Record<string, unknown> }) {
  if (!o && !n) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
      {o && Object.keys(o).length > 0 && (
        <span className="font-mono text-[11px] bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded font-semibold max-w-full sm:max-w-xs truncate">
          -{JSON.stringify(o)}
        </span>
      )}
      {n && Object.keys(n).length > 0 && (
        <span className="font-mono text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-semibold max-w-full sm:max-w-xs truncate">
          +{JSON.stringify(n)}
        </span>
      )}
    </div>
  );
}

interface AuditLogsProps {
  logs: AuditLog[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function AuditLogs({ logs, onRefresh, isRefreshing }: AuditLogsProps) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const actions = ["ALL", ...Array.from(new Set(logs.map((l) => l.action)))];

  const filtered = logs.filter((l) => {
    const q = search.toLowerCase();
    return (
      (l.actorName.toLowerCase().includes(q) || l.entityId.toLowerCase().includes(q) || l.action.toLowerCase().includes(q)) &&
      (actionFilter === "ALL" || l.action === actionFilter)
    );
  });

  return (
    <div className="space-y-5 max-w-7xl mx-auto w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-up">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">System Audit Trail</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable forensic event stream — every mutating state change recorded with actor & diff
          </p>
        </div>
        <div className="flex gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "Refreshing…" : "Refresh"}
            </button>
          )}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-up" style={{ animationDelay: "40ms" }}>
        {[
          { label: "Total Audit Events", value: logs.length },
          { label: "SLA Breach Incidents", value: logs.filter((l) => l.action === "SLA_BREACHED").length },
          { label: "State Machine Transitions", value: logs.filter((l) => l.action === "STATUS_CHANGED").length },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{s.label}</div>
            <div className="text-2xl font-extrabold text-slate-900 tabular-nums">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 animate-fade-up" style={{ animationDelay: "80ms" }}>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actor, ticket ID, action…"
            className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
        >
          {actions.map((a) => (
            <option key={a} value={a}>
              {a === "ALL" ? "All Actions" : a.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500 font-semibold sm:ml-auto">{filtered.length} events</span>
      </div>

      {/* Log Entries */}
      <div className="space-y-2.5 animate-fade-up" style={{ animationDelay: "120ms" }}>
        {filtered.map((log) => (
          <div
            key={log.id}
            className="bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all cursor-pointer shadow-sm"
            onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
          >
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 p-4">
              <div className="flex items-center justify-between md:justify-start gap-3 shrink-0">
                <span className="font-mono text-[11px] text-slate-500 md:w-36 shrink-0 font-medium">
                  {new Date(log.timestamp).toISOString().replace("T", " ").slice(0, 19)} UTC
                </span>
                <div className="flex items-center gap-2 md:w-40 shrink-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${
                      log.actorRole === "ADMIN"
                        ? "bg-purple-600"
                        : log.actorRole === "SUPPORT_AGENT"
                          ? "bg-emerald-600"
                          : "bg-blue-600"
                    }`}
                  >
                    {log.actorName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate leading-none">{log.actorName}</div>
                    <div className="text-[10px] text-slate-500 font-medium mt-0.5">{log.actorRole.replace("_", " ")}</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap md:flex-nowrap flex-1 min-w-0">
                <span
                  className={`font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-md border shrink-0 ${
                    ACTION_STYLES[log.action] || "text-slate-700 bg-slate-100 border-slate-200"
                  }`}
                >
                  {log.action}
                </span>
                <span className="font-mono text-xs font-bold text-indigo-600 shrink-0 md:w-28 truncate">
                  {log.entityId}
                </span>
                <div className="flex-1 min-w-0 w-full md:w-auto mt-1 md:mt-0">
                  <Diff old={log.oldValue} newVal={log.newValue} />
                </div>
              </div>

              <ChevronDown
                className={`w-4 h-4 text-slate-400 shrink-0 self-end md:self-center transition-transform ${
                  expandedId === log.id ? "rotate-180" : ""
                }`}
              />
            </div>

            {expandedId === log.id && (
              <div className="border-t border-slate-200 p-4 bg-slate-50 rounded-b-xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1.5 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5 text-indigo-600" />
                      Entity Metadata
                    </div>
                    <div className="space-y-1 text-slate-700 font-medium">
                      <div>
                        Identifier: <span className="font-mono text-indigo-600 font-bold">{log.entityId}</span>
                      </div>
                      <div>
                        Type: <span className="text-slate-900">{log.entityType}</span>
                      </div>
                      <div>
                        Actor: <span className="text-slate-900 font-semibold">{log.actorName}</span> ({log.actorRole})
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1.5">JSON Payload Diff</div>
                    <pre className="font-mono text-[11px] text-slate-800 bg-white rounded-lg p-3 overflow-auto max-h-36 border border-slate-200 shadow-inner">
                      {JSON.stringify({ before: log.oldValue, after: log.newValue }, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="py-12 text-center bg-white border border-slate-200 rounded-xl text-slate-500 text-xs sm:text-sm">
            No audit records matching your criteria.
          </div>
        )}
      </div>
    </div>
  );
}