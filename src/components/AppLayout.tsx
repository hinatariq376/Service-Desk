import type { ReactNode, LucideIcon } from "lucide-react";
import { Shield, AlertCircle } from "lucide-react";
import TopBar from "./TopBar";
import type { User } from "../types";

export interface NavItem {
  icon: LucideIcon;
  label: string;
  pageId: string;
  badge?: number | string;
}

interface AppLayoutProps {
  user: User;
  portalLabel: string;
  navItems: NavItem[];
  activePage: string;
  onNavigate: (pageId: string) => void;
  onLogout: () => void;
  title: string;
  children: ReactNode;
  loading?: boolean;
  error?: string | null;
}

export default function AppLayout({
  user,
  portalLabel,
  navItems,
  activePage,
  onNavigate,
  onLogout,
  title,
  children,
  loading,
  error,
}: AppLayoutProps) {
  const notifCount = navItems.reduce((acc, n) => {
    if (typeof n.badge === "number") return acc + n.badge;
    return acc;
  }, 0);

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      <aside className="w-60 shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col">
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-zinc-800">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-xs font-bold text-zinc-50 tracking-tight">Service Desk</div>
            <div className="text-[10px] text-zinc-500">{portalLabel}</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.pageId;
            return (
              <button
                key={item.pageId}
                type="button"
                onClick={() => onNavigate(item.pageId)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 text-left ${
                  isActive
                    ? "bg-indigo-600/20 text-indigo-300 font-medium"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isActive ? "bg-indigo-600 text-white" : "bg-zinc-700 text-zinc-300"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar user={user} title={title} onLogout={onLogout} notificationCount={notifCount} />
        {error && (
          <div className="px-6 py-2 bg-red-950/40 border-b border-red-900 flex items-center gap-2 text-xs text-red-300">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </div>
        )}
        <main className="flex-1 overflow-y-auto bg-zinc-950 relative">
          {loading && (
            <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
              <span className="w-6 h-6 border-2 border-zinc-600 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
