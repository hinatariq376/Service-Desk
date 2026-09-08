import { useState, useEffect } from "react";
import { Clock, AlertTriangle } from "lucide-react";

function formatDuration(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((v) => String(v).padStart(2, "0")).join(":");
}

interface SLATimerProps {
  deadline: string;
  breach: boolean;
  size?: "sm" | "lg";
}

export default function SLATimer({ deadline, breach, size = "sm" }: SLATimerProps) {
  const [remaining, setRemaining] = useState(() => new Date(deadline).getTime() - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(new Date(deadline).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  const isBreached = breach || remaining <= 0;
  const isWarning = !isBreached && remaining < 30 * 60 * 1000;

  if (size === "lg") {
    return (
      <div
        className={`rounded-xl border p-3.5 shadow-sm transition-all ${
          isBreached
            ? "bg-red-50 border-red-200 text-red-700"
            : isWarning
              ? "bg-amber-50 border-amber-200 text-amber-800"
              : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        <div className="flex items-center gap-1.5 mb-1">
          {isBreached ? (
            <AlertTriangle className="w-4 h-4 text-red-600 animate-sla-pulse" />
          ) : (
            <Clock className="w-4 h-4 text-slate-500" />
          )}
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            {isBreached ? "SLA BREACHED" : "Resolution SLA Target"}
          </span>
        </div>
        <div
          className={`font-mono text-2xl font-bold tracking-tight ${
            isBreached
              ? "text-red-600 animate-sla-pulse"
              : isWarning
                ? "text-amber-700"
                : "text-emerald-700"
          }`}
        >
          {isBreached ? `-${formatDuration(Math.abs(remaining))}` : formatDuration(remaining)}
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          {isBreached ? "Resolution overdue" : "Remaining target time"}
        </div>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-xs font-semibold px-2 py-0.5 rounded border ${
        isBreached
          ? "bg-red-50 text-red-700 border-red-200 animate-sla-pulse"
          : isWarning
            ? "bg-amber-50 text-amber-800 border-amber-200"
            : "bg-slate-100 text-slate-700 border-slate-200"
      }`}
    >
      <Clock className="w-3 h-3" />
      {isBreached ? "BREACHED" : formatDuration(remaining)}
    </span>
  );
}
