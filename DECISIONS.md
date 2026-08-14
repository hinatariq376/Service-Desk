# Engineering Decisions

## ADR-001: Supabase as Backend

**Decision:** Use Supabase Auth + PostgreSQL + Realtime instead of mock in-memory store.

**Rationale:** VP-approved live backend; reduces ops burden vs custom API; Realtime fits multi-role ticket feeds.

## ADR-002: React Router for Auth Routes

**Decision:** Add `react-router-dom` with `/login` and `/register` paths.

**Rationale:** Spec requires URL-based auth routes; replaces ad-hoc state routing in `App.tsx`.

## ADR-003: Strict Agent Ticket Isolation

**Decision:** Support agents query `assigned_agent_id = current_user.id` only. Removed global queue views.

**Rationale:** Spec mandates strict isolation — unassigned/other tickets must not appear in agent portal.

## ADR-004: Client-Side State Machine Validation

**Decision:** Validate transitions in `stateMachine.ts` before Supabase update; show `TransitionErrorBadge` on failure.

**Rationale:** Immediate UX feedback; complements DB constraints if present.

## ADR-005: SLA Deadlines at Creation

**Decision:** Compute `sla_response_deadline` and `sla_resolution_deadline` in client on ticket insert using fixed policy map.

**Rationale:** Spec defines fixed tiers; storing deadlines enables countdown UI and breach detection without runtime policy lookups.

## ADR-006: Audit Logs from Client

**Decision:** Insert audit records from service layer after successful mutations.

**Rationale:** Ensures every UI action is logged even without DB triggers; admin audit view stays in sync via Realtime.

## ADR-007: Zinc/Slate Dark Enterprise Theme

**Decision:** Standardize on zinc-950 canvas, zinc-900 surfaces, dark-adapted status badges.

**Rationale:** Spec requires clean enterprise dark theme with high accessibility contrast.

## ADR-008: Publishable Key in Source

**Decision:** Embed approved publishable Supabase key in `src/lib/supabase.ts`.

**Rationale:** Explicit VP approval for this project ref; publishable keys are intended for browser clients (RLS protects data).
