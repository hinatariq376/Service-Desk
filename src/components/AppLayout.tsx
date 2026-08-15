import { useState } from "react";
import type { ReactNode, LucideIcon } from "lucide-react";
import { Shield, AlertCircle, Menu, X } from "lucide-react";
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const notifCount = navItems.reduce((acc, n) => {
    if (typeof n.badge === "number") return acc + n.badge;
    return acc;
  }, 0);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-zinc-950 overflow-hidden w-full">
      {/* 1. Mobile Header Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 text-white w-full z-30 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-xs font-bold text-zinc-50 tracking-tight">Service Desk</div>
            <div className="text-[10px] text-zinc-500">{portalLabel}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white focus:outline-none"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* 2. Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* 3. Responsive Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-60 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full transition-transform duration-200 ease-in-out md:transform-none ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${isMobileMenuOpen ? "flex" : "hidden md:flex"}`}
      >
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
                onClick={() => {
                  onNavigate(item.pageId);
                  setIsMobileMenuOpen(false);
                }}
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

      {/* 4. Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden w-full">
        <TopBar user={user} title={title} onLogout={onLogout} notificationCount={notifCount} />
        {error && (
          <div className="px-4 md:px-6 py-2 bg-red-950/40 border-b border-red-900 flex items-center gap-2 text-xs text-red-300 shrink-0">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="break-words">{error}</span>
          </div>
        )}
        <main className="flex-1 overflow-y-auto bg-zinc-950 relative min-w-0 p-3 sm:p-6">
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