# Production-Grade Supabase Database Setup & Architecture Reference

This document details the production-grade PostgreSQL architecture, schema, triggers, and Row-Level Security (RLS) policies implemented for the Service Desk platform.

---

## Architecture Summary

| Area | Engineering Standard & Implementation |
|---|---|
| **Automated Audit Logs** | PostgreSQL trigger `trg_audit_ticket_changes` calling `audit.fn_audit_ticket_changes()` on `INSERT`, `UPDATE`, and `DELETE`. Resolves JWT actor metadata and writes granular before/after diffs directly from the database (not client-side). |
| **SLA Integrity** | All SLA response & resolution deadlines, breach evaluations, and scheduled sweeps rely strictly on server-side `transaction_timestamp()` / `NOW()`. Enforced on ticket insert / priority change via `trg_calculate_ticket_sla`. |
| **Data Retention (Soft Delete)** | Removed all `ON DELETE CASCADE` rules on core ticket tables (`ON DELETE RESTRICT`). Soft-delete implemented via `deleted_at TIMESTAMP WITH TIME ZONE`. Hard deletes prevented via `trg_prevent_ticket_hard_delete`. Partial indexes filter `deleted_at IS NULL`. |
| **Harden RLS Policies** | Customers restricted to their own tickets; Agents restricted to assigned + unassigned workspace tickets; Admins have full access. `audit_logs` are strictly immutable (direct client INSERT, UPDATE, and DELETE are denied; only `SECURITY DEFINER` triggers write). |

---

## Migration Manifest

The database architecture is defined across 4 sequential migration files in `supabase/migrations/`:

### 1. `20240001_audit_trigger_tickets.sql`
- **Purpose**: Database-driven audit trail for the `tickets` table.
- **Trigger**: `trg_audit_ticket_changes` firing `AFTER INSERT OR UPDATE OR DELETE ON public.tickets FOR EACH ROW`.
- **Key Capabilities**:
  - Automatically captures: `TICKET_CREATED`, `STATUS_CHANGED`, `PRIORITY_UPDATED`, `AGENT_ASSIGNED`, `SLA_BREACHED`, `TICKET_SOFT_DELETED`, `TICKET_RESTORED`, `TICKET_UPDATED`, and `TICKET_DELETED`.
  - Extracts actor ID, name, and role from JWT claims (`auth.uid()`, `request.jwt.claims`) with fallback to `system` / `SYSTEM`.
  - Produces clean JSON diffs containing only modified columns.
  - Runs with `SECURITY DEFINER` and `SET search_path = public, audit, pg_temp`.

### 2. `20240002_audit_trigger_comments.sql`
- **Purpose**: Database-driven audit trail for ticket comments and internal notes.
- **Trigger**: `trg_audit_ticket_comments` firing `AFTER INSERT OR UPDATE OR DELETE ON public.ticket_comments FOR EACH ROW`.
- **Key Capabilities**:
  - Records `COMMENT_ADDED`, `INTERNAL_NOTE_ADDED`, `COMMENT_EDITED`, and `COMMENT_DELETED`.
  - Links audit entries to parent tickets via `TCK-XXXXXXXX` entity format.

### 3. `20240003_audit_trigger_sla_breach.sql`
- **Purpose**: Server-side SLA calculations and continuous breach detection.
- **Functions & Triggers**:
  - `audit.calculate_sla_deadlines(priority, base_time)`: Computes response and resolution deadlines relative to base timestamp using standard policies:
    - **CRITICAL**: 15 min response, 4 hour resolution
    - **HIGH**: 60 min response, 8 hour resolution
    - **MEDIUM**: 4 hour response, 24 hour resolution
    - **LOW**: 8 hour response, 72 hour resolution
  - `trg_calculate_ticket_sla`: `BEFORE INSERT OR UPDATE OF priority ON public.tickets` guarantees all deadline columns are calculated server-side.
  - `trg_sla_breach_on_update`: Reactive trigger firing on `UPDATE` if current server time exceeds resolution deadline on active tickets.
  - `audit.fn_check_sla_breaches()`: Proactive sweep function scanning all active non-terminal tickets and updating `sla_breach = true` atomically.
  - `public.check_sla_breaches()`: Security-definer RPC wrapper callable by pg_cron or Supabase Edge Functions with permissions restricted to `service_role`.

### 4. `20240004_rls_policies_and_schema.sql`
- **Purpose**: Schema integrity, soft-delete data retention, and hardened RLS policies.
- **Key Capabilities**:
  - Removes cascading deletes across core tables, applying `ON DELETE RESTRICT` on foreign keys.
  - Adds `deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL` to `tickets` and `ticket_comments`.
  - Creates partial indexes for high query performance on active tickets (`WHERE deleted_at IS NULL`).
  - Implements `trg_prevent_ticket_hard_delete` to enforce soft delete and protect audit history.
  - **RLS Rules**:
    - **`public.tickets`**:
      - `CUSTOMER`: Can SELECT, INSERT, UPDATE only where `customer_id = auth.uid() AND deleted_at IS NULL`.
      - `SUPPORT_AGENT`: Can SELECT and UPDATE tickets where `(assigned_agent_id = auth.uid() OR assigned_agent_id IS NULL) AND deleted_at IS NULL`.
      - `ADMIN`: Full access to all tickets.
    - **`public.ticket_comments`**:
      - `CUSTOMER`: Can view non-internal comments on own active tickets; can insert public comments.
      - `SUPPORT_AGENT`: Can view and insert comments + internal notes on workspace tickets.
      - `ADMIN`: Full access to all comments.
    - **`public.audit_logs`**:
      - `ADMIN`: Permitted to SELECT (view audit trail).
      - `ALL CLIENT ROLES`: Direct INSERT, UPDATE, and DELETE are strictly denied. Writes are exclusively handled by `SECURITY DEFINER` PostgreSQL triggers.

---

## Deployment & Verification Guide

### Option 1: Supabase CLI (Recommended)

```bash
# Link project
supabase link --project-ref <your-project-ref>

# Apply all migrations
supabase db push

# Verify status
supabase migration list
```

### Option 2: Supabase Dashboard (SQL Editor)

Execute each migration file in order:
1. `supabase/migrations/20240001_audit_trigger_tickets.sql`
2. `supabase/migrations/20240002_audit_trigger_comments.sql`
3. `supabase/migrations/20240003_audit_trigger_sla_breach.sql`
4. `supabase/migrations/20240004_rls_policies_and_schema.sql`

---

## Verification Queries

### 1. Check Triggers & Security Definer Functions
```sql
SELECT tgname, tgrelid::regclass, tgenabled 
FROM pg_trigger 
WHERE tgname IN ('trg_audit_ticket_changes', 'trg_audit_ticket_comments', 'trg_calculate_ticket_sla', 'trg_sla_breach_on_update', 'trg_prevent_ticket_hard_delete');
```

### 2. Verify RLS Enforcement
```sql
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN ('users', 'tickets', 'ticket_comments', 'audit_logs');
```

### 3. Verify Immutable Audit Logs
```sql
-- Direct client insert must fail under RLS:
INSERT INTO public.audit_logs (actor_name, actor_role, action, entity_id, entity_type)
VALUES ('Test', 'USER', 'TEST_ACTION', 'TCK-00000000', 'Ticket');
-- Expect: ERROR: new row violates row-level security policy for table "audit_logs"
```

### 4. Verify Server-Side SLA Calculation
```sql
-- Insert a test ticket without SLA deadlines:
INSERT INTO public.tickets (title, description, category, priority, customer_id)
VALUES ('Test SLA', 'Verifying server SLA computation', 'General', 'CRITICAL', auth.uid())
RETURNING id, priority, created_at, sla_response_deadline, sla_resolution_deadline;
-- Expect: Deadlines calculated exactly +15m and +4h from server transaction_timestamp()
```

### 5. Verify Soft Delete & Hard Delete Blocker
```sql
-- Attempting hard delete:
DELETE FROM public.tickets WHERE id = '...';
-- Expect: ERROR: Hard delete is disabled on tickets. Soft-delete by setting deleted_at = transaction_timestamp().

-- Soft delete:
UPDATE public.tickets SET deleted_at = transaction_timestamp() WHERE id = '...';
-- Expect: Success, and an audit_log record with action 'TICKET_SOFT_DELETED' is automatically created.
```
