import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "../lib/supabase";
import { mapTicket } from "../lib/mappers";
import { useAuth } from "./AuthContext";
import {
  addComment,
  assignTicketToAgent,
  createTicket,
  fetchAuditLogs,
  fetchMessagesForTickets,
  fetchTicketsForUser,
  refreshSLABreaches,
  updateTicketPriority,
  updateTicketStatus,
} from "../services/ticketService";
import type { AuditLog, Message, Priority, Ticket, TicketStatus, User } from "../types";

interface TicketContextValue {
  tickets: Ticket[];
  messages: Message[];
  logs: AuditLog[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createNewTicket: (partial: {
    title: string;
    description: string;
    category: string;
    priority: Priority;
    attachments?: string[];
  }) => Promise<Ticket>;
  transitionStatus: (ticket: Ticket, next: TicketStatus) => Promise<{ error?: string }>;
  changePriority: (ticket: Ticket, priority: Priority) => Promise<{ error?: string }>;
  assignAgent: (ticket: Ticket, agent: User | null) => Promise<{ error?: string }>;
  postComment: (ticketId: string, content: string, isInternal: boolean) => Promise<void>;
}

const TicketContext = createContext<TicketContextValue | null>(null);

export function TicketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setTickets([]);
      setMessages([]);
      setLogs([]);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const nextTickets = await fetchTicketsForUser(user);
      await refreshSLABreaches(nextTickets);
      const ticketIds = nextTickets.map((t) => t.id);
      const [nextMessages, nextLogs] = await Promise.all([
        fetchMessagesForTickets(ticketIds),
        user.role === "ADMIN" ? fetchAuditLogs() : Promise.resolve([]),
      ]);
      setTickets(nextTickets);
      setMessages(nextMessages);
      setLogs(nextLogs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`service-desk-live-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tickets" },
        (payload) => {
          console.log("Realtime ticket INSERT received:", payload);
          const newRow = payload.new;
          if (newRow && (!newRow.deleted_at && !newRow.is_deleted)) {
            const mapped = mapTicket(newRow);
            setTickets((prev) => {
              if (prev.some((t) => t.id === mapped.id)) return prev;
              return [mapped, ...prev];
            });
          }
          refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tickets" },
        (payload) => {
          console.log("Realtime ticket UPDATE received:", payload);
          const updatedRow = payload.new;
          if (updatedRow) {
            if (updatedRow.deleted_at || updatedRow.is_deleted) {
              setTickets((prev) => prev.filter((t) => t.id !== updatedRow.id));
            } else {
              const mapped = mapTicket(updatedRow);
              setTickets((prev) =>
                prev.map((t) => (t.id === mapped.id ? { ...t, ...mapped } : t))
              );
            }
          }
          refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "tickets" },
        (payload) => {
          console.log("Realtime ticket DELETE received:", payload);
          const oldRow = payload.old;
          if (oldRow?.id) {
            setTickets((prev) => prev.filter((t) => t.id !== oldRow.id));
          }
          refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ticket_comments" },
        (payload) => {
          console.log("Realtime comment update received:", payload);
          refresh();
        }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () => {
        refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_logs" }, () => {
        if (user.role === "ADMIN") refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_logs" }, () => {
        if (user.role === "ADMIN") refresh();
      })
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          console.log("Supabase Realtime connected successfully for user:", user.email);
        } else if (status === "CHANNEL_ERROR") {
          console.warn("Supabase Realtime channel error:", err);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  const createNewTicket = useCallback(
    async (partial: {
      title: string;
      description: string;
      category: string;
      priority: Priority;
      attachments?: string[];
    }) => {
      if (!user) throw new Error("Not authenticated.");
      const ticket = await createTicket(user, partial);
      await refresh();
      return ticket;
    },
    [user, refresh],
  );

  const transitionStatus = useCallback(
    async (ticket: Ticket, next: TicketStatus) => {
      if (!user) return { error: "Not authenticated." };
      const result = await updateTicketStatus(user, ticket, next);
      if (!result.error) await refresh();
      return result;
    },
    [user, refresh],
  );

  const changePriority = useCallback(
    async (ticket: Ticket, priority: Priority) => {
      if (!user) return { error: "Not authenticated." };
      const result = await updateTicketPriority(user, ticket, priority);
      if (!result.error) await refresh();
      return result;
    },
    [user, refresh],
  );

  const assignAgent = useCallback(
    async (ticket: Ticket, agent: User | null) => {
      if (!user) return { error: "Not authenticated." };
      const result = await assignTicketToAgent(user, ticket, agent ? agent.id : null, agent ? agent.name : undefined);
      if (!result.error) await refresh();
      return result;
    },
    [user, refresh],
  );

  const postComment = useCallback(
    async (ticketId: string, content: string, isInternal: boolean) => {
      if (!user) throw new Error("Not authenticated.");
      await addComment(user, ticketId, content, isInternal);
      await refresh();
    },
    [user, refresh],
  );

  const value = useMemo(
    () => ({
      tickets,
      messages,
      logs,
      loading,
      error,
      refresh,
      createNewTicket,
      transitionStatus,
      changePriority,
      assignAgent,
      postComment,
    }),
    [
      tickets,
      messages,
      logs,
      loading,
      error,
      refresh,
      createNewTicket,
      transitionStatus,
      changePriority,
      assignAgent,
      postComment,
    ],
  );

  return <TicketContext.Provider value={value}>{children}</TicketContext.Provider>;
}

export function useTickets() {
  const ctx = useContext(TicketContext);
  if (!ctx) throw new Error("useTickets must be used within TicketProvider");
  return ctx;
}

/** @deprecated Use useTickets() — kept for gradual migration */
export function useTicketStore() {
  return useTickets();
}
