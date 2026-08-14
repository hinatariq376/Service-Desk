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
        className={`rounded-xl border p-4 ${
          isBreached
            ? "bg-red-950 border-red-800"
            : isWarning
              ? "bg-amber-950 border-amber-700"
              : "bg-slate-900 border-slate-700"
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          {isBreached ? (
            <AlertTriangle className="w-4 h-4 text-red-400 animate-sla-pulse" />
          ) : (
            <Clock className="w-4 h-4 text-slate-400" />
          )}
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {isBreached ? "SLA BREACHED" : "Critical Resolution SLA"}
          </span>
        </div>
        <div
          className={`font-mono text-3xl font-bold tracking-tighter ${
            isBreached ? "text-red-400 animate-sla-pulse" : isWarning ? "text-amber-400" : "text-emerald-400"
          }`}
        >
          {isBreached ? `-${formatDuration(Math.abs(remaining))}` : formatDuration(remaining)}
        </div>
        <div className="text-xs text-slate-500 mt-1">
          {isBreached ? "Resolution overdue" : "Remaining"}
        </div>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-xs font-medium ${
        isBreached ? "text-red-600 animate-sla-pulse" : isWarning ? "text-amber-600" : "text-slate-500"
      }`}
    >
      <Clock className="w-3 h-3" />
      {isBreached ? "BREACHED" : formatDuration(remaining)}
    </span>
  );
}
