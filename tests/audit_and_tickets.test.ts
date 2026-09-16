import { describe, it, expect, vi, beforeEach } from "vitest";
import { insertAuditLog, fetchAuditLogs, getAuditLogs } from "../src/services/auditService";
import { getAuditLogs as getAuditLogsFromTicketService, getTickets } from "../src/services/ticketService";
import { mapTicket } from "../src/lib/mappers";
import { supabase } from "../src/lib/supabase";

describe("Audit Logs & Ticket Queries Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Audit Log entity_id sanitization", () => {
    it("converts empty string entityId to null instead of empty string", async () => {
      let insertedPayload: any = null;
      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        return {
          insert: (payload: any) => {
            insertedPayload = payload;
            return {
              select: () => Promise.resolve({ data: [{ id: "1", ...payload }], error: null }),
            };
          },
        } as any;
      });

      await insertAuditLog({
        actorId: "00000000-0000-0000-0000-000000000099",
        actorName: "Admin User",
        actorRole: "ADMIN",
        action: "TICKET_CREATED",
        entityId: "", // Empty string passed
        entityType: "TICKET",
      });

      expect(insertedPayload).not.toBeNull();
      expect(insertedPayload.entity_id).toBeNull();
      expect(insertedPayload.entity_id).not.toBe("");
    });

    it("preserves valid UUID string entityId", async () => {
      let insertedPayload: any = null;
      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        return {
          insert: (payload: any) => {
            insertedPayload = payload;
            return {
              select: () => Promise.resolve({ data: [{ id: "1", ...payload }], error: null }),
            };
          },
        } as any;
      });

      const validUUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
      await insertAuditLog({
        actorId: "00000000-0000-0000-0000-000000000099",
        actorName: "Admin User",
        actorRole: "ADMIN",
        action: "TICKET_UPDATED",
        entityId: validUUID,
        entityType: "TICKET",
      });

      expect(insertedPayload).not.toBeNull();
      expect(insertedPayload.entity_id).toBe(validUUID);
    });

    it("converts invalid non-UUID string to null", async () => {
      let insertedPayload: any = null;
      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        return {
          insert: (payload: any) => {
            insertedPayload = payload;
            return {
              select: () => Promise.resolve({ data: [{ id: "1", ...payload }], error: null }),
            };
          },
        } as any;
      });

      await insertAuditLog({
        actorId: "not-a-uuid",
        actorName: "System",
        actorRole: "CUSTOMER",
        action: "STATUS_CHANGED",
        entityId: "invalid-uuid-format",
        entityType: "TICKET",
      });

      expect(insertedPayload.entity_id).toBeNull();
      expect(insertedPayload.actor_id).toBeNull();
    });
  });

  describe("Audit Log queries targeting public.activity_logs", () => {
    it("queries public.activity_logs first", async () => {
      const queriedTables: string[] = [];
      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        queriedTables.push(table);
        return {
          select: () => ({
            order: () => ({
              limit: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "00000000-0000-0000-0000-000000000001",
                      created_at: new Date().toISOString(),
                      actor_id: "00000000-0000-0000-0000-000000000099",
                      actor_name: "Admin User",
                      actor_role: "ADMIN",
                      action: "TICKET_CREATED",
                      entity_id: "00000000-0000-0000-0000-000000000002",
                      entity_type: "TICKET",
                      old_value: null,
                      new_value: null,
                    },
                  ],
                  error: null,
                }),
            }),
          }),
        } as any;
      });

      const logs = await fetchAuditLogs();
      expect(queriedTables).toContain("activity_logs");
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe("TICKET_CREATED");
    });

    it("ticketService fetchAuditLogs & getAuditLogs query public.activity_logs", async () => {
      const queriedTables: string[] = [];
      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        queriedTables.push(table);
        return {
          select: () => ({
            order: () => ({
              limit: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "00000000-0000-0000-0000-000000000001",
                      created_at: new Date().toISOString(),
                      actor_name: "Agent Jack",
                      actor_role: "SUPPORT_AGENT",
                      action: "STATUS_CHANGED",
                      entity_id: null,
                      entity_type: "TICKET",
                      old_value: null,
                      new_value: null,
                    },
                  ],
                  error: null,
                }),
            }),
          }),
        } as any;
      });

      const logs = await getAuditLogsFromTicketService();
      expect(queriedTables).toContain("activity_logs");
      expect(logs.length).toBe(1);
      expect(logs[0].actorName).toBe("Agent Jack");
    });
  });

  describe("Ticket Queries joining users for customer_id and assigned_agent_id", () => {
    it("maps joined customer and assigned_agent fields in mapTicket", () => {
      const dbRow = {
        id: "00000000-0000-0000-0000-000000000100",
        title: "VPN connection issue",
        description: "Cannot connect to office VPN",
        category: "Network",
        priority: "HIGH",
        status: "ASSIGNED",
        customer_id: "00000000-0000-0000-0000-000000000001",
        assigned_agent_id: "00000000-0000-0000-0000-000000000011",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sla_response_deadline: null,
        sla_resolution_deadline: null,
        sla_deadline: null,
        sla_breach: false,
        attachments: [],
        tags: [],
        customer: {
          id: "00000000-0000-0000-0000-000000000001",
          name: "Alice Wonderland",
          email: "alice@example.com",
          role: "CUSTOMER",
          avatar: null,
        },
        assigned_agent: {
          id: "00000000-0000-0000-0000-000000000011",
          name: "Bob Agent",
          email: "bob.agent@example.com",
          role: "SUPPORT_AGENT",
          avatar: null,
        },
      };

      const ticket = mapTicket(dbRow);
      expect(ticket.customerName).toBe("Alice Wonderland");
      expect(ticket.assignedAgentName).toBe("Bob Agent");
      expect(ticket.customerId).toBe("00000000-0000-0000-0000-000000000001");
    });
  });

  describe("Agent Approval & Un-approval Workflow", () => {
    it("approveAgent updates is_approved to true in public.users", async () => {
      let updatedPayload: any = null;
      let targetUserId: string | null = null;
      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        return {
          update: (payload: any) => {
            updatedPayload = payload;
            return {
              eq: (col: string, val: string) => {
                targetUserId = val;
                return Promise.resolve({ error: null });
              },
            };
          },
        } as any;
      });

      const res = await (await import("../src/services/userService")).approveAgent("00000000-0000-0000-0000-000000000011");
      expect(res.error).toBeUndefined();
      expect(targetUserId).toBe("00000000-0000-0000-0000-000000000011");
      expect(updatedPayload.is_approved).toBe(true);
    });

    it("unapproveAgent updates is_approved to false in public.users", async () => {
      let updatedPayload: any = null;
      let targetUserId: string | null = null;
      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        return {
          update: (payload: any) => {
            updatedPayload = payload;
            return {
              eq: (col: string, val: string) => {
                targetUserId = val;
                return Promise.resolve({ error: null });
              },
            };
          },
        } as any;
      });

      const res = await (await import("../src/services/userService")).unapproveAgent("00000000-0000-0000-0000-000000000011");
      expect(res.error).toBeUndefined();
      expect(targetUserId).toBe("00000000-0000-0000-0000-000000000011");
      expect(updatedPayload.is_approved).toBe(false);
    });
  });
});

