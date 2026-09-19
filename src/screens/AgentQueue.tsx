import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserCheck, AlertTriangle, Clock as ClockIcon, ArrowLeft, ShieldAlert, RefreshCw, LogOut, CheckCircle2, AlertCircle } from "lucide-react";
import AppLayout from "../components/AppLayout";
import TicketListPanel from "../pages/agent/TicketListPanel";
import TicketDetailPane from "../pages/agent/TicketDetailPane";
import { useAuth } from "../context/AuthContext";
import { useTickets } from "../context/TicketContext";
import { fetchUserProfile } from "../services/userService";
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
  const { user, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { tickets, messages, loading, error, refresh } = useTickets();
  const [queueView, setQueueView] = useState<QueueView>("assigned");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{
    type: "approved" | "pending" | "denied";
    message: string;
  } | null>(null);

  if (!user) return null;

  // Restrict unapproved / denied agents
  if (user.role === "SUPPORT_AGENT" && (user.isApproved === false || user.approvalStatus === "DENIED")) {
    const isDenied = user.approvalStatus === "DENIED";

    const handleCheckStatus = async () => {
      setRefreshingStatus(true);
      setStatusFeedback(null);
      try {
        const freshProfile = await fetchUserProfile(user.id);
        await refreshProfile();

        if (freshProfile?.isApproved === true || freshProfile?.approvalStatus === "APPROVED") {
          setStatusFeedback({
            type: "approved",
            message: "Admin has approved your account! Redirecting to dashboard...",
          });
          await refresh();
          setTimeout(() => {
            navigate("/agent/dashboard");
          }, 1200);
        } else if (freshProfile?.approvalStatus === "DENIED") {
          setStatusFeedback({
            type: "denied",
            message: "Your Support Agent registration has been reviewed and denied by an administrator.",
          });
        } else {
          setStatusFeedback({
            type: "pending",
            message: "Your account is still pending approval by an administrator.",
          });
        }
      } catch (_) {
        setStatusFeedback({
          type: "pending",
          message: "Your account is still pending approval by an administrator.",
        });
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

          {/* Real-time Status Feedback Toast / Notification */}
          {statusFeedback && (
            <div
              className={`my-3 p-3 rounded-xl border text-xs text-left flex items-start gap-2.5 animate-fade-up ${
                statusFeedback.type === "approved"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : statusFeedback.type === "denied"
                  ? "bg-red-50 border-red-200 text-red-900"
                  : "bg-amber-50 border-amber-200 text-amber-900"
              }`}
            >
              {statusFeedback.type === "approved" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : statusFeedback.type === "denied" ? (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              ) : (
                <ClockIcon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-bold">
                  {statusFeedback.type === "approved"
                    ? "Approval Confirmed!"
                    : statusFeedback.type === "denied"
                    ? "Status: Denied"
                    : "Status: Pending"}
                </p>
                <p className="mt-0.5">{statusFeedback.message}</p>
              </div>
            </div>
          )}

          <div className={`my-4 p-3.5 border rounded-xl text-xs text-left space-y-1 ${
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
              className="flex-1 py-2.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-60 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20"
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

  // 1. "Assigned to Me": Show ALL tickets (both OPEN and CLOSED) assigned to the logged-in agent (assigned_agent_id === currentUser.id)
  const assignedToMe = sortByPriority(
    tickets.filter((t) => t.assignedAgentId === user.id)
  );

  // 2. "Active Work": Show ONLY active tickets assigned to the agent where status is NOT 'CLOSED' and NOT 'RESOLVED' (e.g. status IN ('OPEN', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'PENDING_CUSTOMER'))
  const activeWork = sortByPriority(
    tickets.filter(
      (t) =>
        t.assignedAgentId === user.id &&
        t.status !== "CLOSED" &&
        t.status !== "RESOLVED"
    )
  );

  // 3. "SLA Breached": Show ONLY tickets assigned to the agent where sla_status === 'BREACHED' and status != 'CLOSED'
  const slaBreached = sortByPriority(
    tickets.filter(
      (t) =>
        t.assignedAgentId === user.id &&
        t.status !== "CLOSED" &&
        (t.slaBreach ||
          (t as any).sla_status === "BREACHED" ||
          (t as any).slaStatus === "BREACHED" ||
          new Date(t.slaDeadline) < new Date())
    )
  );

  const VIEW_TICKETS: Record<QueueView, Ticket[]> = {
    assigned: assignedToMe,
    active: activeWork,
    breach: slaBreached,
  };

  const EMPTY_MSGS: Record<QueueView, string> = {
    assigned: "No tickets are currently assigned to you.",
    active: "No active work in progress or pending resolution.",
    breach: "Zero SLA breaches across your assigned work.",
  };

  const listTickets = VIEW_TICKETS[queueView];
  const selectedTicket = tickets.find((t) => t.id === selectedId) || null;

  const navItems = [
    { icon: UserCheck, label: "Assigned to Me", pageId: "assigned", badge: assignedToMe.length },
    { icon: AlertTriangle, label: "Active Work", pageId: "active", badge: activeWork.length },
    { icon: ClockIcon, label: "SLA Breached", pageId: "breach", badge: slaBreached.length },
  ];

  const handleNavigate = (pageId: string) => {
    const nextView = pageId as QueueView;
    setQueueView(nextView);
    const nextFilteredTickets = VIEW_TICKETS[nextView];
    // When switching tabs, clear selected ticket if it does not belong to the active tab's filter
    if (selectedId && !nextFilteredTickets.some((t) => t.id === selectedId)) {
      setSelectedId(null);
    }
  };

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
      onNavigate={handleNavigate}
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