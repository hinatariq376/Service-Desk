import { Info } from "lucide-react";
import { SLA_POLICIES } from "../../lib/sla";

const COLOR_MAP: Record<string, string> = {
  CRITICAL: "text-red-700 bg-red-50 border-red-200",
  HIGH: "text-orange-700 bg-orange-50 border-orange-200",
  MEDIUM: "text-amber-800 bg-amber-50 border-amber-200",
  LOW: "text-emerald-700 bg-emerald-50 border-emerald-200",
};

export default function SLASettings() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">SLA Policies & Response Thresholds</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated SLA engine — response and resolution deadlines enforced on ticket creation & priority updates
          </p>
        </div>
      </div>

      {/* SLA Policy Cards */}
      <div className="space-y-3.5 animate-fade-up" style={{ animationDelay: "40ms" }}>
        {(Object.keys(SLA_POLICIES) as Array<keyof typeof SLA_POLICIES>).map((priority) => {
          const policy = SLA_POLICIES[priority];
          return (
            <div key={priority} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold border ${COLOR_MAP[priority]}`}>
                  {priority} PRIORITY
                </span>
                <span className="text-xs text-slate-500 font-medium">Enforced at creation timestamp</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                <div className="p-5">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    First-Response Target
                  </div>
                  <div className="font-mono text-2xl font-bold text-indigo-600">
                    {policy.responseMinutes >= 60
                      ? `${policy.responseMinutes / 60} Hour${policy.responseMinutes / 60 > 1 ? "s" : ""}`
                      : `${policy.responseMinutes} Minutes`}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Maximum allowed time before first agent reply</p>
                </div>
                <div className="p-5">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Full Resolution Deadline
                  </div>
                  <div className="font-mono text-2xl font-bold text-emerald-600">
                    {policy.resolutionHours} Hours
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Maximum allowed elapsed time before ticket is resolved</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Notice */}
      <div
        className="flex items-start gap-3 text-xs text-slate-700 bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 animate-fade-up shadow-sm"
        style={{ animationDelay: "80ms" }}
      >
        <Info className="w-5 h-5 mt-0.5 shrink-0 text-indigo-600" />
        <p className="leading-relaxed">
          <strong className="font-bold text-indigo-950">Engine Rule: </strong>
          Deadlines are computed deterministically at ticket creation based on Priority level. The frontend renders real-time countdowns and changes badge indicators on breach. The state machine strictly blocks illegal transitions (such as moving from OPEN to RESOLVED directly).
        </p>
      </div>
    </div>
  );
}