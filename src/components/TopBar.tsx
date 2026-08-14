import { useState } from "react";
import { Bell, LogOut, ChevronDown } from "lucide-react";
import type { User } from "../types";

interface TopBarProps {
  user: User;
  title: string;
  onLogout: () => void;
  notificationCount?: number;
}

const ROLE_COLORS: Record<string, string> = {
  CUSTOMER: "bg-blue-600",
  SUPPORT_AGENT: "bg-emerald-600",
  ADMIN: "bg-purple-600",
};

const ROLE_LABELS: Record<string, string> = {
  CUSTOMER: "Customer",
  SUPPORT_AGENT: "Support Agent",
  ADMIN: "Administrator",
};

export default function TopBar({ user, title, onLogout, notificationCount = 3 }: TopBarProps) {
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0">
      <h1 className="text-sm font-semibold text-white">{title}</h1>

      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <Bell className="w-4 h-4" />
            {notificationCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-slate-900" />
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-10 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-up">
              <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Notifications</span>
                <span className="text-[10px] text-indigo-400 font-medium cursor-pointer hover:text-indigo-300">
                  Mark all read
                </span>
              </div>
              {[
                { msg: "TCK-80491 SLA warning: 1h 42m remaining", time: "2m ago", unread: true },
                { msg: "TCK-80390 SLA breached — immediate action required", time: "22m ago", unread: true },
                { msg: "New reply on TCK-80322 from Alex Chen", time: "1h ago", unread: false },
              ].map((n, i) => (
                <div
                  key={i}
                  className={`px-4 py-3 border-b border-slate-700/50 last:border-0 ${
                    n.unread ? "bg-indigo-950/30" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {n.unread && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />}
                    <div className={!n.unread ? "pl-3.5" : ""}>
                      <p className="text-xs text-slate-200">{n.msg}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{n.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div
            className={`w-7 h-7 rounded-lg ${ROLE_COLORS[user.role] || "bg-slate-600"} flex items-center justify-center text-xs font-bold text-white`}
          >
            {user.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </div>
          <div className="hidden sm:block">
            <div className="text-xs font-semibold text-white leading-none">{user.name}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{ROLE_LABELS[user.role]}</div>
          </div>
          <ChevronDown className="w-3 h-3 text-slate-500 hidden sm:block" />
        </div>

        <button
          onClick={onLogout}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-all"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
