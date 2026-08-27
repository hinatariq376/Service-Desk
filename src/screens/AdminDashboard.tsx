import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart2, Users, Ticket, FileText, Settings } from "lucide-react";
import AppLayout from "../components/AppLayout";
import OverviewAnalytics from "../pages/admin/OverviewAnalytics";
import UserManagement from "../pages/admin/UserManagement";
import AllSystemTickets from "../pages/admin/AllSystemTickets";
import AuditLogs from "../pages/admin/AuditLogs";
import SLASettings from "../pages/admin/SLASettings";
import { useAuth } from "../context/AuthContext";
import { useTickets } from "../context/TicketContext";

type AdminPage = "analytics" | "users" | "tickets" | "audit" | "sla";

const PAGE_TITLES: Record<AdminPage, string> = {
  analytics: "Overview Analytics",
  users: "User Management",
  tickets: "All System Tickets",
  audit: "Audit Logs",
  sla: "SLA Settings",
};

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { tickets, logs, loading, error, refresh } = useTickets();
  const [page, setPage] = useState<AdminPage>("analytics");
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!user) return null;

  const navItems = [
    { icon: BarChart2, label: "Overview Analytics", pageId: "analytics" },
    { icon: Users, label: "User Management", pageId: "users" },
    { icon: Ticket, label: "All System Tickets", pageId: "tickets", badge: `${tickets.length}` },
    { icon: FileText, label: "Audit Logs", pageId: "audit" },
    { icon: Settings, label: "SLA Settings", pageId: "sla" },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <AppLayout
      user={user}
      portalLabel="Admin Portal"
      navItems={navItems}
      activePage={page}
      onNavigate={(id) => setPage(id as AdminPage)}
      onLogout={handleLogout}
      title={PAGE_TITLES[page]}
      loading={loading}
      error={error}
    >
      <div className="w-full min-w-0 h-full overflow-y-auto p-3 sm:p-6">
        {page === "analytics" && <OverviewAnalytics tickets={tickets} />}
        {page === "users" && <UserManagement />}
        {page === "tickets" && <AllSystemTickets tickets={tickets} />}
        {page === "audit" && <AuditLogs logs={logs} onRefresh={handleRefresh} isRefreshing={isRefreshing} />}
        {page === "sla" && <SLASettings />}
      </div>
    </AppLayout>
  );
}