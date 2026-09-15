import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserCheck, AlertTriangle, Clock as ClockIcon, ArrowLeft, ShieldAlert, RefreshCw, LogOut } from "lucide-react";
import AppLayout from "../components/AppLayout";
import TicketListPanel from "../pages/agent/TicketListPanel";
import TicketDetailPane from "../pages/agent/TicketDetailPane";
import { useAuth } from "../context/AuthContext";
import { useTickets } from "../context/TicketContext";
import type { Ticket } from "../types";

type QueueView = "assigned" | "active" | "breach";

const PAGE_TITLES: Record<QueueView, string> = {
  assigned: "Assigned to Me",
  active: "Active Work Queue",
  breach: "SLA Breached Queue",
};

const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function sortByPriority(tickets: Ticket[]) {
  return [...tickets].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

export default function AgentQueue() {
  const { user, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { tickets, messages, loading, error, refresh } = useTickets();
  const [queueView, setQueueView] = useState<QueueView>("assigned");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshingStatus, setRefreshingStatus] = useState(false);

  if (!user) return null;

  // Restrict unapproved / denied agents
  if (user.role === "SUPPORT_AGENT" && (user.isApproved === false || user.approvalStatus === "DENIED")) {
    const isDenied = user.approvalStatus === "DENIED";

    const handleCheckStatus = async () => {
      setRefreshingStatus(true);
      try {
        await refreshProfile();
        await refresh();
      } finally {
        setRefreshingStatus(false);
      }
    };

    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-6 sm:p-8 text-center animate-fade-up">
          <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center mx-auto mb-4 ${
            isDenied ? "bg-red-50 border-red-200 text-red-600" : "bg-amber-50 border-amber-200 text-amber-600"
          }`}>
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            {isDenied ? "Account Registration Denied" : "Account Pending Approval"}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
            Welcome, <strong>{user.name}</strong>. {isDenied
              ? "Your Support Agent account registration has been reviewed and denied by an administrator."
              : "Your Support Agent account has been registered and is currently awaiting administrator approval."}
          </p>
          <div className={`my-5 p-3.5 border rounded-xl text-xs text-left space-y-1 ${
            isDenied ? "bg-red-50/80 border-red-200 text-red-800" : "bg-amber-50/80 border-amber-200 text-amber-800"
          }`}>
            <p className="font-bold">{isDenied ? "Status Notice:" : "Next Steps:"}</p>
            {isDenied ? (
              <>
                <p>1. An administrator has denied access for this agent account.</p>
                <p>2. Please contact your system administrator if you require this decision to be re-evaluated.</p>
              </>
            ) : (
              <>
                <p>1. An administrator must verify and approve your agent account on the Admin Dashboard.</p>
                <p>2. Once approved by an administrator, you will gain immediate access to all ticket queues.</p>
              </>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              disabled={refreshingStatus}
              onClick={handleCheckStatus}
              className="flex-1 py-2.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingStatus ? "animate-spin" : ""}`} />
              {refreshingStatus ? "Checking…" : "Check Approval Status"}
            </button>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                navigate("/login");
              }}
              className="py-2.5 px-4 rounded-lg text-xs font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const assignedToMe = tickets.filter((t) => t.assignedAgentId === user.id);
  // Active Work: my assigned active tickets + unassigned tickets any agent can pick up
  const activeAssigned = assignedToMe.filter((t) => !["RESOLVED", "CLOSED"].includes(t.status));
  const unassignedOpen = tickets.filter(
    (t) => !t.assignedAgentId && !["RESOLVED", "CLOSED"].includes(t.status),
  );
  const activeWork = sortByPriority([...activeAssigned, ...unassignedOpen]);
  const slaBreached = assignedToMe.filter((t) => t.slaBreach || new Date(t.slaDeadline) < new Date());

  const VIEW_TICKETS: Record<QueueView, Ticket[]> = {
    assigned: sortByPriority(assignedToMe),
    active: activeWork,
    breach: sortByPriority(slaBreached),
  };

  const EMPTY_MSGS: Record<QueueView, string> = {
    assigned: "No tickets are assigned to you yet. Check Active Work to pick up open tickets.",
    active: "No active tickets in the work queue.",
    breach: "Zero SLA breaches across your assigned work.",
  };

  const listTickets = VIEW_TICKETS[queueView];
  const selectedTicket = tickets.find((t) => t.id === selectedId) || null;

  const navItems = [
    { icon: UserCheck, label: "Assigned to Me", pageId: "assigned", badge: assignedToMe.length },
    { icon: AlertTriangle, label: "Active Work", pageId: "active", badge: activeWork.length },
    { icon: ClockIcon, label: "SLA Breached", pageId: "breach", badge: slaBreached.length },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <AppLayout
      user={user}
      portalLabel="Agent Workspace"
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
      <div className="flex h-full overflow-hidden w-full relative bg-white border border-slate-200 rounded-xl shadow-sm" style={{ height: "calc(100vh - 120px)" }}>
        {/* Ticket List Column */}
        <div
          className={`w-full md:w-80 shrink-0 border-r border-slate-200 flex flex-col overflow-hidden bg-slate-50/50 ${
            selectedId ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="px-4 py-3 border-b border-slate-200 shrink-0 bg-white">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {listTickets.length} Ticket{listTickets.length !== 1 ? "s" : ""} in Queue
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

        {/* Ticket Detail Column */}
        <div className={`flex-1 overflow-hidden flex-col ${selectedId ? "flex" : "hidden md:flex"}`}>
          {selectedTicket ? (
            <div className="flex flex-col h-full w-full min-w-0">
              <div className="md:hidden px-4 py-2.5 border-b border-slate-200 bg-white flex items-center shrink-0">
                <button
                  onClick={() => setSelectedId(null)}
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-600 font-bold hover:text-indigo-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Queue
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <TicketDetailPane
                  key={selectedTicket.id}
                  ticket={selectedTicket}
                  messages={messages}
                  userRole="SUPPORT_AGENT"
                  userName={user.name}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full flex-col gap-3 p-6 text-center bg-slate-50/30">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">No Ticket Selected</h4>
                <p className="text-xs text-slate-500 mt-0.5">Select a ticket from the left panel to review SLA and reply.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}