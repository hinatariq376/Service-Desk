import { useState } from "react";
import { ChevronRight, Lock, Send, ToggleLeft, ToggleRight, Tag } from "lucide-react";
import { StatusBadge, PriorityBadge, TransitionErrorBadge } from "../../components/StatusBadge";
import SLATimer from "../../components/SLATimer";
import { useTickets } from "../../context/TicketContext";
import { getAllowedTransitions, getTransitionAction } from "../../lib/stateMachine";
import type { Role, Ticket, Message } from "../../types";

const TRANSITION_COLORS: Record<string, string> = {
  TRIAGED: "bg-purple-600 hover:bg-purple-500 text-white",
  ASSIGNED: "bg-indigo-600 hover:bg-indigo-500 text-white",
  IN_PROGRESS: "bg-amber-500 hover:bg-amber-400 text-zinc-900",
  WAITING_FOR_CUSTOMER: "bg-yellow-500 hover:bg-yellow-400 text-zinc-900",
  RESOLVED: "bg-emerald-600 hover:bg-emerald-500 text-white",
  CLOSED: "bg-zinc-600 hover:bg-zinc-500 text-white",
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

  return (
    <div className="flex flex-col h-full overflow-hidden animate-slide-in min-w-0 w-full">
      {/* Header */}
      <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-zinc-800 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
              <span className="font-mono text-xs font-bold text-indigo-400">{ticket.displayId}</span>
              <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />
              <span className="text-xs text-zinc-500 truncate max-w-[150px] sm:max-w-none">{ticket.category}</span>
            </div>
            <h2 className="text-sm sm:text-base font-bold text-zinc-50 leading-snug break-words">{ticket.title}</h2>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              <span className="text-xs text-zinc-500 truncate">· {ticket.customerName}</span>
              {ticket.assignedAgentName && (
                <span className="text-xs text-zinc-500 truncate">· Assigned: {ticket.assignedAgentName}</span>
              )}
            </div>
          </div>
          <div className="shrink-0 self-start sm:self-auto">
            <SLATimer deadline={ticket.slaDeadline} breach={ticket.slaBreach} size="lg" />
          </div>
        </div>

        {!readOnly && allowed.length > 0 && (
          <div className="flex items-center gap-1.5 sm:gap-2 mt-3 sm:mt-4 flex-wrap">
            <span className="text-xs text-zinc-500 w-full sm:w-auto">Actions:</span>
            {allowed.map((next) => (
              <button
                key={next}
                type="button"
                disabled={submitting}
                onClick={() => handleTransition(next)}
                className={`px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 shrink-0 ${
                  TRANSITION_COLORS[next] ?? "bg-zinc-700 text-white"
                }`}
              >
                {getTransitionAction(ticket.status, next)}
              </button>
            ))}
          </div>
        )}

        {transitionError && (
          <div className="mt-3">
            <TransitionErrorBadge message={transitionError} />
          </div>
        )}

        {ticket.status === "CLOSED" && (
          <p className="text-xs text-zinc-600 italic mt-3">Ticket closed — no further actions available.</p>
        )}
      </div>

      {/* Description */}
      <div className="px-4 py-3 sm:px-6 sm:py-3 border-b border-zinc-800 bg-zinc-900/20 shrink-0 max-h-40 overflow-y-auto">
        <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed break-words">{ticket.description}</p>
        {ticket.tags && ticket.tags.length > 0 && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {ticket.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 text-[10px] font-mono bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded border border-zinc-700"
              >
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Message Thread */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4 space-y-3 min-h-0">
        {thread.length === 0 && (
          <p className="text-xs text-zinc-600 text-center pt-8 italic">No messages yet. Start the conversation below.</p>
        )}
        {thread.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-xl p-3 sm:p-4 ${
              msg.isInternal
                ? "bg-yellow-950/40 border border-yellow-900/50"
                : msg.authorRole === "CUSTOMER"
                  ? "bg-zinc-800/50 border border-zinc-700/40"
                  : "bg-indigo-950/30 border border-indigo-900/30"
            }`}
          >
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${
                    msg.isInternal ? "bg-yellow-700" : msg.authorRole === "CUSTOMER" ? "bg-blue-600" : "bg-indigo-600"
                  }`}
                >
                  {msg.authorName.split(" ").map((n) => n[0]).join("")}
                </div>
                <span className="text-xs font-semibold text-zinc-200 truncate">{msg.authorName}</span>
                {msg.isInternal && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-yellow-500 bg-yellow-950/50 px-1.5 py-0.5 rounded border border-yellow-900/50 shrink-0">
                    <Lock className="w-2.5 h-2.5" /> Internal
                  </span>
                )}
              </div>
              <span className="text-[10px] text-zinc-500 whitespace-nowrap ml-auto">
                {new Date(msg.createdAt).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed break-words">{msg.content}</p>
          </div>
        ))}
      </div>

      {/* Input Box */}
      {canComment && (
        <div className="px-3 sm:px-6 py-3 sm:py-4 border-t border-zinc-800 shrink-0 bg-zinc-950">
          {userRole !== "CUSTOMER" && (
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <button
                type="button"
                onClick={() => setInternalMode(!internalMode)}
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition-all ${
                  internalMode
                    ? "bg-yellow-950/60 text-yellow-400 border-yellow-900"
                    : "text-zinc-500 border-zinc-700 hover:border-zinc-600"
                }`}
              >
                {internalMode ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                Internal Note
              </button>
              <span className="text-[11px] text-zinc-500">
                {internalMode ? "Visible to agents only" : "Customer will see this"}
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
              placeholder={internalMode ? "Add an internal note…" : "Write a reply…"}
              rows={2}
              className={`flex-1 bg-zinc-800 border rounded-lg px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 transition-all resize-none ${
                internalMode ? "border-yellow-800 focus:ring-yellow-600" : "border-zinc-700 focus:ring-indigo-500"
              }`}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!reply.trim() || submitting}
              className={`px-4 py-2.5 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 shrink-0 ${
                internalMode ? "bg-yellow-600 hover:bg-yellow-500 text-zinc-900" : "bg-indigo-600 hover:bg-indigo-500 text-white"
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              Send
            </button>
          </div>
          <p className="text-[10px] text-zinc-600 mt-1.5">⌘ Enter to send · {userName}</p>
        </div>
      )}
    </div>
  );
}