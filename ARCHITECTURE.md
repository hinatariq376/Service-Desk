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
- **SLA engine** (`src/lib/sla.ts`) — Deadline computation and breach detection

### Data
- **Mappers** — Snake_case DB rows → camelCase app models
- **Services** — Typed Supabase queries with role filters

## Role Isolation

| Role | Ticket Query Filter |
|------|---------------------|
| CUSTOMER | `customer_id = auth.user.id` |
| SUPPORT_AGENT | `assigned_agent_id = auth.user.id` (strict — unassigned hidden) |
| ADMIN | No filter (all tickets) |

## Ticket Lifecycle

```
OPEN → TRIAGED → ASSIGNED → IN_PROGRESS → WAITING_FOR_CUSTOMER → RESOLVED → CLOSED
                              ↑__________________|
```

- Agents/admins follow forward transitions via state machine
- Customers may only `RESOLVED → CLOSED`

## Realtime

`TicketContext` subscribes to `postgres_changes` on:
- `tickets`
- `ticket_comments`
- `audit_logs` (admin refresh)

## Audit Engine

Every mutating action inserts into `audit_logs`:
- `TICKET_CREATED`
- `STATUS_CHANGED`
- `PRIORITY_UPDATED`
- `AGENT_ASSIGNED`
- `COMMENT_ADDED` / `INTERNAL_NOTE_ADDED`
