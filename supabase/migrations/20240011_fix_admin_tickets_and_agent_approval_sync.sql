-- =============================================================================
-- Migration: 20240011_fix_admin_tickets_and_agent_approval_sync.sql
-- Description: Agent Approval Workflow, Full Auth Sync Trigger, and Complete Admin Ticket RLS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. ADD & CONFIGURE is_approved AND approval_status ON public.users
-- ---------------------------------------------------------------------------
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'PENDING';

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS chk_users_approval_status;

ALTER TABLE public.users
  ADD CONSTRAINT chk_users_approval_status 
  CHECK (approval_status IN ('PENDING', 'APPROVED', 'DENIED'));

-- Default non-agent roles to approved
UPDATE public.users 
  SET is_approved = true, approval_status = 'APPROVED'
  WHERE UPPER(role) != 'SUPPORT_AGENT';

-- Sync support agents status
UPDATE public.users 
  SET approval_status = 'APPROVED'
  WHERE UPPER(role) = 'SUPPORT_AGENT' AND is_approved = true;

UPDATE public.users 
  SET approval_status = 'PENDING'
  WHERE UPPER(role) = 'SUPPORT_AGENT' AND (is_approved = false OR is_approved IS NULL) AND approval_status IS NULL;

-- ---------------------------------------------------------------------------
-- 2. AUTO-SYNC TRIGGER: SYNC EVERY AUTH USER INTO public.users
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_auth_user_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
  user_name text;
  user_approved boolean;
  user_status text;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'CUSTOMER');
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), 'User');
  
  -- Support agents require approval (is_approved = false, approval_status = 'PENDING')
  -- Customers and Admins are auto-approved
  IF UPPER(user_role) = 'SUPPORT_AGENT' THEN
    user_approved := false;
    user_status := 'PENDING';
  ELSE
    user_approved := true;
    user_status := 'APPROVED';
  END IF;

  INSERT INTO public.users (id, name, email, role, is_approved, approval_status, created_at, updated_at)
  VALUES (
    NEW.id,
    user_name,
    NEW.email,
    user_role,
    user_approved,
    user_status,
    COALESCE(NEW.created_at, NOW()),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.users.name),
    role = COALESCE(EXCLUDED.role, public.users.role),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_or_updated ON auth.users;
CREATE TRIGGER on_auth_user_created_or_updated
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_sync();

-- Backfill any missing auth users into public.users
INSERT INTO public.users (id, name, email, role, is_approved, approval_status, created_at, updated_at)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1), 'User') AS name,
  au.email,
  COALESCE(au.raw_user_meta_data->>'role', 'CUSTOMER') AS role,
  CASE 
    WHEN UPPER(COALESCE(au.raw_user_meta_data->>'role', 'CUSTOMER')) = 'SUPPORT_AGENT' THEN false 
    ELSE true 
  END AS is_approved,
  CASE 
    WHEN UPPER(COALESCE(au.raw_user_meta_data->>'role', 'CUSTOMER')) = 'SUPPORT_AGENT' THEN 'PENDING' 
    ELSE 'APPROVED' 
  END AS approval_status,
  au.created_at,
  NOW()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.id = au.id
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = COALESCE(EXCLUDED.name, public.users.name),
  role = COALESCE(EXCLUDED.role, public.users.role);

-- ---------------------------------------------------------------------------
-- 3. TICKETS RLS POLICIES (ADMIN SELECT, UPDATE, DELETE ON ALL TICKETS)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Ticket select policy" ON public.tickets;
DROP POLICY IF EXISTS "Ticket insert policy" ON public.tickets;
DROP POLICY IF EXISTS "Ticket update policy" ON public.tickets;
DROP POLICY IF EXISTS "Ticket delete policy" ON public.tickets;
DROP POLICY IF EXISTS "Admins can delete tickets" ON public.tickets;

-- SELECT Policy:
-- - Admins: FULL visibility to all tickets (both active and soft-deleted, new and old)
-- - Support Agents: active tickets assigned to them or unassigned (approved agents only)
-- - Customers: their own active tickets
CREATE POLICY "Ticket select policy"
  ON public.tickets FOR SELECT
  USING (
    -- Admin: full access to all tickets
    (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() 
          AND UPPER(role) = 'ADMIN'
      )
    )
    OR
    -- Support Agent: assigned or unassigned active tickets (approved agents only)
    (
      (assigned_agent_id = auth.uid() OR assigned_agent_id IS NULL)
      AND deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() 
          AND UPPER(role) = 'SUPPORT_AGENT'
          AND is_approved = true
      )
    )
    OR
    -- Customer: tickets submitted by customer
    (
      customer_id = auth.uid()
      AND deleted_at IS NULL
    )
  );

-- INSERT Policy:
-- - Customers can create their own tickets
-- - Admins and Agents can create tickets for the workspace
CREATE POLICY "Ticket insert policy"
  ON public.tickets FOR INSERT
  WITH CHECK (
    (
      customer_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() 
        AND UPPER(role) IN ('ADMIN', 'SUPPORT_AGENT')
        AND (UPPER(role) = 'ADMIN' OR is_approved = true)
    )
  );

-- UPDATE Policy:
-- - Admins can update all tickets
-- - Support Agents can update active assigned or unassigned tickets (approved agents only)
-- - Customers can update their own active tickets
CREATE POLICY "Ticket update policy"
  ON public.tickets FOR UPDATE
  USING (
    -- Admin: full update access
    (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() 
          AND UPPER(role) = 'ADMIN'
      )
    )
    OR
    -- Support Agent: active assigned or unassigned tickets
    (
      (assigned_agent_id = auth.uid() OR assigned_agent_id IS NULL)
      AND deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() 
          AND UPPER(role) = 'SUPPORT_AGENT'
          AND is_approved = true
      )
    )
    OR
    -- Customer: own active tickets
    (
      customer_id = auth.uid()
      AND deleted_at IS NULL
    )
  );

-- DELETE Policy:
-- - Admins can delete tickets
CREATE POLICY "Ticket delete policy"
  ON public.tickets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() 
        AND UPPER(role) = 'ADMIN'
    )
  );

-- ---------------------------------------------------------------------------
-- 4. GRANTS & REALTIME PUBLICATION
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ticket_comments TO authenticated;

-- Ensure tables are published for real-time replication
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

-- ---------------------------------------------------------------------------
-- 5. RELOAD POSTGREST SCHEMA CACHE
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
