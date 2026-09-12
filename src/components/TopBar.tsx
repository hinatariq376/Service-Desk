import { useState, useRef, useEffect } from "react";
import { Bell, LogOut, ChevronDown, X, CheckCheck } from "lucide-react";
import type { User } from "../types";
import { useNotifications } from "../context/NotificationContext";

interface TopBarProps {
  user: User;
  title: string;
  onLogout: () => void;
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

const NOTIF_TYPE_STYLES: Record<string, string> = {
  TICKET_CREATED: "bg-indigo-100 text-indigo-700",
  STATUS_CHANGED: "bg-blue-100 text-blue-700",
  AGENT_ASSIGNED: "bg-emerald-100 text-emerald-700",
  COMMENT_ADDED: "bg-cyan-100 text-cyan-700",
  INTERNAL_NOTE_ADDED: "bg-purple-100 text-purple-700",
  SLA_BREACH_WARNING: "bg-amber-100 text-amber-700",
  SLA_BREACHED: "bg-red-100 text-red-700",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function TopBar({ user, title, onLogout }: TopBarProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const { notifications, unreadCount, markRead, markAllRead, dismiss } = useNotifications();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel when clicking outside
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  const handleNotifClick = async (id: string) => {
    await markRead(id);
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm">
      <h1 className="text-sm font-semibold text-slate-900">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
            aria-label={`Notifications (${unreadCount} unread)`}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-indigo-600 text-white text-[9px] font-bold px-0.5 ring-2 ring-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-10 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-up">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Notifications
                  {unreadCount > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold">
                      {unreadCount}
                    </span>
                  )}
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead()}
                    className="flex items-center gap-1 text-[10px] text-indigo-600 font-semibold cursor-pointer hover:text-indigo-700 transition-colors"
                  >
                    <CheckCheck className="w-3 h-3" />
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No notifications yet
                  </div>
                ) : (
                  notifications.slice(0, 20).map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotifClick(n.id)}
                      className={`px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors relative group ${
                        !n.isRead ? "bg-indigo-50/60" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
                        )}
                        <div className={`flex-1 min-w-0 ${n.isRead ? "pl-3.5" : ""}`}>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                                NOTIF_TYPE_STYLES[n.type] || "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {n.type.replace(/_/g, " ")}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-slate-800 leading-tight truncate">
                            {n.title}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-tight line-clamp-2">
                            {n.body}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1 font-medium">
                            {timeAgo(n.createdAt)}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dismiss(n.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-all shrink-0"
                          aria-label="Dismiss notification"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {notifications.length > 20 && (
                <div className="px-4 py-2 border-t border-slate-200 text-center">
                  <span className="text-[10px] text-slate-400">
                    {notifications.length - 20} more notifications
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User info */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div
            className={`w-7 h-7 rounded-lg ${ROLE_COLORS[user.role] || "bg-slate-200"} flex items-center justify-center text-xs font-bold text-white`}
          >
            {user.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </div>
          <div className="hidden sm:block">
            <div className="text-xs font-semibold text-slate-900 leading-none">{user.name}</div>
            <div className="text-[10px] text-slate-600 mt-0.5">{ROLE_LABELS[user.role]}</div>
          </div>
          <ChevronDown className="w-3 h-3 text-slate-500 hidden sm:block" />
        </div>

        <button
          onClick={onLogout}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
