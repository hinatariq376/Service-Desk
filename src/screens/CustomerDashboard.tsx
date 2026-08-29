import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, Ticket, PlusCircle, User, ArrowLeft } from "lucide-react";
import AppLayout from "../components/AppLayout";
import CreateTicketModal from "../components/CreateTicketModal";
import DashboardHome from "../pages/customer/DashboardHome";
import MyTickets from "../pages/customer/MyTickets";
import ProfilePage from "../pages/customer/ProfilePage";
import TicketDetailPane from "../pages/agent/TicketDetailPane";
import { useAuth } from "../context/AuthContext";
import { useTickets } from "../context/TicketContext";

export default function CustomerDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { tickets, messages, loading, error, createNewTicket } = useTickets();
  const [page, setPage] = useState("dashboard");
  const [showModal, setShowModal] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  if (!user) return null;

  const myTickets = tickets;
  const activeCount = myTickets.filter((t) => !["RESOLVED", "CLOSED"].includes(t.status)).length;
  const selectedTicket = selectedTicketId ? tickets.find((t) => t.id === selectedTicketId) : null;

  const PAGE_TITLES: Record<string, string> = {
    dashboard: "Dashboard",
    tickets: "My Tickets",
    create: "Create Request",
    profile: "Profile",
    detail: "Ticket Detail",
  };

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", pageId: "dashboard" },
    { icon: Ticket, label: "My Tickets", pageId: "tickets", badge: activeCount },
    { icon: PlusCircle, label: "Create Request", pageId: "create" },
    { icon: User, label: "Profile", pageId: "profile" },
  ];

  const handleNavigate = (pageId: string) => {
    if (pageId === "create") {
      setShowModal(true);
      return;
    }
    setSelectedTicketId(null);
    setPage(pageId);
  };

  const handleViewTicket = (id: string) => {
    setSelectedTicketId(id);
    setPage("detail");
  };

  const handleCreate = async (partial: {
    title?: string;
    description?: string;
    category?: string;
    priority?: import("../types").Priority;
    attachments?: string[];
  }) => {
    await createNewTicket({
      title: partial.title || "",
      description: partial.description || "",
      category: partial.category || "General",
      priority: partial.priority || "MEDIUM",
      attachments: partial.attachments,
    });
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <>
      <AppLayout
        user={user}
        portalLabel="Customer Portal"
        navItems={navItems}
        activePage={page === "detail" ? "tickets" : page}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        title={PAGE_TITLES[page] || "Dashboard"}
        loading={loading}
        error={error}
      >
        {page === "dashboard" && (
          <DashboardHome tickets={myTickets} onCreateTicket={() => setShowModal(true)} onViewTicket={handleViewTicket} />
        )}
        {page === "tickets" && (
          <MyTickets tickets={myTickets} onCreateTicket={() => setShowModal(true)} onViewTicket={handleViewTicket} />
        )}
        {page === "profile" && <ProfilePage user={user} />}
        {page === "detail" && selectedTicket && (
          <div className="h-full flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
            <div className="px-6 py-3 border-b border-slate-700">
              <button
                type="button"
                onClick={() => setPage("tickets")}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to My Tickets
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <TicketDetailPane
                ticket={selectedTicket}
                messages={messages}
                userRole="CUSTOMER"
                userName={user.name}
              />
            </div>
          </div>
        )}
      </AppLayout>

      {showModal && (
        <CreateTicketModal onClose={() => setShowModal(false)} onSubmit={handleCreate} />
      )}
    </>
  );
}
