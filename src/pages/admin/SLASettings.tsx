import { Info } from "lucide-react";
import { SLA_POLICIES } from "../../lib/sla";

const COLOR_MAP: Record<string, string> = {
  CRITICAL: "text-red-400 bg-red-950/40 border-red-900",
  HIGH: "text-orange-400 bg-orange-950/40 border-orange-900",
  MEDIUM: "text-yellow-400 bg-yellow-950/40 border-yellow-900",
  LOW: "text-emerald-400 bg-emerald-950/40 border-emerald-900",
};

export default function SLASettings() {
  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-5xl mx-auto w-full min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-50">SLA Settings</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Production SLA engine — response and resolution targets per priority tier
          </p>
        </div>
      </div>

      {/* SLA Policy Cards */}
      <div className="space-y-3 sm:space-y-4 animate-fade-up" style={{ animationDelay: "40ms" }}>
        {(Object.keys(SLA_POLICIES) as Array<keyof typeof SLA_POLICIES>).map((priority) => {
          const policy = SLA_POLICIES[priority];
          return (
            <div key={priority} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3 border-b border-slate-700">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold border ${COLOR_MAP[priority]}`}>
                  {priority}
                </span>
                <span className="text-[10px] sm:text-xs text-slate-400">Enforced on ticket creation</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-slate-700">
                <div className="p-4 sm:p-5">
                  <div className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 sm:mb-2">
                    First Response
                  </div>
                  <div className="font-mono text-xl sm:text-2xl font-bold text-indigo-400">
                    {policy.responseMinutes >= 60
                      ? `${policy.responseMinutes / 60}h`
                      : `${policy.responseMinutes}m`}
                  </div>
                </div>
                <div className="p-4 sm:p-5">
                  <div className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 sm:mb-2">
                    Resolution Target
                  </div>
                  <div className="font-mono text-xl sm:text-2xl font-bold text-emerald-400">
                    {policy.resolutionHours}h
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Notice */}
      <div
        className="flex items-start gap-2.5 text-xs text-slate-500 bg-slate-800 border border-slate-700 rounded-xl p-3.5 sm:p-4 animate-fade-up"
        style={{ animationDelay: "80ms" }}
      >
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-indigo-400" />
        <p className="leading-relaxed">
          SLA deadlines are computed at ticket creation and enforced in database queries. The UI displays a live countdown
          and flags breaches when resolution time is exceeded. Invalid status transitions are rejected with an error badge.
        </p>
      </div>
    </div>
  );
}