# API Reference

All data access goes through the Supabase JavaScript client (`src/lib/supabase.ts`).

## Authentication

| Method | Description |
|--------|-------------|
| `supabase.auth.signUp` | Register with email/password; profile written to `users` |
| `supabase.auth.signInWithPassword` | Login |
| `supabase.auth.signOut` | Logout |

## Tables

### `users`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | FK to `auth.users` |
| name | text | Display name |
| email | text | Unique |
| role | text | `CUSTOMER`, `SUPPORT_AGENT`, `ADMIN` |
| avatar | text | Optional |
| created_at | timestamptz | |

### `tickets`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| title | text | |
| description | text | |
| category | text | |
| priority | text | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` |
| status | text | State machine value |
| customer_id | uuid | FK → users |
| assigned_agent_id | uuid | Nullable; set by admin |
| sla_response_deadline | timestamptz | First response SLA |
| sla_resolution_deadline | timestamptz | Resolution SLA |
| sla_deadline | timestamptz | Legacy/alias for resolution |
| sla_breach | boolean | Breach flag |
| attachments | jsonb | File name list |
| tags | text[] | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `ticket_comments`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | |
| ticket_id | uuid | FK → tickets |
| author_id | uuid | FK → users |
| content | text | |
| is_internal | boolean | Hidden from customers |
| created_at | timestamptz | |

### `audit_logs`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | |
| created_at | timestamptz | |
| actor_id | uuid | Nullable |
| actor_name | text | |
| actor_role | text | |
| action | text | Event type |
| entity_id | text | Ticket display ID |
| entity_type | text | Usually `Ticket` |
| old_value | jsonb | Before state |
| new_value | jsonb | After state |

## Client Services

### `ticketService.ts`

| Function | Description |
|----------|-------------|
| `fetchTicketsForUser(user)` | Role-filtered ticket list |
| `fetchMessagesForTickets(ids)` | Comments for ticket IDs |
| `createTicket(user, payload)` | Create + audit log + SLA deadlines |
| `updateTicketStatus(user, ticket, next)` | Validates transition, updates + audit |
| `updateTicketPriority(user, ticket, priority)` | Admin only |
| `assignTicketToAgent(admin, ticket, agentId, name)` | Admin assignment |
| `addComment(user, ticketId, content, internal)` | Post comment + audit |
| `fetchAuditLogs()` | Admin audit trail |

### `userService.ts`

| Function | Description |
|----------|-------------|
| `fetchAllUsers()` | All profiles |
| `fetchSupportAgents()` | Agents for assignment dropdown |
| `fetchUserProfile(id)` | Single profile |
| `upsertUserProfile(...)` | Registration profile sync |

### `auditService.ts`

| Function | Description |
|----------|-------------|
| `insertAuditLog(payload)` | Write immutable audit record |

## SLA Policies

| Priority | Response | Resolution |
|----------|----------|------------|
| CRITICAL | 15 min | 4 h |
| HIGH | 1 h | 8 h |
| MEDIUM | 4 h | 24 h |
| LOW | 8 h | 72 h |

## Realtime Channels

Channel name: `service-desk-{userId}`

Events: `INSERT`, `UPDATE`, `DELETE` on `tickets`, `ticket_comments`, `audit_logs`.
