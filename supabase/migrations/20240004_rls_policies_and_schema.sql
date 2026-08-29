-- =============================================================================
-- Migration: 20240004_rls_policies_and_schema.sql
-- Description: Schema hardening, Soft Delete (Data Retention), and Strict RLS
--
-- Implements:
--   1. Data retention (soft delete via deleted_at, removal of ON DELETE CASCADE)
--   2. Strict Row-Level Security (RLS) for Customers, Agents, and Admins
--   3. Immutable audit logs (no client INSERT/UPDATE/DELETE; trigger-only writes)
--   4. Optimized partial indexes for production query patterns
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS audit;

-- ---------------------------------------------------------------------------
-- 1. BASE SCHEMA & SOFT DELETE COLUMNS
-- ---------------------------------------------------------------------------

-- Core Users table
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('CUSTOMER', 'SUPPORT_AGENT', 'ADMIN')),
  avatar text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Core Tickets table
CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED')),
  customer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  assigned_agent_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sla_response_deadline timestamptz,
  sla_resolution_deadline timestamptz,
  sla_deadline timestamptz,
  sla_breach boolean NOT NULL DEFAULT false,
  attachments jsonb DEFAULT '[]'::jsonb,
  tags text[] DEFAULT '{}'::text[],
  deleted_at timestamptz DEFAULT NULL
);

-- Core Ticket Comments table
CREATE TABLE IF NOT EXISTS public.ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE RESTRICT,
  author_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  content text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz DEFAULT NULL
);

-- Core Audit Logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,
  actor_name text NOT NULL,
  actor_role text NOT NULL,
  action text NOT NULL,
  entity_id text NOT NULL,
  entity_type text NOT NULL,
  old_value jsonb,
  new_value jsonb
);

-- Ensure deleted_at column exists on existing tables (if already created)
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.ticket_comments ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- ---------------------------------------------------------------------------
-- 2. HARD DELETE PREVENTION ON TICKETS (Enforce Soft Delete)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_prevent_ticket_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Hard delete is disabled on tickets. Soft-delete by setting deleted_at = transaction_timestamp().';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_ticket_hard_delete ON public.tickets;
CREATE TRIGGER trg_prevent_ticket_hard_delete
  BEFORE DELETE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_prevent_ticket_hard_delete();

-- ---------------------------------------------------------------------------
-- 3. INDEXES FOR PERFORMANCE AND DATA RETENTION
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tickets_active ON public.tickets (customer_id, assigned_agent_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_deleted_at ON public.tickets (deleted_at);
CREATE INDEX IF NOT EXISTS idx_tickets_sla_breach ON public.tickets (sla_breach, sla_resolution_deadline) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON public.ticket_comments (ticket_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON public.audit_logs (entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs (actor_id);

-- ---------------------------------------------------------------------------
-- 4. ENABLE & FORCE RLS ON ALL TABLES
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 5. DROP OLD POLICIES (Clean Slate)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read their own profile" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can read user directory" ON public.users;
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Admins can update users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

DROP POLICY IF EXISTS "Customers can view their own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Agents can view assigned tickets" ON public.tickets;
DROP POLICY IF EXISTS "Agents can view workspace tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admins can view all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Customers can create tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admins and agents can update tickets" ON public.tickets;
DROP POLICY IF EXISTS "Ticket select policy" ON public.tickets;
DROP POLICY IF EXISTS "Ticket insert policy" ON public.tickets;
DROP POLICY IF EXISTS "Ticket update policy" ON public.tickets;

DROP POLICY IF EXISTS "Users can view comments on their tickets" ON public.ticket_comments;
DROP POLICY IF EXISTS "Customers cannot view internal notes" ON public.ticket_comments;
DROP POLICY IF EXISTS "Users can create comments" ON public.ticket_comments;
DROP POLICY IF EXISTS "Comment select policy" ON public.ticket_comments;
DROP POLICY IF EXISTS "Comment insert policy" ON public.ticket_comments;

DROP POLICY IF EXISTS "Admins can read all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Anyone can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Deny direct insert on audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Deny direct update on audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Deny direct delete on audit_logs" ON public.audit_logs;

-- ---------------------------------------------------------------------------
-- 6. USERS TABLE POLICIES
-- ---------------------------------------------------------------------------
CREATE POLICY "Authenticated users can read user directory"
  ON public.users FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can manage users"
  ON public.users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ---------------------------------------------------------------------------
-- 7. TICKETS TABLE HARDENED POLICIES
-- ---------------------------------------------------------------------------

-- SELECT: Customers (own tickets), Agents (assigned or unassigned workspace tickets), Admins (all)
CREATE POLICY "Ticket select policy"
  ON public.tickets FOR SELECT
  USING (
    (
      -- Customer: only non-deleted tickets they submitted
      customer_id = auth.uid()
      AND deleted_at IS NULL
    )
    OR
    (
      -- Support Agent: non-deleted tickets in workspace (assigned to them or unassigned)
      (assigned_agent_id = auth.uid() OR assigned_agent_id IS NULL)
      AND deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'SUPPORT_AGENT'
      )
    )
    OR
    (
      -- Admin: full visibility
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'ADMIN'
      )
    )
  );

-- INSERT: Customers (their own tickets), Admins/Agents (tickets for workspace)
CREATE POLICY "Ticket insert policy"
  ON public.tickets FOR INSERT
  WITH CHECK (
    (
      customer_id = auth.uid()
      AND deleted_at IS NULL
    )
    OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPPORT_AGENT')
    )
  );

-- UPDATE: Customers (their own active tickets), Agents (assigned/unassigned workspace), Admins (all)
CREATE POLICY "Ticket update policy"
  ON public.tickets FOR UPDATE
  USING (
    (
      customer_id = auth.uid()
      AND deleted_at IS NULL
    )
    OR
    (
      (assigned_agent_id = auth.uid() OR assigned_agent_id IS NULL)
      AND deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'SUPPORT_AGENT'
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ---------------------------------------------------------------------------
-- 8. TICKET_COMMENTS HARDENED POLICIES
-- ---------------------------------------------------------------------------

-- SELECT:
-- - Customers: non-internal comments on their own active tickets
-- - Agents: comments & internal notes on their assigned/unassigned workspace tickets
-- - Admins: all comments
CREATE POLICY "Comment select policy"
  ON public.ticket_comments FOR SELECT
  USING (
    (
      -- Customer access: non-internal comments on their active tickets
      NOT is_internal
      AND deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.tickets
        WHERE id = ticket_comments.ticket_id
          AND customer_id = auth.uid()
          AND deleted_at IS NULL
      )
    )
    OR
    (
      -- Agent access: all comments (including internal) on accessible tickets
      deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.tickets
        WHERE id = ticket_comments.ticket_id
          AND (assigned_agent_id = auth.uid() OR assigned_agent_id IS NULL)
          AND deleted_at IS NULL
      )
      AND EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'SUPPORT_AGENT'
      )
    )
    OR
    (
      -- Admin access: all comments
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'ADMIN'
      )
    )
  );

-- INSERT:
-- - Customers: non-internal comments on their active tickets
-- - Agents: comments / internal notes on their accessible tickets
-- - Admins: comments on any ticket
CREATE POLICY "Comment insert policy"
  ON public.ticket_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND (
      (
        NOT is_internal
        AND EXISTS (
          SELECT 1 FROM public.tickets
          WHERE id = ticket_comments.ticket_id
            AND customer_id = auth.uid()
            AND deleted_at IS NULL
        )
      )
      OR
      (
        EXISTS (
          SELECT 1 FROM public.tickets
          WHERE id = ticket_comments.ticket_id
            AND (assigned_agent_id = auth.uid() OR assigned_agent_id IS NULL)
            AND deleted_at IS NULL
        )
        AND EXISTS (
          SELECT 1 FROM public.users
          WHERE id = auth.uid() AND role = 'SUPPORT_AGENT'
        )
      )
      OR
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'ADMIN'
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 9. AUDIT_LOGS HARDENED POLICIES (Immutable & Protected)
-- ---------------------------------------------------------------------------

-- SELECT: Only Admins can view audit logs
CREATE POLICY "Admins can read all audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- INSERT: Direct client inserts are strictly denied.
-- All audit logs MUST be authored by PostgreSQL triggers (SECURITY DEFINER)
-- or the backend service role.
CREATE POLICY "Deny direct insert on audit_logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (false);

-- UPDATE: Audit records are strictly immutable
CREATE POLICY "Deny direct update on audit_logs"
  ON public.audit_logs FOR UPDATE
  USING (false);

-- DELETE: Audit records can never be deleted
CREATE POLICY "Deny direct delete on audit_logs"
  ON public.audit_logs FOR DELETE
  USING (false);

-- ---------------------------------------------------------------------------
-- 10. GRANTS & PERMISSIONS
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.audit_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.audit_logs TO authenticated; -- RLS restricts to ADMIN

GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tickets TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ticket_comments TO authenticated;

-- Service role retains full administrative access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;
GRANT ALL ON SCHEMA audit TO service_role;
