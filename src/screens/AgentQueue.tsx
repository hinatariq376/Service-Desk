import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserCheck, AlertTriangle, Clock as ClockIcon } from "lucide-react";
import AppLayout from "../components/AppLayout";
import TicketListPanel from "../pages/agent/TicketListPanel";
import TicketDetailPane from "../pages/agent/TicketDetailPane";
import { useAuth } from "../context/AuthContext";
import { useTickets } from "../context/TicketContext";
import type { Ticket } from "../types";

type QueueView = "assigned" | "active" | "breach";

const PAGE_TITLES: Record<QueueView, string> = {
  assigned: "Assigned to Me",
  active: "Active Work",
  breach: "SLA Breached",
};

const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function sortByPriority(tickets: Ticket[]) {
  return [...tickets].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

export default function AgentQueue() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { tickets, messages, loading, error } = useTickets();
  const [queueView, setQueueView] = useState<QueueView>("assigned");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!user) return null;

  const assignedToMe = tickets.filter((t) => t.assignedAgentId === user.id);
  const activeAssigned = assignedToMe.filter((t) => !["RESOLVED", "CLOSED"].includes(t.status));
  const slaBreached = assignedToMe.filter((t) => t.slaBreach || new Date(t.slaDeadline) < new Date());

  const VIEW_TICKETS: Record<QueueView, Ticket[]> = {
    assigned: sortByPriority(assignedToMe),
    active: sortByPriority(activeAssigned),
    breach: sortByPriority(slaBreached),
  };

  const EMPTY_MSGS: Record<QueueView, string> = {
    assigned: "No tickets assigned to you. An admin must assign tickets before they appear here.",
    active: "No active tickets assigned to you.",
    breach: "No SLA breaches on your assigned tickets.",
  };

  const listTickets = VIEW_TICKETS[queueView];
  const selectedTicket = tickets.find((t) => t.id === selectedId) || null;

  const navItems = [
    { icon: UserCheck, label: "Assigned to Me", pageId: "assigned", badge: assignedToMe.length },
    { icon: AlertTriangle, label: "Active Work", pageId: "active", badge: activeAssigned.length },
    { icon: ClockIcon, label: "SLA Breached", pageId: "breach", badge: slaBreached.length },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <AppLayout
      user={user}
      portalLabel="Agent Portal"
      navItems={navItems}
      activePage={queueView}
      onNavigate={(id) => {
        setQueueView(id as QueueView);
        setSelectedId(null);
      }}
      onLogout={handleLogout}
      title={PAGE_TITLES[queueView]}
      loading={loading}
      error={error}
    >
      <div className="flex h-full overflow-hidden" style={{ height: "calc(100vh - 56px)" }}>
        <div className="w-80 shrink-0 border-r border-zinc-800 flex flex-col overflow-hidden bg-zinc-900/40">
          <div className="px-4 py-3 border-b border-zinc-800 shrink-0">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              {listTickets.length} ticket{listTickets.length !== 1 ? "s" : ""} — strict assignment isolation
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <TicketListPanel
              tickets={listTickets}
              selectedId={selectedId}
              onSelect={setSelectedId}
              emptyMessage={EMPTY_MSGS[queueView]}
            />
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {selectedTicket ? (
            <TicketDetailPane
              key={selectedTicket.id}
              ticket={selectedTicket}
              messages={messages}
              userRole="SUPPORT_AGENT"
              userName={user.name}
            />
          ) : (
            <div className="flex items-center justify-center h-full flex-col gap-3">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-zinc-600" />
              </div>
              <p className="text-sm text-zinc-500">Select an assigned ticket to view details</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
