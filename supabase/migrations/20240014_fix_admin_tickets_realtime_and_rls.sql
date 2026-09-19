-- =============================================================================
-- Migration: 20240014_fix_admin_tickets_realtime_and_rls.sql
-- Description: Complete Fix for Admin Ticket Visibility, Realtime Replication, and Security Definer RLS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. SECURITY DEFINER HELPER FUNCTIONS FOR ROLES (Bypasses RLS recursive locks)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_role text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- 1. Direct lookup in public.users (bypassing RLS because of SECURITY DEFINER)
  SELECT role INTO v_role FROM public.users WHERE id = p_user_id;
  IF UPPER(COALESCE(v_role, '')) = 'ADMIN' THEN
    RETURN true;
  END IF;

  -- 2. Fallback lookup in auth.users user_metadata / app_metadata
  SELECT COALESCE(raw_user_meta_data->>'role', raw_app_meta_data->>'role', '') INTO v_role
  FROM auth.users WHERE id = p_user_id;
  IF UPPER(COALESCE(v_role, '')) = 'ADMIN' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_support_agent(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_role text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = p_user_id;
  IF UPPER(COALESCE(v_role, '')) = 'SUPPORT_AGENT' THEN
    RETURN true;
  END IF;

  SELECT COALESCE(raw_user_meta_data->>'role', raw_app_meta_data->>'role', '') INTO v_role
  FROM auth.users WHERE id = p_user_id;
  RETURN UPPER(COALESCE(v_role, '')) = 'SUPPORT_AGENT';
END;
$$;

CREATE OR REPLACE FUNCTION public.is_approved_agent(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_role text;
  v_approved boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT role, is_approved INTO v_role, v_approved FROM public.users WHERE id = p_user_id;
  IF UPPER(COALESCE(v_role, '')) = 'SUPPORT_AGENT' AND v_approved = true THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. ENSURE FOREIGN KEYS ARE PROPERLY NAMED ON public.tickets
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- Drop existing foreign keys if named differently
  ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_customer_id_fkey;
  ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_assigned_agent_id_fkey;
  
  -- Add canonical foreign key constraints
  ALTER TABLE public.tickets
    ADD CONSTRAINT tickets_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE RESTRICT;

  ALTER TABLE public.tickets
    ADD CONSTRAINT tickets_assigned_agent_id_fkey
    FOREIGN KEY (assigned_agent_id) REFERENCES public.users(id) ON DELETE SET NULL;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_customer_id ON public.tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_agent_id ON public.tickets(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at_desc ON public.tickets(created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. HARDENED ROW LEVEL SECURITY (RLS) POLICIES
-- ---------------------------------------------------------------------------
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

-- Clean existing policies on tickets
DROP POLICY IF EXISTS "Ticket select policy" ON public.tickets;
DROP POLICY IF EXISTS "Ticket insert policy" ON public.tickets;
DROP POLICY IF EXISTS "Ticket update policy" ON public.tickets;
DROP POLICY IF EXISTS "Ticket delete policy" ON public.tickets;
DROP POLICY IF EXISTS "Admins can view all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Customers can view their own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Agents can view assigned tickets" ON public.tickets;

-- 1. SELECT: Admin sees ALL tickets; Agents see assigned/unassigned active tickets; Customers see own tickets
CREATE POLICY "Ticket select policy"
  ON public.tickets FOR SELECT
  USING (
    -- Admins have unrestricted access to all tickets (new, old, active, deleted)
    public.is_admin(auth.uid())
    OR
    -- Approved Agents see active workspace tickets (assigned to them or unassigned)
    (
      public.is_approved_agent(auth.uid())
      AND (assigned_agent_id = auth.uid() OR assigned_agent_id IS NULL)
      AND deleted_at IS NULL
    )
    OR
    -- Customers see their own active tickets
    (
      customer_id = auth.uid()
      AND deleted_at IS NULL
    )
  );

-- 2. INSERT: Customers create their own tickets; Admins and Agents can create tickets
CREATE POLICY "Ticket insert policy"
  ON public.tickets FOR INSERT
  WITH CHECK (
    customer_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.is_approved_agent(auth.uid())
  );

-- 3. UPDATE: Admins can update any ticket; Agents can update assigned/unassigned; Customers can update own
CREATE POLICY "Ticket update policy"
  ON public.tickets FOR UPDATE
  USING (
    public.is_admin(auth.uid())
    OR
    (
      public.is_approved_agent(auth.uid())
      AND (assigned_agent_id = auth.uid() OR assigned_agent_id IS NULL)
      AND deleted_at IS NULL
    )
    OR
    (
      customer_id = auth.uid()
      AND deleted_at IS NULL
    )
  );

-- 4. DELETE: Admins can soft-delete or manage tickets
CREATE POLICY "Ticket delete policy"
  ON public.tickets FOR DELETE
  USING (
    public.is_admin(auth.uid())
  );

-- Clean and configure users table policies
DROP POLICY IF EXISTS "Authenticated users can read user directory" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;

CREATE POLICY "Authenticated users can read user directory"
  ON public.users FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can manage users"
  ON public.users FOR ALL
  USING (public.is_admin(auth.uid()));

-- Clean and configure comments table policies
DROP POLICY IF EXISTS "Comment select policy" ON public.ticket_comments;
DROP POLICY IF EXISTS "Comment insert policy" ON public.ticket_comments;

CREATE POLICY "Comment select policy"
  ON public.ticket_comments FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR
    (
      public.is_approved_agent(auth.uid())
      AND deleted_at IS NULL
    )
    OR
    (
      NOT is_internal
      AND deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.id = ticket_comments.ticket_id
          AND t.customer_id = auth.uid()
          AND t.deleted_at IS NULL
      )
    )
  );

CREATE POLICY "Comment insert policy"
  ON public.ticket_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND (
      public.is_admin(auth.uid())
      OR public.is_approved_agent(auth.uid())
      OR (
        NOT is_internal
        AND EXISTS (
          SELECT 1 FROM public.tickets t
          WHERE t.id = ticket_comments.ticket_id
            AND t.customer_id = auth.uid()
            AND t.deleted_at IS NULL
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 4. BACKFILL AND SYNC ALL AUTH USERS INTO public.users
-- ---------------------------------------------------------------------------
INSERT INTO public.users (id, name, email, role, is_approved, approval_status, created_at, updated_at)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1), 'User') AS name,
  au.email,
  UPPER(COALESCE(au.raw_user_meta_data->>'role', au.raw_app_meta_data->>'role', 'CUSTOMER')) AS role,
  CASE 
    WHEN UPPER(COALESCE(au.raw_user_meta_data->>'role', au.raw_app_meta_data->>'role', 'CUSTOMER')) = 'SUPPORT_AGENT' THEN false 
    ELSE true 
  END AS is_approved,
  CASE 
    WHEN UPPER(COALESCE(au.raw_user_meta_data->>'role', au.raw_app_meta_data->>'role', 'CUSTOMER')) = 'SUPPORT_AGENT' THEN 'PENDING' 
    ELSE 'APPROVED' 
  END AS approval_status,
  COALESCE(au.created_at, NOW()),
  NOW()
FROM auth.users au
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = COALESCE(EXCLUDED.name, public.users.name),
  role = COALESCE(EXCLUDED.role, public.users.role);

-- Ensure all admin users are marked approved
UPDATE public.users 
SET is_approved = true, approval_status = 'APPROVED'
WHERE UPPER(role) = 'ADMIN';

-- ---------------------------------------------------------------------------
-- 5. REALTIME REPLICATION SETUP
-- ---------------------------------------------------------------------------
ALTER TABLE public.tickets REPLICA IDENTITY FULL;
ALTER TABLE public.users REPLICA IDENTITY FULL;
ALTER TABLE public.ticket_comments REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'users'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'ticket_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_comments;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_comments TO authenticated;

-- Reload schema cache in PostgREST
NOTIFY pgrst, 'reload schema';
