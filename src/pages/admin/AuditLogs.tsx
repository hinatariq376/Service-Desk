import { useState } from "react";
import { Search, Download, ChevronDown, Info, RefreshCw } from "lucide-react";
import type { AuditLog } from "../../types";

const ACTION_STYLES: Record<string, string> = {
  STATUS_CHANGED: "text-indigo-400 bg-indigo-950/40 border-indigo-900/50",
  SLA_BREACHED: "text-red-400 bg-red-950/40 border-red-900/50",
  AGENT_ASSIGNED: "text-blue-400 bg-blue-950/40 border-blue-900/50",
  TICKET_CREATED: "text-emerald-400 bg-emerald-950/40 border-emerald-900/50",
  SLA_SETTINGS_UPDATED: "text-amber-400 bg-amber-950/40 border-amber-900/50",
  PRIORITY_UPDATED: "text-orange-400 bg-orange-950/40 border-orange-900/50",
  COMMENT_ADDED: "text-cyan-400 bg-cyan-950/40 border-cyan-900/50",
  INTERNAL_NOTE_ADDED: "text-purple-400 bg-purple-950/40 border-purple-900/50",
};

function Diff({ old: o, newVal: n }: { old?: Record<string, unknown>; newVal?: Record<string, unknown> }) {
  if (!o && !n) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
      {o && Object.keys(o).length > 0 && (
        <span className="font-mono text-[10px] bg-red-950/50 text-red-400 border border-red-900/40 px-1.5 py-0.5 rounded max-w-full sm:max-w-xs truncate">
          -{JSON.stringify(o)}
        </span>
      )}
      {n && Object.keys(n).length > 0 && (
        <span className="font-mono text-[10px] bg-emerald-950/50 text-emerald-400 border border-emerald-900/40 px-1.5 py-0.5 rounded max-w-full sm:max-w-xs truncate">
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
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-5 max-w-7xl mx-auto w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-up">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-zinc-50">Audit Trail</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Immutable event log — every actor action recorded with timestamp and diff
          </p>
        </div>
        <div className="flex gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="self-start sm:self-auto inline-flex items-center gap-1.5 text-xs text-zinc-400 border border-zinc-700 rounded-lg px-3 py-2 hover:border-zinc-600 hover:text-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          )}
          <button
            type="button"
            className="self-start sm:self-auto inline-flex items-center gap-1.5 text-xs text-zinc-400 border border-zinc-700 rounded-lg px-3 py-2 hover:border-zinc-600 hover:text-zinc-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-up" style={{ animationDelay: "40ms" }}>
        {[
          { label: "Total Events", value: logs.length },
          { label: "SLA Breach Events", value: logs.filter((l) => l.action === "SLA_BREACHED").length },
          { label: "Status Changes", value: logs.filter((l) => l.action === "STATUS_CHANGED").length },
        ].map((s) => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 sm:p-4">
            <div className="text-xs text-zinc-500 mb-1">{s.label}</div>
            <div className="text-xl sm:text-2xl font-bold text-zinc-100">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 animate-fade-up" style={{ animationDelay: "80ms" }}>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actor, entity, action…"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3.5 py-2 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs sm:text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {actions.map((a) => (
            <option key={a} value={a}>
              {a === "ALL" ? "All Actions" : a.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <span className="text-xs text-zinc-500 sm:ml-auto">{filtered.length} events</span>
      </div>

      {/* Log Entries */}
      <div className="space-y-2 animate-fade-up" style={{ animationDelay: "120ms" }}>
        {filtered.map((log, i) => (
          <div
            key={log.id}
            className="bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-all cursor-pointer"
            onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
          >
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 p-3.5 sm:p-4">
              <div className="flex items-center justify-between md:justify-start gap-3 shrink-0">
                <span className="font-mono text-[10px] text-zinc-500 md:w-36 shrink-0">
                  {new Date(log.timestamp).toISOString().replace("T", " ").slice(0, 19)} UTC
                </span>
                <div className="flex items-center gap-1.5 md:w-36 shrink-0">
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${
                      log.actorRole === "ADMIN" ? "bg-purple-600" : log.actorRole === "SUPPORT_AGENT" ? "bg-emerald-600" : "bg-blue-600"
                    }`}
                  >
                    {log.actorName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-zinc-200 truncate leading-none">{log.actorName}</div>
                    <div className="text-[9px] text-zinc-500 mt-0.5">{log.actorRole.replace("_", " ")}</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap md:flex-nowrap flex-1 min-w-0">
                <span
                  className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${
                    ACTION_STYLES[log.action] || "text-zinc-400 bg-zinc-800 border-zinc-700"
                  }`}
                >
                  {log.action}
                </span>
                <span className="font-mono text-xs text-indigo-400 shrink-0 md:w-28 truncate">{log.entityId}</span>
                <div className="flex-1 min-w-0 w-full md:w-auto mt-1 md:mt-0">
                  <Diff old={log.oldValue} newVal={log.newValue} />
                </div>
              </div>

              <ChevronDown
                className={`w-3.5 h-3.5 text-zinc-500 shrink-0 self-end md:self-center transition-transform ${
                  expandedId === log.id ? "rotate-180" : ""
                }`}
              />
            </div>

            {expandedId === log.id && (
              <div className="border-t border-zinc-800 p-3.5 sm:p-4 bg-zinc-800/30 rounded-b-xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="text-zinc-500 font-semibold uppercase tracking-wider text-[10px] mb-1.5 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      Entity Details
                    </div>
                    <div className="space-y-1 text-zinc-300">
                      <div>
                        ID: <span className="font-mono text-indigo-400">{log.entityId}</span>
                      </div>
                      <div>
                        Type: <span className="text-zinc-200">{log.entityType}</span>
                      </div>
                      <div>
                        Actor: <span className="text-zinc-200">{log.actorName}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-500 font-semibold uppercase tracking-wider text-[10px] mb-1.5">Full Diff</div>
                    <pre className="font-mono text-[10px] text-zinc-400 bg-zinc-950 rounded-lg p-2.5 overflow-auto max-h-32 border border-zinc-800">
                      {JSON.stringify({ before: log.oldValue, after: log.newValue }, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="py-12 text-center bg-zinc-900 border border-zinc-800 rounded-xl">
            <p className="text-zinc-500 text-xs sm:text-sm">No events match the search criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}