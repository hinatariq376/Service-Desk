import { useState } from "react";
import { ChevronRight, Lock, Send, ToggleLeft, ToggleRight, Tag, Sparkles, MessageSquare, Clock, UserCheck } from "lucide-react";
import { StatusBadge, PriorityBadge, TransitionErrorBadge } from "../../components/StatusBadge";
import SLATimer from "../../components/SLATimer";
import { useTickets } from "../../context/TicketContext";
import { getAllowedTransitions, getTransitionAction } from "../../lib/stateMachine";
import type { Role, Ticket, Message } from "../../types";

const TRANSITION_COLORS: Record<string, string> = {
  TRIAGED: "bg-purple-600 hover:bg-purple-700 text-white shadow-sm",
  ASSIGNED: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm",
  IN_PROGRESS: "bg-amber-500 hover:bg-amber-600 text-slate-900 shadow-sm",
  WAITING_FOR_CUSTOMER: "bg-yellow-500 hover:bg-yellow-600 text-slate-900 shadow-sm",
  RESOLVED: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm",
  CLOSED: "bg-slate-600 hover:bg-slate-700 text-white shadow-sm",
};

interface TicketDetailPaneProps {
  ticket: Ticket;
  messages: Message[];
  userRole: Role;
  userName: string;
  readOnly?: boolean;
}

export default function TicketDetailPane({
  ticket,
  messages,
  userRole,
  userName,
  readOnly = false,
}: TicketDetailPaneProps) {
  const { transitionStatus, postComment } = useTickets();
  const [internalMode, setInternalMode] = useState(false);
  const [reply, setReply] = useState("");
  const [transitionError, setTransitionError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const thread = messages.filter((m) => {
    if (m.ticketId !== ticket.id) return false;
    if (userRole === "CUSTOMER") return !m.isInternal;
    return true;
  });

  const allowed = getAllowedTransitions(ticket.status, userRole);
  const canComment =
    !readOnly &&
    (userRole === "CUSTOMER"
      ? !["CLOSED"].includes(ticket.status)
      : userRole === "SUPPORT_AGENT" || userRole === "ADMIN");

  const handleTransition = async (next: typeof ticket.status) => {
    setTransitionError("");
    setSubmitting(true);
    const result = await transitionStatus(ticket, next);
    setSubmitting(false);
    if (result.error) setTransitionError(result.error);
  };

  const handleSend = async () => {
    if (!reply.trim()) return;
    setSubmitting(true);
    try {
      await postComment(ticket.id, reply.trim(), internalMode);
      setReply("");
    } catch (err) {
      setTransitionError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAiAssist = async () => {
    setAiLoading(true);
    try {
      // Rule-based / API heuristic AI generator
      const mainIssue = ticket.description.split(".")[0] || ticket.description;
      const count = thread.length;
      const summary = `AI Analysis: "${ticket.title}". Root symptom: ${mainIssue.trim()}. Priority: ${ticket.priority}. Active thread has ${count} communication log(s).`;
      setAiSummary(summary);
      if (!reply) {
        setReply(`Hi ${ticket.customerName},\n\nWe have reviewed the issue regarding "${ticket.title}". We are actively investigating and will update you shortly.`);
      }
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white min-w-0 w-full">
      {/* Header */}
      <div className="px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-200 bg-white shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
              <span className="font-mono text-xs font-bold text-indigo-600">{ticket.displayId}</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-xs font-medium text-slate-600 truncate max-w-[150px] sm:max-w-none">
                {ticket.category}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug break-words">
              {ticket.title}
            </h2>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              <span className="text-xs text-slate-500 truncate">Customer: <strong className="text-slate-700">{ticket.customerName}</strong></span>
              {ticket.assignedAgentName && (
                <span className="text-xs text-slate-500 truncate">· Assigned: <strong className="text-slate-700">{ticket.assignedAgentName}</strong></span>
              )}
            </div>
          </div>
          <div className="shrink-0 self-start sm:self-auto">
            <SLATimer deadline={ticket.slaDeadline} breach={ticket.slaBreach} size="lg" />
          </div>
        </div>

        {/* Workflow actions */}
        <div className="flex items-center justify-between gap-2 mt-3 sm:mt-4 flex-wrap pt-2 border-t border-slate-100">
          {!readOnly && allowed.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-500">Available Actions:</span>
              {allowed.map((next) => (
                <button
                  key={next}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleTransition(next)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 shrink-0 ${
                    TRANSITION_COLORS[next] ?? "bg-slate-700 text-white"
                  }`}
                >
                  {getTransitionAction(ticket.status, next)}
                </button>
              ))}
            </div>
          )}

          {userRole !== "CUSTOMER" && (
            <button
              type="button"
              onClick={handleAiAssist}
              disabled={aiLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors shadow-sm ml-auto"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              {aiLoading ? "Analyzing…" : "AI Summary & Assist"}
            </button>
          )}
        </div>

        {aiSummary && (
          <div className="mt-3 p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-start gap-2 animate-fade-up">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">
              <span className="font-bold">AI Assistant Summary: </span>
              {aiSummary}
            </div>
          </div>
        )}

        {transitionError && (
          <div className="mt-3">
            <TransitionErrorBadge message={transitionError} />
          </div>
        )}

        {ticket.status === "CLOSED" && (
          <p className="text-xs text-slate-500 italic mt-2">Ticket is closed — record is in read-only audit state.</p>
        )}
      </div>

      {/* Description */}
      <div className="px-4 py-3 sm:px-6 sm:py-3 border-b border-slate-200 bg-slate-50 shrink-0 max-h-40 overflow-y-auto">
        <p className="text-xs sm:text-sm text-slate-800 leading-relaxed break-words">{ticket.description}</p>
        {ticket.tags && ticket.tags.length > 0 && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {ticket.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold bg-white text-slate-700 px-2 py-0.5 rounded border border-slate-300"
              >
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Message Thread */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-3 min-h-0 bg-slate-50/50">
        {thread.length === 0 && (
          <div className="text-center py-8">
            <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
            <p className="text-xs text-slate-500 italic">No messages yet. Send a response to start the conversation.</p>
          </div>
        )}
        {thread.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-xl p-3.5 sm:p-4 shadow-sm ${
              msg.isInternal
                ? "bg-amber-50/90 border border-amber-200 text-amber-950"
                : msg.authorRole === "CUSTOMER"
                  ? "bg-white border border-slate-200 text-slate-900"
                  : "bg-indigo-50/60 border border-indigo-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${
                    msg.isInternal ? "bg-amber-600" : msg.authorRole === "CUSTOMER" ? "bg-blue-600" : "bg-indigo-600"
                  }`}
                >
                  {msg.authorName.split(" ").map((n) => n[0]).join("").toUpperCase()}
                </div>
                <span className="text-xs font-bold text-slate-900 truncate">{msg.authorName}</span>
                {msg.isInternal && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 shrink-0">
                    <Lock className="w-2.5 h-2.5" /> Internal Note (Agent Only)
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium text-slate-500 whitespace-nowrap ml-auto">
                {new Date(msg.createdAt).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-800 leading-relaxed break-words">{msg.content}</p>
          </div>
        ))}
      </div>

      {/* Input Box / Assignment Lock */}
      {userRole === "CUSTOMER" && !ticket.assignedAgentId ? (
        <div className="px-3 sm:px-6 py-4 border-t border-slate-200 shrink-0 bg-slate-50">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber-800">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Your ticket is pending agent assignment.</span>
            </div>
            <p className="text-[11px] text-amber-700 mt-1">
              Messaging will be enabled as soon as a support agent is assigned to your ticket.
            </p>
          </div>
        </div>
      ) : (
        canComment && (
          <div className="px-3 sm:px-6 py-3 sm:py-4 border-t border-slate-200 shrink-0 bg-white">
            {userRole === "CUSTOMER" && ticket.assignedAgentId && (
              <div className="flex items-center gap-2 mb-2.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  Assigned Agent: <strong>{ticket.assignedAgentName || "Support Specialist"}</strong>
                </span>
              </div>
            )}
            {userRole !== "CUSTOMER" && (
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setInternalMode(!internalMode)}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                    internalMode
                      ? "bg-amber-100 text-amber-800 border-amber-300 shadow-sm"
                      : "text-slate-600 border-slate-300 bg-slate-50 hover:bg-slate-100"
                  }`}
                >
                  {internalMode ? <ToggleRight className="w-4 h-4 text-amber-700" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
                  Internal Note
                </button>
                <span className="text-[11px] text-slate-500 font-medium">
                  {internalMode ? "Hidden from customer — visible to agents only" : "Customer will see this response"}
                </span>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
                }}
                placeholder={internalMode ? "Add an internal note for team members…" : "Write a customer reply…"}
                rows={2}
                className={`flex-1 bg-white border rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all resize-none shadow-sm ${
                  internalMode ? "border-amber-300 focus:ring-amber-500" : "border-slate-300 focus:ring-indigo-500"
                }`}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!reply.trim() || submitting}
                className={`px-4 py-2.5 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 shrink-0 shadow-md ${
                  internalMode
                    ? "bg-amber-500 hover:bg-amber-600 text-slate-900 shadow-amber-500/20"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20"
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                Send
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5 font-medium">⌘ + Enter to send · Posting as {userName}</p>
          </div>
        )
      )}
    </div>
  );
}