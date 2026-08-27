/**
 * Unit tests for src/lib/sla.ts
 *
 * Covers:
 *  - SLA_POLICIES shape and values
 *  - computeSLADeadlines  (all four priorities, custom createdAt, default createdAt)
 *  - isSLABreached        (breach flag short-circuit, wall-clock past/future, edge cases)
 *  - Interaction between computeSLADeadlines output and isSLABreached
 *
 * All time-sensitive assertions use vi.useFakeTimers() so they are
 * deterministic regardless of when the test suite runs.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SLA_POLICIES,
  computeSLADeadlines,
  isSLABreached,
  type SLAPolicy,
} from './sla';
import type { Priority } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const MINUTE = 60 * 1000;        // ms
const HOUR   = 60 * MINUTE;      // ms

/** Parse an ISO string and return its epoch ms. */
function ms(iso: string): number {
  return new Date(iso).getTime();
}

/** Returns a fixed anchor date used across tests: 2024-01-15T10:00:00.000Z */
function anchor(): Date {
  return new Date('2024-01-15T10:00:00.000Z');
}

// ---------------------------------------------------------------------------
// SLA_POLICIES
// ---------------------------------------------------------------------------
describe('SLA_POLICIES', () => {
  const priorities: Priority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

  it('defines a policy for every priority', () => {
    for (const p of priorities) {
      expect(SLA_POLICIES).toHaveProperty(p);
    }
  });

  it('each policy has positive responseMinutes and resolutionHours', () => {
    for (const p of priorities) {
      const policy: SLAPolicy = SLA_POLICIES[p];
      expect(policy.responseMinutes).toBeGreaterThan(0);
      expect(policy.resolutionHours).toBeGreaterThan(0);
    }
  });

  it('CRITICAL has the tightest deadlines', () => {
    expect(SLA_POLICIES.CRITICAL.responseMinutes).toBeLessThan(SLA_POLICIES.HIGH.responseMinutes);
    expect(SLA_POLICIES.CRITICAL.resolutionHours).toBeLessThan(SLA_POLICIES.HIGH.resolutionHours);
  });

  it('response windows tighten as priority increases: LOW > MEDIUM > HIGH > CRITICAL', () => {
    expect(SLA_POLICIES.LOW.responseMinutes)
      .toBeGreaterThan(SLA_POLICIES.MEDIUM.responseMinutes);
    expect(SLA_POLICIES.MEDIUM.responseMinutes)
      .toBeGreaterThan(SLA_POLICIES.HIGH.responseMinutes);
    expect(SLA_POLICIES.HIGH.responseMinutes)
      .toBeGreaterThan(SLA_POLICIES.CRITICAL.responseMinutes);
  });

  it('resolution windows tighten as priority increases: LOW > MEDIUM > HIGH > CRITICAL', () => {
    expect(SLA_POLICIES.LOW.resolutionHours)
      .toBeGreaterThan(SLA_POLICIES.MEDIUM.resolutionHours);
    expect(SLA_POLICIES.MEDIUM.resolutionHours)
      .toBeGreaterThan(SLA_POLICIES.HIGH.resolutionHours);
    expect(SLA_POLICIES.HIGH.resolutionHours)
      .toBeGreaterThan(SLA_POLICIES.CRITICAL.resolutionHours);
  });

  it('has exact policy values matching the spec', () => {
    expect(SLA_POLICIES.CRITICAL).toEqual({ responseMinutes: 15,  resolutionHours: 4  });
    expect(SLA_POLICIES.HIGH    ).toEqual({ responseMinutes: 60,  resolutionHours: 8  });
    expect(SLA_POLICIES.MEDIUM  ).toEqual({ responseMinutes: 240, resolutionHours: 24 });
    expect(SLA_POLICIES.LOW     ).toEqual({ responseMinutes: 480, resolutionHours: 72 });
  });
});

// ---------------------------------------------------------------------------
// computeSLADeadlines
// ---------------------------------------------------------------------------
describe('computeSLADeadlines', () => {
  describe('return shape', () => {
    it('returns an object with the three expected ISO string keys', () => {
      const result = computeSLADeadlines('HIGH', anchor());
      expect(result).toHaveProperty('slaResponseDeadline');
      expect(result).toHaveProperty('slaResolutionDeadline');
      expect(result).toHaveProperty('slaDeadline');
    });

    it('all three values are valid ISO 8601 strings', () => {
      const result = computeSLADeadlines('MEDIUM', anchor());
      for (const key of ['slaResponseDeadline', 'slaResolutionDeadline', 'slaDeadline'] as const) {
        expect(() => new Date(result[key])).not.toThrow();
        expect(isNaN(new Date(result[key]).getTime())).toBe(false);
      }
    });

    it('slaDeadline equals slaResolutionDeadline (alias relationship)', () => {
      const result = computeSLADeadlines('LOW', anchor());
      expect(result.slaDeadline).toBe(result.slaResolutionDeadline);
    });
  });

  describe('CRITICAL priority (15 min response, 4 h resolution)', () => {
    it('computes response deadline = createdAt + 15 min', () => {
      const base = anchor();
      const { slaResponseDeadline } = computeSLADeadlines('CRITICAL', base);
      expect(ms(slaResponseDeadline)).toBe(base.getTime() + 15 * MINUTE);
    });

    it('computes resolution deadline = createdAt + 4 h', () => {
      const base = anchor();
      const { slaResolutionDeadline } = computeSLADeadlines('CRITICAL', base);
      expect(ms(slaResolutionDeadline)).toBe(base.getTime() + 4 * HOUR);
    });

    it('resolution deadline is strictly after response deadline', () => {
      const { slaResponseDeadline, slaResolutionDeadline } = computeSLADeadlines('CRITICAL', anchor());
      expect(ms(slaResolutionDeadline)).toBeGreaterThan(ms(slaResponseDeadline));
    });
  });

  describe('HIGH priority (60 min response, 8 h resolution)', () => {
    it('computes response deadline = createdAt + 60 min', () => {
      const base = anchor();
      const { slaResponseDeadline } = computeSLADeadlines('HIGH', base);
      expect(ms(slaResponseDeadline)).toBe(base.getTime() + 60 * MINUTE);
    });

    it('computes resolution deadline = createdAt + 8 h', () => {
      const base = anchor();
      const { slaResolutionDeadline } = computeSLADeadlines('HIGH', base);
      expect(ms(slaResolutionDeadline)).toBe(base.getTime() + 8 * HOUR);
    });
  });

  describe('MEDIUM priority (240 min response, 24 h resolution)', () => {
    it('computes response deadline = createdAt + 240 min', () => {
      const base = anchor();
      const { slaResponseDeadline } = computeSLADeadlines('MEDIUM', base);
      expect(ms(slaResponseDeadline)).toBe(base.getTime() + 240 * MINUTE);
    });

    it('computes resolution deadline = createdAt + 24 h', () => {
      const base = anchor();
      const { slaResolutionDeadline } = computeSLADeadlines('MEDIUM', base);
      expect(ms(slaResolutionDeadline)).toBe(base.getTime() + 24 * HOUR);
    });
  });

  describe('LOW priority (480 min response, 72 h resolution)', () => {
    it('computes response deadline = createdAt + 480 min', () => {
      const base = anchor();
      const { slaResponseDeadline } = computeSLADeadlines('LOW', base);
      expect(ms(slaResponseDeadline)).toBe(base.getTime() + 480 * MINUTE);
    });

    it('computes resolution deadline = createdAt + 72 h', () => {
      const base = anchor();
      const { slaResolutionDeadline } = computeSLADeadlines('LOW', base);
      expect(ms(slaResolutionDeadline)).toBe(base.getTime() + 72 * HOUR);
    });
  });

  describe('default createdAt (uses current time)', () => {
    beforeEach(() => {
      // Pin Date.now() so the "now" default is deterministic.
      vi.useFakeTimers();
      vi.setSystemTime(anchor());
    });
    afterEach(() => vi.useRealTimers());

    it('defaults createdAt to the current time when omitted', () => {
      const { slaResponseDeadline } = computeSLADeadlines('CRITICAL');
      // Should be anchor + 15 min since Date.now() is pinned to anchor.
      expect(ms(slaResponseDeadline)).toBe(anchor().getTime() + 15 * MINUTE);
    });

    it('explicit createdAt overrides the default', () => {
      const custom = new Date('2024-06-01T00:00:00.000Z');
      const { slaResponseDeadline } = computeSLADeadlines('CRITICAL', custom);
      expect(ms(slaResponseDeadline)).toBe(custom.getTime() + 15 * MINUTE);
    });
  });

  describe('deadline ordering across priorities', () => {
    it('CRITICAL resolution deadline < HIGH < MEDIUM < LOW for the same createdAt', () => {
      const base = anchor();
      const critical = ms(computeSLADeadlines('CRITICAL', base).slaResolutionDeadline);
      const high     = ms(computeSLADeadlines('HIGH',     base).slaResolutionDeadline);
      const medium   = ms(computeSLADeadlines('MEDIUM',   base).slaResolutionDeadline);
      const low      = ms(computeSLADeadlines('LOW',      base).slaResolutionDeadline);

      expect(critical).toBeLessThan(high);
      expect(high).toBeLessThan(medium);
      expect(medium).toBeLessThan(low);
    });

    it('CRITICAL response deadline < HIGH < MEDIUM < LOW for the same createdAt', () => {
      const base = anchor();
      const critical = ms(computeSLADeadlines('CRITICAL', base).slaResponseDeadline);
      const high     = ms(computeSLADeadlines('HIGH',     base).slaResponseDeadline);
      const medium   = ms(computeSLADeadlines('MEDIUM',   base).slaResponseDeadline);
      const low      = ms(computeSLADeadlines('LOW',      base).slaResponseDeadline);

      expect(critical).toBeLessThan(high);
      expect(high).toBeLessThan(medium);
      expect(medium).toBeLessThan(low);
    });
  });

  describe('priority re-computation on createdAt (simulates updateTicketPriority)', () => {
    it('recalculates deadlines relative to original createdAt, not now', () => {
      // Ticket was created 1 hour ago.
      const now       = anchor();
      const createdAt = new Date(now.getTime() - 1 * HOUR);

      vi.useFakeTimers();
      vi.setSystemTime(now);

      const result = computeSLADeadlines('HIGH', createdAt);
      // HIGH response = 60 min → deadline is exactly at `now` (60 min after createdAt)
      expect(ms(result.slaResponseDeadline)).toBe(createdAt.getTime() + 60 * MINUTE);
      // Resolution = 8 h → 7 h from now
      expect(ms(result.slaResolutionDeadline)).toBe(createdAt.getTime() + 8 * HOUR);

      vi.useRealTimers();
    });

    it('an old CRITICAL ticket whose deadline has passed produces a past deadline', () => {
      // Ticket created 5 hours ago; CRITICAL resolution = 4 h → already breached.
      const now       = anchor();
      const createdAt = new Date(now.getTime() - 5 * HOUR);

      vi.useFakeTimers();
      vi.setSystemTime(now);

      const { slaResolutionDeadline } = computeSLADeadlines('CRITICAL', createdAt);
      expect(ms(slaResolutionDeadline)).toBeLessThan(now.getTime());

      vi.useRealTimers();
    });
  });
});

// ---------------------------------------------------------------------------
// isSLABreached
// ---------------------------------------------------------------------------
describe('isSLABreached', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(anchor()); // "now" = 2024-01-15T10:00:00.000Z
  });
  afterEach(() => vi.useRealTimers());

  // --- breach flag short-circuit -------------------------------------------

  it('returns true immediately when breachFlag is true, regardless of deadline', () => {
    // Deadline is 1 year in the future — should still return true.
    const farFuture = new Date(anchor().getTime() + 365 * 24 * HOUR).toISOString();
    expect(isSLABreached(farFuture, true)).toBe(true);
  });

  it('breachFlag=true overrides a deadline that is exactly now', () => {
    const exactly = anchor().toISOString();
    expect(isSLABreached(exactly, true)).toBe(true);
  });

  it('breachFlag=true overrides a future deadline by 1 ms', () => {
    const justFuture = new Date(anchor().getTime() + 1).toISOString();
    expect(isSLABreached(justFuture, true)).toBe(true);
  });

  // --- deadline in the past -------------------------------------------------

  it('returns true when deadline is 1 ms in the past (no flag)', () => {
    const justPast = new Date(anchor().getTime() - 1).toISOString();
    expect(isSLABreached(justPast)).toBe(true);
  });

  it('returns true when deadline is exactly now (deadline <= Date.now())', () => {
    const exactly = anchor().toISOString();
    expect(isSLABreached(exactly)).toBe(true);
  });

  it('returns true for a deadline 24 hours in the past', () => {
    const past = new Date(anchor().getTime() - 24 * HOUR).toISOString();
    expect(isSLABreached(past)).toBe(true);
  });

  // --- deadline in the future -----------------------------------------------

  it('returns false when deadline is 1 ms in the future (no flag)', () => {
    const justFuture = new Date(anchor().getTime() + 1).toISOString();
    expect(isSLABreached(justFuture)).toBe(false);
  });

  it('returns false when deadline is 1 hour in the future', () => {
    const future = new Date(anchor().getTime() + HOUR).toISOString();
    expect(isSLABreached(future)).toBe(false);
  });

  it('returns false for a far-future deadline with no flag', () => {
    const farFuture = new Date(anchor().getTime() + 365 * 24 * HOUR).toISOString();
    expect(isSLABreached(farFuture)).toBe(false);
  });

  // --- breachFlag defaults to false -----------------------------------------

  it('omitting breachFlag defaults to false (no short-circuit)', () => {
    const future = new Date(anchor().getTime() + HOUR).toISOString();
    // With no flag, only the deadline check applies.
    expect(isSLABreached(future)).toBe(false);
    expect(isSLABreached(future, false)).toBe(false);
  });

  it('explicit breachFlag=false behaves identically to omitting it', () => {
    const past = new Date(anchor().getTime() - 1).toISOString();
    expect(isSLABreached(past, false)).toBe(isSLABreached(past));
  });
});

// ---------------------------------------------------------------------------
// Integration: computeSLADeadlines ↔ isSLABreached
// ---------------------------------------------------------------------------
describe('computeSLADeadlines + isSLABreached integration', () => {
  afterEach(() => vi.useRealTimers());

  it('a freshly created CRITICAL ticket is NOT breached at creation time', () => {
    const now = anchor();
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const { slaDeadline } = computeSLADeadlines('CRITICAL', now);
    // Deadline = now + 4 h → still in the future
    expect(isSLABreached(slaDeadline)).toBe(false);
  });

  it('a CRITICAL ticket IS breached after its 4 h window elapses', () => {
    const createdAt = anchor();
    vi.useFakeTimers();
    // Advance time to 4 h + 1 ms after creation.
    vi.setSystemTime(new Date(createdAt.getTime() + 4 * HOUR + 1));

    const { slaDeadline } = computeSLADeadlines('CRITICAL', createdAt);
    expect(isSLABreached(slaDeadline)).toBe(true);
  });

  it('a HIGH ticket is not breached at exactly the response window (8 h - 1 ms)', () => {
    const createdAt = anchor();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(createdAt.getTime() + 8 * HOUR - 1));

    const { slaDeadline } = computeSLADeadlines('HIGH', createdAt);
    expect(isSLABreached(slaDeadline)).toBe(false);
  });

  it('a HIGH ticket IS breached at exactly the resolution deadline (8 h)', () => {
    const createdAt = anchor();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(createdAt.getTime() + 8 * HOUR));

    const { slaDeadline } = computeSLADeadlines('HIGH', createdAt);
    expect(isSLABreached(slaDeadline)).toBe(true);
  });

  it('a MEDIUM ticket with breachFlag=true is always breached even before its 24 h window', () => {
    const createdAt = anchor();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(createdAt.getTime() + 1 * HOUR)); // well within 24 h

    const { slaDeadline } = computeSLADeadlines('MEDIUM', createdAt);
    expect(isSLABreached(slaDeadline, true)).toBe(true);
  });

  it('priority upgrade on an old ticket can produce an already-breached deadline', () => {
    // Ticket was created 5 hours ago; we upgrade it to CRITICAL (4 h window).
    const now       = anchor();
    const createdAt = new Date(now.getTime() - 5 * HOUR);

    vi.useFakeTimers();
    vi.setSystemTime(now);

    // Simulate updateTicketPriority: recalculate from createdAt with new priority.
    const { slaDeadline } = computeSLADeadlines('CRITICAL', createdAt);
    // deadline = createdAt + 4 h = now - 1 h → already past
    expect(isSLABreached(slaDeadline)).toBe(true);
  });

  it('priority downgrade on a fresh ticket keeps the ticket not-breached', () => {
    // Ticket was created 1 minute ago; we downgrade to LOW (72 h window).
    const now       = anchor();
    const createdAt = new Date(now.getTime() - 1 * MINUTE);

    vi.useFakeTimers();
    vi.setSystemTime(now);

    const { slaDeadline } = computeSLADeadlines('LOW', createdAt);
    expect(isSLABreached(slaDeadline)).toBe(false);
  });

  it('all four priority deadlines fire correctly when time advances past each one', () => {
    const createdAt = anchor();
    const priorities: Priority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

    for (const priority of priorities) {
      vi.useFakeTimers();
      const { slaDeadline } = computeSLADeadlines(priority, createdAt);
      const deadline = ms(slaDeadline);

      // 1 ms before deadline → not breached
      vi.setSystemTime(new Date(deadline - 1));
      expect(isSLABreached(slaDeadline), `${priority}: should not be breached 1ms before deadline`).toBe(false);

      // exactly at deadline → breached (deadline <= Date.now())
      vi.setSystemTime(new Date(deadline));
      expect(isSLABreached(slaDeadline), `${priority}: should be breached at the exact deadline`).toBe(true);

      vi.useRealTimers();
    }
  });
});
