/**
 * Unit tests for src/lib/stateMachine.ts
 *
 * Covers:
 *  - VALID_TRANSITIONS graph completeness and shape
 *  - canTransition        (every valid edge, every invalid edge, all three roles)
 *  - getAllowedTransitions (per-status × per-role matrix)
 *  - validateTransition   (ok path, error path, same-status guard)
 *  - getTransitionAction  (label lookup for all next states)
 *  - TRANSITION_LABELS    (all statuses have a label)
 *  - Role boundary cases  (CUSTOMER can only close, SUPPORT_AGENT same as ADMIN)
 */

import { describe, it, expect } from 'vitest';
import {
  canTransition,
  getAllowedTransitions,
  validateTransition,
  getTransitionAction,
  TRANSITION_LABELS,
} from './stateMachine';
import type { Role, TicketStatus } from '../types';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const ALL_STATUSES: TicketStatus[] = [
  'OPEN',
  'TRIAGED',
  'ASSIGNED',
  'IN_PROGRESS',
  'WAITING_FOR_CUSTOMER',
  'RESOLVED',
  'CLOSED',
];

const ALL_ROLES: Role[] = ['CUSTOMER', 'SUPPORT_AGENT', 'ADMIN'];

/**
 * The canonical valid transition graph from stateMachine.ts.
 * Kept here as the source-of-truth for assertion loops so that
 * individual tests don't embed the full graph as magic strings.
 */
const EXPECTED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN:                  ['TRIAGED'],
  TRIAGED:               ['ASSIGNED'],
  ASSIGNED:              ['IN_PROGRESS'],
  IN_PROGRESS:           ['WAITING_FOR_CUSTOMER', 'RESOLVED'],
  WAITING_FOR_CUSTOMER:  ['IN_PROGRESS'],
  RESOLVED:              ['CLOSED'],
  CLOSED:                [],
};

// ---------------------------------------------------------------------------
// TRANSITION_LABELS
// ---------------------------------------------------------------------------
describe('TRANSITION_LABELS', () => {
  it('has a label for every TicketStatus', () => {
    for (const status of ALL_STATUSES) {
      expect(TRANSITION_LABELS).toHaveProperty(status);
      expect(typeof TRANSITION_LABELS[status]).toBe('string');
      expect(TRANSITION_LABELS[status].length).toBeGreaterThan(0);
    }
  });

  it('contains no duplicate label values', () => {
    const labels = Object.values(TRANSITION_LABELS);
    const unique  = new Set(labels);
    expect(unique.size).toBe(labels.length);
  });
});

// ---------------------------------------------------------------------------
// canTransition — ADMIN role (mirrors the VALID_TRANSITIONS graph)
// ---------------------------------------------------------------------------
describe('canTransition — ADMIN', () => {
  describe('valid edges (should return true)', () => {
    const validEdges: [TicketStatus, TicketStatus][] = [
      ['OPEN',                 'TRIAGED'],
      ['TRIAGED',              'ASSIGNED'],
      ['ASSIGNED',             'IN_PROGRESS'],
      ['IN_PROGRESS',          'WAITING_FOR_CUSTOMER'],
      ['IN_PROGRESS',          'RESOLVED'],
      ['WAITING_FOR_CUSTOMER', 'IN_PROGRESS'],
      ['RESOLVED',             'CLOSED'],
    ];

    for (const [from, to] of validEdges) {
      it(`${from} → ${to}`, () => {
        expect(canTransition(from, to, 'ADMIN')).toBe(true);
      });
    }
  });

  describe('invalid edges (should return false)', () => {
    // Build the full set of invalid edges by subtracting valid ones.
    const validSet = new Set(
      Object.entries(EXPECTED_TRANSITIONS).flatMap(([from, tos]) =>
        tos.map((to) => `${from}→${to}`),
      ),
    );

    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        if (!validSet.has(`${from}→${to}`)) {
          it(`${from} → ${to} (invalid)`, () => {
            expect(canTransition(from as TicketStatus, to as TicketStatus, 'ADMIN')).toBe(false);
          });
        }
      }
    }
  });

  it('CLOSED has no valid forward transitions', () => {
    for (const to of ALL_STATUSES) {
      expect(canTransition('CLOSED', to, 'ADMIN')).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// canTransition — SUPPORT_AGENT (identical graph to ADMIN)
// ---------------------------------------------------------------------------
describe('canTransition — SUPPORT_AGENT (same permissions as ADMIN)', () => {
  it('every valid ADMIN edge is also valid for SUPPORT_AGENT', () => {
    for (const [from, tos] of Object.entries(EXPECTED_TRANSITIONS)) {
      for (const to of tos) {
        expect(
          canTransition(from as TicketStatus, to as TicketStatus, 'SUPPORT_AGENT'),
        ).toBe(true);
      }
    }
  });

  it('every invalid ADMIN edge is also invalid for SUPPORT_AGENT', () => {
    const validSet = new Set(
      Object.entries(EXPECTED_TRANSITIONS).flatMap(([from, tos]) =>
        tos.map((to) => `${from}→${to}`),
      ),
    );
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        if (!validSet.has(`${from}→${to}`)) {
          expect(canTransition(from, to, 'SUPPORT_AGENT')).toBe(false);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// canTransition — CUSTOMER (only RESOLVED → CLOSED)
// ---------------------------------------------------------------------------
describe('canTransition — CUSTOMER', () => {
  it('allows RESOLVED → CLOSED', () => {
    expect(canTransition('RESOLVED', 'CLOSED', 'CUSTOMER')).toBe(true);
  });

  it('denies every other transition', () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        if (from === 'RESOLVED' && to === 'CLOSED') continue;
        expect(
          canTransition(from, to, 'CUSTOMER'),
          `CUSTOMER: ${from} → ${to} should be false`,
        ).toBe(false);
      }
    }
  });

  it('CUSTOMER cannot reopen a CLOSED ticket', () => {
    expect(canTransition('CLOSED', 'OPEN', 'CUSTOMER')).toBe(false);
  });

  it('CUSTOMER cannot triage an OPEN ticket', () => {
    expect(canTransition('OPEN', 'TRIAGED', 'CUSTOMER')).toBe(false);
  });

  it('CUSTOMER cannot resolve an IN_PROGRESS ticket', () => {
    expect(canTransition('IN_PROGRESS', 'RESOLVED', 'CUSTOMER')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// canTransition — self-transitions (always false for all roles)
// ---------------------------------------------------------------------------
describe('canTransition — same-status self-transitions are always false', () => {
  for (const status of ALL_STATUSES) {
    for (const role of ALL_ROLES) {
      it(`${role}: ${status} → ${status}`, () => {
        expect(canTransition(status, status, role)).toBe(false);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// getAllowedTransitions
// ---------------------------------------------------------------------------
describe('getAllowedTransitions', () => {
  describe('ADMIN / SUPPORT_AGENT — returns the graph array for each status', () => {
    for (const role of ['ADMIN', 'SUPPORT_AGENT'] as Role[]) {
      describe(role, () => {
        for (const [status, expected] of Object.entries(EXPECTED_TRANSITIONS)) {
          it(`${status} → [${expected.join(', ') || '∅'}]`, () => {
            const result = getAllowedTransitions(status as TicketStatus, role);
            expect(result).toEqual(expect.arrayContaining(expected));
            expect(result).toHaveLength(expected.length);
          });
        }

        it('CLOSED returns an empty array', () => {
          expect(getAllowedTransitions('CLOSED', role)).toEqual([]);
        });
      });
    }
  });

  describe('CUSTOMER', () => {
    it('RESOLVED → [CLOSED]', () => {
      expect(getAllowedTransitions('RESOLVED', 'CUSTOMER')).toEqual(['CLOSED']);
    });

    it('every non-RESOLVED status returns an empty array', () => {
      const nonResolved = ALL_STATUSES.filter((s) => s !== 'RESOLVED');
      for (const status of nonResolved) {
        expect(
          getAllowedTransitions(status, 'CUSTOMER'),
          `CUSTOMER from ${status} should have no transitions`,
        ).toEqual([]);
      }
    });

    it('CLOSED returns an empty array for CUSTOMER', () => {
      expect(getAllowedTransitions('CLOSED', 'CUSTOMER')).toEqual([]);
    });
  });

  it('IN_PROGRESS returns two next states for ADMIN', () => {
    const result = getAllowedTransitions('IN_PROGRESS', 'ADMIN');
    expect(result).toHaveLength(2);
    expect(result).toContain('WAITING_FOR_CUSTOMER');
    expect(result).toContain('RESOLVED');
  });

  it('returns an array (never undefined or null) for every status × role combination', () => {
    for (const status of ALL_STATUSES) {
      for (const role of ALL_ROLES) {
        const result = getAllowedTransitions(status, role);
        expect(Array.isArray(result)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// validateTransition
// ---------------------------------------------------------------------------
describe('validateTransition', () => {
  describe('ok path — valid transitions return { ok: true }', () => {
    const validEdges: [TicketStatus, TicketStatus, Role][] = [
      ['OPEN',                 'TRIAGED',              'ADMIN'],
      ['OPEN',                 'TRIAGED',              'SUPPORT_AGENT'],
      ['TRIAGED',              'ASSIGNED',             'ADMIN'],
      ['ASSIGNED',             'IN_PROGRESS',          'SUPPORT_AGENT'],
      ['IN_PROGRESS',          'WAITING_FOR_CUSTOMER', 'ADMIN'],
      ['IN_PROGRESS',          'RESOLVED',             'SUPPORT_AGENT'],
      ['WAITING_FOR_CUSTOMER', 'IN_PROGRESS',          'ADMIN'],
      ['RESOLVED',             'CLOSED',               'ADMIN'],
      ['RESOLVED',             'CLOSED',               'CUSTOMER'],
    ];

    for (const [from, to, role] of validEdges) {
      it(`${role}: ${from} → ${to} returns { ok: true }`, () => {
        const result = validateTransition(from, to, role);
        expect(result.ok).toBe(true);
      });
    }
  });

  describe('error path — invalid transitions return { ok: false, message }', () => {
    const invalidEdges: [TicketStatus, TicketStatus, Role][] = [
      ['OPEN',        'RESOLVED',    'ADMIN'],         // skips states
      ['OPEN',        'CLOSED',      'ADMIN'],          // skips states
      ['TRIAGED',     'IN_PROGRESS', 'ADMIN'],          // skips ASSIGNED
      ['RESOLVED',    'OPEN',        'ADMIN'],          // backwards
      ['CLOSED',      'OPEN',        'ADMIN'],          // terminal
      ['CLOSED',      'RESOLVED',    'ADMIN'],          // terminal
      ['OPEN',        'TRIAGED',     'CUSTOMER'],       // customer cannot triage
      ['IN_PROGRESS', 'RESOLVED',    'CUSTOMER'],       // customer cannot resolve
    ];

    for (const [from, to, role] of invalidEdges) {
      it(`${role}: ${from} → ${to} returns { ok: false }`, () => {
        const result = validateTransition(from, to, role);
        expect(result.ok).toBe(false);
        // Type narrowing: ok === false guarantees message exists.
        if (!result.ok) {
          expect(typeof result.message).toBe('string');
          expect(result.message.length).toBeGreaterThan(0);
        }
      });
    }
  });

  describe('same-status guard', () => {
    for (const status of ALL_STATUSES) {
      it(`${status} → ${status} returns { ok: false } with "already in this status" message`, () => {
        const result = validateTransition(status, status, 'ADMIN');
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.message).toMatch(/already/i);
        }
      });
    }

    it('same-status error fires before the role check', () => {
      // CUSTOMER cannot normally change status, but the same-status guard
      // should fire first and report "already in this status".
      const result = validateTransition('OPEN', 'OPEN', 'CUSTOMER');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toMatch(/already/i);
      }
    });
  });

  describe('error message quality', () => {
    it('invalid-transition message includes the from status', () => {
      const result = validateTransition('OPEN', 'RESOLVED', 'ADMIN');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        // The message should reference the from state in a readable form.
        // The implementation replaces underscores with spaces: "OPEN → RESOLVED"
        expect(result.message).toMatch(/open/i);
      }
    });

    it('invalid-transition message includes the to status', () => {
      const result = validateTransition('OPEN', 'RESOLVED', 'ADMIN');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toMatch(/resolved/i);
      }
    });
  });

  describe('return type is always { ok: boolean } shaped', () => {
    it('valid result has only ok: true (no message property)', () => {
      const result = validateTransition('OPEN', 'TRIAGED', 'ADMIN');
      expect(result).toHaveProperty('ok', true);
      expect(result).not.toHaveProperty('message');
    });

    it('invalid result has ok: false and a message string', () => {
      const result = validateTransition('CLOSED', 'OPEN', 'ADMIN');
      expect(result).toHaveProperty('ok', false);
      expect(result).toHaveProperty('message');
    });
  });
});

// ---------------------------------------------------------------------------
// getTransitionAction
// ---------------------------------------------------------------------------
describe('getTransitionAction', () => {
  it('returns a non-empty string for every valid next status', () => {
    for (const [, tos] of Object.entries(EXPECTED_TRANSITIONS)) {
      for (const to of tos) {
        const label = getTransitionAction('OPEN' as TicketStatus, to as TicketStatus);
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
      }
    }
  });

  it('returns a label for TRIAGED as next status', () => {
    const label = getTransitionAction('OPEN', 'TRIAGED');
    expect(label).toBeTruthy();
    expect(label).toMatch(/triage/i);
  });

  it('returns a label for IN_PROGRESS as next status', () => {
    const label = getTransitionAction('ASSIGNED', 'IN_PROGRESS');
    expect(label).toMatch(/progress/i);
  });

  it('returns a label for RESOLVED as next status', () => {
    const label = getTransitionAction('IN_PROGRESS', 'RESOLVED');
    expect(label).toMatch(/resolv/i);
  });

  it('returns a label for CLOSED as next status', () => {
    const label = getTransitionAction('RESOLVED', 'CLOSED');
    expect(label).toMatch(/clos/i);
  });

  it('returns a label for WAITING_FOR_CUSTOMER as next status', () => {
    const label = getTransitionAction('IN_PROGRESS', 'WAITING_FOR_CUSTOMER');
    expect(label).toMatch(/waiting|customer/i);
  });

  it('falls back gracefully for an unknown next status (returns TRANSITION_LABELS[next])', () => {
    // Even if `next` is not in the custom labels map, it should fall back
    // to TRANSITION_LABELS[next] which covers all statuses.
    const label = getTransitionAction('OPEN', 'ASSIGNED');
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Comprehensive role × transition matrix
// ---------------------------------------------------------------------------
describe('Full role × transition matrix', () => {
  it('ADMIN and SUPPORT_AGENT have identical canTransition results across all pairs', () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        expect(canTransition(from, to, 'ADMIN')).toBe(
          canTransition(from, to, 'SUPPORT_AGENT'),
        );
      }
    }
  });

  it('CUSTOMER is more restricted than ADMIN for every pair except RESOLVED → CLOSED', () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        if (from === 'RESOLVED' && to === 'CLOSED') continue;
        // For every other pair, if CUSTOMER can do it, ADMIN can too —
        // but CUSTOMER should NOT be able to do anything here.
        expect(canTransition(from, to, 'CUSTOMER')).toBe(false);
      }
    }
  });

  it('validateTransition and canTransition agree for all valid pairs × ADMIN', () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        if (from === to) continue; // same-status is a special case

        const can      = canTransition(from, to, 'ADMIN');
        const validate = validateTransition(from, to, 'ADMIN');

        if (can) {
          expect(validate.ok).toBe(true);
        } else {
          expect(validate.ok).toBe(false);
        }
      }
    }
  });

  it('validateTransition and canTransition agree for all valid pairs × CUSTOMER', () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        if (from === to) continue;

        const can      = canTransition(from, to, 'CUSTOMER');
        const validate = validateTransition(from, to, 'CUSTOMER');

        if (can) {
          expect(validate.ok).toBe(true);
        } else {
          expect(validate.ok).toBe(false);
        }
      }
    }
  });

  it('getAllowedTransitions results are all canTransition-valid for the same role', () => {
    for (const role of ALL_ROLES) {
      for (const status of ALL_STATUSES) {
        const allowed = getAllowedTransitions(status, role);
        for (const next of allowed) {
          expect(
            canTransition(status, next, role),
            `getAllowedTransitions returned ${next} from ${status} for ${role}, but canTransition is false`,
          ).toBe(true);
        }
      }
    }
  });

  it('no status in getAllowedTransitions is the same as the current status', () => {
    for (const role of ALL_ROLES) {
      for (const status of ALL_STATUSES) {
        const allowed = getAllowedTransitions(status, role);
        expect(allowed).not.toContain(status);
      }
    }
  });
});
