import { useState, useEffect } from "react";
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
import { getTickets } from "../services/ticketService";
import type { Ticket as TicketType } from "../types";

export default function CustomerDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { tickets, messages, loading: contextLoading, error: contextError, createNewTicket } = useTickets();
  const [customerTickets, setCustomerTickets] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState("dashboard");
  const [showModal, setShowModal] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    setLoading(true);

    getTickets(user.id, user.role)
      .then((data) => {
        if (isMounted) {
          setCustomerTickets(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load tickets.");
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.role, tickets]);

  if (!user) return null;

  const myTickets = customerTickets;
  const activeCount = myTickets.filter((t) => !["RESOLVED", "CLOSED"].includes(t.status)).length;
  const selectedTicket = selectedTicketId
    ? myTickets.find((t) => t.id === selectedTicketId) || tickets.find((t) => t.id === selectedTicketId) || null
    : null;

  const PAGE_TITLES: Record<string, string> = {
    dashboard: "Customer Dashboard",
    tickets: "My Tickets",
    create: "Create Request",
    profile: "Profile Settings",
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
    title: string;
    description: string;
    category: string;
    priority: import("../types").Priority;
    attachments?: string[];
  }) => {
    await createNewTicket(partial);
    if (user) {
      const data = await getTickets(user.id, user.role);
      setCustomerTickets(data);
    }
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
          <div className="h-full flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm" style={{ height: "calc(100vh - 120px)" }}>
            <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center">
              <button
                type="button"
                onClick={() => setPage("tickets")}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
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
