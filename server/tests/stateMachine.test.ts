import { describe, it, expect } from "vitest";
import { canTransition, validateTransition, getAllowedTransitions } from "../src/services/stateMachineService.js";

describe("Backend Ticket State Machine Tests", () => {
  it("Enforces legal sequence for agents and admins", () => {
    expect(canTransition("OPEN", "TRIAGED", "ADMIN")).toBe(true);
    expect(canTransition("TRIAGED", "ASSIGNED", "SUPPORT_AGENT")).toBe(true);
    expect(canTransition("ASSIGNED", "IN_PROGRESS", "SUPPORT_AGENT")).toBe(true);
    expect(canTransition("IN_PROGRESS", "WAITING_FOR_CUSTOMER", "SUPPORT_AGENT")).toBe(true);
    expect(canTransition("WAITING_FOR_CUSTOMER", "IN_PROGRESS", "SUPPORT_AGENT")).toBe(true);
    expect(canTransition("IN_PROGRESS", "RESOLVED", "SUPPORT_AGENT")).toBe(true);
    expect(canTransition("RESOLVED", "CLOSED", "ADMIN")).toBe(true);
  });

  it("Blocks illegal transitions for agents (e.g. RESOLVED -> IN_PROGRESS, OPEN -> RESOLVED)", () => {
    expect(canTransition("RESOLVED", "IN_PROGRESS", "SUPPORT_AGENT")).toBe(false);
    expect(canTransition("OPEN", "RESOLVED", "SUPPORT_AGENT")).toBe(false);
    expect(canTransition("CLOSED", "OPEN", "ADMIN")).toBe(false);
  });

  it("Customer can ONLY perform RESOLVED -> CLOSED", () => {
    expect(canTransition("RESOLVED", "CLOSED", "CUSTOMER")).toBe(true);
    expect(canTransition("OPEN", "TRIAGED", "CUSTOMER")).toBe(false);
    expect(canTransition("ASSIGNED", "IN_PROGRESS", "CUSTOMER")).toBe(false);
    expect(canTransition("IN_PROGRESS", "RESOLVED", "CUSTOMER")).toBe(false);
  });

  it("validateTransition returns formatted API error for illegal moves", () => {
    const res = validateTransition("RESOLVED", "IN_PROGRESS", "SUPPORT_AGENT");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("INVALID_STATUS_TRANSITION");
      expect(res.message).toContain("RESOLVED");
    }
  });

  it("getAllowedTransitions returns valid next states", () => {
    expect(getAllowedTransitions("OPEN", "SUPPORT_AGENT")).toEqual(["TRIAGED"]);
    expect(getAllowedTransitions("IN_PROGRESS", "SUPPORT_AGENT")).toEqual(["WAITING_FOR_CUSTOMER", "RESOLVED"]);
    expect(getAllowedTransitions("RESOLVED", "CUSTOMER")).toEqual(["CLOSED"]);
    expect(getAllowedTransitions("OPEN", "CUSTOMER")).toEqual([]);
  });
});
