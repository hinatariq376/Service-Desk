import { describe, it, expect } from "vitest";
import { computeSLADeadlines, isSLABreached, calculateRemainingTime } from "../src/services/slaService.js";

describe("Backend SLA & Priority Engine Tests", () => {
  it("Calculates CRITICAL priority SLAs accurately (15m response, 4h resolution)", () => {
    const baseTime = new Date("2026-09-07T12:00:00.000Z");
    const deadlines = computeSLADeadlines("CRITICAL", baseTime);

    expect(deadlines.slaResponseDeadline.toISOString()).toBe("2026-09-07T12:15:00.000Z");
    expect(deadlines.slaResolutionDeadline.toISOString()).toBe("2026-09-07T16:00:00.000Z");
    expect(deadlines.slaDeadline.toISOString()).toBe("2026-09-07T16:00:00.000Z");
  });

  it("Calculates HIGH priority SLAs accurately (1h response, 8h resolution)", () => {
    const baseTime = new Date("2026-09-07T12:00:00.000Z");
    const deadlines = computeSLADeadlines("HIGH", baseTime);

    expect(deadlines.slaResponseDeadline.toISOString()).toBe("2026-09-07T13:00:00.000Z");
    expect(deadlines.slaResolutionDeadline.toISOString()).toBe("2026-09-07T20:00:00.000Z");
  });

  it("Calculates MEDIUM priority SLAs accurately (4h response, 24h resolution)", () => {
    const baseTime = new Date("2026-09-07T12:00:00.000Z");
    const deadlines = computeSLADeadlines("MEDIUM", baseTime);

    expect(deadlines.slaResponseDeadline.toISOString()).toBe("2026-09-07T16:00:00.000Z");
    expect(deadlines.slaResolutionDeadline.toISOString()).toBe("2026-09-08T12:00:00.000Z");
  });

  it("Calculates LOW priority SLAs accurately (8h response, 72h resolution)", () => {
    const baseTime = new Date("2026-09-07T12:00:00.000Z");
    const deadlines = computeSLADeadlines("LOW", baseTime);

    expect(deadlines.slaResponseDeadline.toISOString()).toBe("2026-09-07T20:00:00.000Z");
    expect(deadlines.slaResolutionDeadline.toISOString()).toBe("2026-09-10T12:00:00.000Z");
  });

  it("Accurately detects SLA breaches", () => {
    const pastDeadline = new Date(Date.now() - 60000);
    const futureDeadline = new Date(Date.now() + 60000);

    expect(isSLABreached(pastDeadline)).toBe(true);
    expect(isSLABreached(futureDeadline)).toBe(false);
    expect(isSLABreached(futureDeadline, true)).toBe(true);
  });

  it("Formats remaining time correctly", () => {
    const future = new Date(Date.now() + 3661000); // 1 hr, 1 min, 1 sec
    const res = calculateRemainingTime(future);
    expect(res.isBreached).toBe(false);
    expect(res.formatted).toMatch(/01:01:0[0-2]/);
  });
});
