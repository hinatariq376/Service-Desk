-- =============================================================================
-- Migration: RLS Policies + Schema Setup for Audit Logs
--
-- This migration ensures:
--   1. The audit schema exists
--   2. RLS is enabled on all tables
--   3. Admins can read ALL audit logs
--   4. The audit_logs table has proper structure
--   5. All necessary indexes exist for performance
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. CREATE AUDIT SCHEMA (if not exists)
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS audit;

-- ---------------------------------------------------------------------------
-- 2. ENSURE AUDIT_LOGS TABLE EXISTS
-- ---------------------------------------------------------------------------
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

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON public.audit_logs (entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs (actor_id);

-- ---------------------------------------------------------------------------
-- 3. ENABLE RLS ON ALL TABLES
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 4. DROP EXISTING POLICIES (clean slate)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Admins can update users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

DROP POLICY IF EXISTS "Customers can view their own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Agents can view assigned tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admins can view all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Customers can create tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admins and agents can update tickets" ON public.tickets;

DROP POLICY IF EXISTS "Users can view comments on their tickets" ON public.ticket_comments;
DROP POLICY IF EXISTS "Customers cannot view internal notes" ON public.ticket_comments;
DROP POLICY IF EXISTS "Users can create comments" ON public.ticket_comments;

DROP POLICY IF EXISTS "Admins can read all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Anyone can insert audit logs" ON public.audit_logs;

-- ---------------------------------------------------------------------------
-- 5. USERS TABLE POLICIES
-- ---------------------------------------------------------------------------
CREATE POLICY "Users can read their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can insert users"
  ON public.users FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can update users"
  ON public.users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 6. TICKETS TABLE POLICIES
-- ---------------------------------------------------------------------------
CREATE POLICY "Customers can view their own tickets"
  ON public.tickets FOR SELECT
  USING (
    customer_id = auth.uid()
  );

CREATE POLICY "Agents can view assigned tickets"
  ON public.tickets FOR SELECT
  USING (
    assigned_agent_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('SUPPORT_AGENT', 'ADMIN')
    )
  );

CREATE POLICY "Admins can view all tickets"
  ON public.tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

CREATE POLICY "Customers can create tickets"
  ON public.tickets FOR INSERT
  WITH CHECK (
    customer_id = auth.uid()
  );

CREATE POLICY "Admins and agents can update tickets"
  ON public.tickets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPPORT_AGENT')
    )
    OR customer_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 7. TICKET_COMMENTS TABLE POLICIES
-- ---------------------------------------------------------------------------
CREATE POLICY "Users can view comments on their tickets"
  ON public.ticket_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets
      WHERE id = ticket_comments.ticket_id
        AND (
          customer_id = auth.uid()
          OR assigned_agent_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'ADMIN'
          )
        )
    )
  );

CREATE POLICY "Customers cannot view internal notes"
  ON public.ticket_comments FOR SELECT
  USING (
    NOT is_internal
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPPORT_AGENT')
    )
  );

CREATE POLICY "Users can create comments"
  ON public.ticket_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tickets
      WHERE id = ticket_comments.ticket_id
        AND (
          customer_id = auth.uid()
          OR assigned_agent_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'ADMIN'
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 8. AUDIT_LOGS TABLE POLICIES (CRITICAL FOR THIS FIX)
-- ---------------------------------------------------------------------------

-- POLICY 1: Admins can read ALL audit logs
CREATE POLICY "Admins can read all audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- POLICY 2: Allow system/trigger inserts (SECURITY DEFINER functions bypass RLS,
-- but this policy ensures application-level inserts also work)
CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 9. GRANT PERMISSIONS
-- ---------------------------------------------------------------------------

-- Authenticated users can query all tables (RLS filters results)
GRANT SELECT ON public.users TO authenticated;
GRANT SELECT ON public.tickets TO authenticated;
GRANT SELECT ON public.ticket_comments TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;

-- Authenticated users can insert/update where RLS permits
GRANT INSERT, UPDATE ON public.users TO authenticated;
GRANT INSERT, UPDATE ON public.tickets TO authenticated;
GRANT INSERT, UPDATE ON public.ticket_comments TO authenticated;
GRANT INSERT ON public.audit_logs TO authenticated;

-- Service role has full access (for migrations, triggers, scheduled jobs)
GRANT ALL ON public.users TO service_role;
GRANT ALL ON public.tickets TO service_role;
GRANT ALL ON public.ticket_comments TO service_role;
GRANT ALL ON public.audit_logs TO service_role;
GRANT ALL ON SCHEMA audit TO service_role;

-- ---------------------------------------------------------------------------
-- 10. COMMENTS (documentation)
-- ---------------------------------------------------------------------------
COMMENT ON TABLE public.audit_logs IS 'Immutable audit trail of all ticket and user actions. Written by triggers and application code.';
COMMENT ON POLICY "Admins can read all audit logs" ON public.audit_logs IS 'Admins have unrestricted read access to the entire audit trail.';
COMMENT ON POLICY "System can insert audit logs" ON public.audit_logs IS 'All authenticated users can write audit logs (application code + triggers).';
