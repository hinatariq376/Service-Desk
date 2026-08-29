# Architecture

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     React SPA (Vite)                        │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │ AuthContext │  │TicketContext │  │ Role-based Screens  │ │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬──────────┘ │
│         │                │                      │           │
│         └────────────────┼──────────────────────┘           │
│                          ▼                                  │
│              ┌───────────────────────┐                      │
│              │   Service Layer       │                      │
│              │ ticket / user / audit │                      │
│              └───────────┬───────────┘                      │
└──────────────────────────┼──────────────────────────────────┘
                           ▼
              ┌────────────────────────┐
              │   Supabase Client      │
              │   Auth + PostgREST     │
              │   Realtime             │
              └───────────┬────────────┘
                          ▼
              ┌────────────────────────┐
              │  PostgreSQL (live)     │
              │  users, tickets,       │
              │  ticket_comments,      │
              │  audit_logs            │
              │  ───────────────────   │
              │  • Triggers & SLA Calc │
              │  • Immutable Audit RLS │
              │  • Soft Delete Policy  │
              └────────────────────────┘
```

## Layers

### Presentation
- **React Router** — `/login`, `/register`, role-scoped dashboards
- **Zinc/Slate dark theme** — Enterprise UI with accessible status badges
- **ProtectedRoute** — Guards routes by role

### State
- **AuthContext** — Session, profile, sign-in/up/out
- **TicketContext** — Tickets, messages, audit logs, realtime refresh

### Domain
- **State machine** (`src/lib/stateMachine.ts`) — Legal transitions only
- **SLA engine** (`src/lib/sla.ts` & DB `audit.calculate_sla_deadlines`) — Server-side deadline computation and breach detection

### Data
- **Mappers** — Snake_case DB rows → camelCase app models
- **Services** — Typed Supabase queries with role & soft-delete filters

## Role Isolation & Hardened RLS

| Role | Ticket RLS Policy (`deleted_at IS NULL`) | Comment RLS Policy | Audit Logs RLS |
|---|---|---|---|
| **CUSTOMER** | `customer_id = auth.uid()` | Non-internal comments on own active tickets | Denied |
| **SUPPORT_AGENT** | `assigned_agent_id = auth.uid() OR assigned_agent_id IS NULL` | All comments on workspace tickets | Denied |
| **ADMIN** | Full access (all tickets) | Full access (all comments) | Read-only (`SELECT`) |

## Data Retention (Soft Delete)
- Foreign keys use `ON DELETE RESTRICT` (no `ON DELETE CASCADE`) to preserve relational integrity.
- Soft-delete implemented via `deleted_at TIMESTAMP WITH TIME ZONE`.
- Direct hard deletes on `public.tickets` are blocked by trigger `trg_prevent_ticket_hard_delete`.

## Ticket Lifecycle

```
OPEN → TRIAGED → ASSIGNED → IN_PROGRESS → WAITING_FOR_CUSTOMER → RESOLVED → CLOSED
                              ↑__________________|
```

- Agents/admins follow forward transitions via state machine
- Customers may only `RESOLVED → CLOSED`

## SLA Integrity
- All SLA deadlines and breach checks rely on PostgreSQL server-side `transaction_timestamp()` / `NOW()`.
- Trigger `trg_calculate_ticket_sla` automatically sets response & resolution deadlines on insert and priority update.
- Trigger `trg_sla_breach_on_update` and scheduled function `fn_check_sla_breaches` detect breaches atomically.

## Automated Audit Engine

Mutating actions are recorded **directly inside PostgreSQL** via triggers (`trg_audit_ticket_changes` & `trg_audit_ticket_comments`):
- `TICKET_CREATED`
- `STATUS_CHANGED`
- `PRIORITY_UPDATED`
- `AGENT_ASSIGNED`
- `SLA_BREACHED`
- `TICKET_SOFT_DELETED`
- `COMMENT_ADDED` / `INTERNAL_NOTE_ADDED` / `COMMENT_EDITED` / `COMMENT_DELETED`

Client-side direct modifications on `audit_logs` are blocked by RLS (`WITH CHECK (false)` and `USING (false)`).
