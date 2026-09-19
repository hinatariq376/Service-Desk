-- ============================================================================
-- Migration: 20240012_agent_filtering_and_ticket_creation_sync.sql
-- Description:
-- 1. Verifies/ensures public.tickets has customer_id & assigned_agent_id foreign keys to public.users.
-- 2. Ensures auto-sync trigger on auth.users -> public.users so customers and agents exist before ticket creation.
-- 3. Grants comprehensive RLS policies on public.tickets for ADMIN, SUPPORT_AGENT, and CUSTOMER.
-- 4. Ensures publication supabase_realtime includes public.tickets for instant admin & agent updates.
-- ============================================================================

-- 1. Ensure columns exist on public.users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'APPROVED';

-- Set default for SUPPORT_AGENT to require approval
ALTER TABLE public.users
  ALTER COLUMN is_approved SET DEFAULT TRUE;

-- 2. Ensure public.tickets table structure and foreign keys
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED')),
  customer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_agent_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  sla_response_deadline TIMESTAMPTZ,
  sla_resolution_deadline TIMESTAMPTZ,
  sla_deadline TIMESTAMPTZ,
  sla_breach BOOLEAN NOT NULL DEFAULT FALSE,
  sla_status TEXT DEFAULT 'HEALTHY',
  attachments JSONB DEFAULT '[]'::jsonb,
  tags JSONB DEFAULT '[]'::jsonb,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_tickets_customer_id ON public.tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_agent_id ON public.tickets(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_sla_breach ON public.tickets(sla_breach);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets(created_at DESC);

-- 3. Auto-sync trigger from auth.users to public.users
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_name TEXT;
  v_is_approved BOOLEAN;
  v_approval_status TEXT;
BEGIN
  v_role := UPPER(COALESCE(
    NEW.raw_user_meta_data->>'role',
    NEW.raw_app_meta_data->>'role',
    'CUSTOMER'
  ));

  IF v_role NOT IN ('CUSTOMER', 'SUPPORT_AGENT', 'ADMIN') THEN
    v_role := 'CUSTOMER';
  END IF;

  v_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    SPLIT_PART(NEW.email, '@', 1)
  );

  -- Support agents require approval by default
  IF v_role = 'SUPPORT_AGENT' THEN
    v_is_approved := COALESCE((NEW.raw_user_meta_data->>'is_approved')::boolean, FALSE);
    v_approval_status := CASE WHEN v_is_approved THEN 'APPROVED' ELSE 'PENDING' END;
  ELSE
    v_is_approved := TRUE;
    v_approval_status := 'APPROVED';
  END IF;

  INSERT INTO public.users (id, name, email, role, is_approved, approval_status, avatar, created_at, updated_at)
  VALUES (
    NEW.id,
    v_name,
    NEW.email,
    v_role,
    v_is_approved,
    v_approval_status,
    NEW.raw_user_meta_data->>'avatar',
    NOW(),
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Backfill any existing auth users into public.users
INSERT INTO public.users (id, name, email, role, is_approved, approval_status, created_at, updated_at)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'full_name', SPLIT_PART(au.email, '@', 1)),
  au.email,
  UPPER(COALESCE(au.raw_user_meta_data->>'role', 'CUSTOMER')),
  CASE WHEN UPPER(COALESCE(au.raw_user_meta_data->>'role', 'CUSTOMER')) = 'SUPPORT_AGENT' THEN FALSE ELSE TRUE END,
  CASE WHEN UPPER(COALESCE(au.raw_user_meta_data->>'role', 'CUSTOMER')) = 'SUPPORT_AGENT' THEN 'PENDING' ELSE 'APPROVED' END,
  NOW(),
  NOW()
FROM auth.users au
ON CONFLICT (id) DO NOTHING;

-- 4. RLS Policies on public.tickets
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_access_tickets" ON public.tickets;
DROP POLICY IF EXISTS "customer_select_own_tickets" ON public.tickets;
DROP POLICY IF EXISTS "customer_insert_own_tickets" ON public.tickets;
DROP POLICY IF EXISTS "customer_update_own_tickets" ON public.tickets;
DROP POLICY IF EXISTS "agent_select_assigned_and_open_tickets" ON public.tickets;
DROP POLICY IF EXISTS "agent_update_assigned_tickets" ON public.tickets;

-- Admin Policy: Admins have unrestricted access to all tickets
CREATE POLICY "admin_full_access_tickets"
  ON public.tickets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'ADMIN'
    )
  );

-- Customer Policy: View own non-deleted tickets
CREATE POLICY "customer_select_own_tickets"
  ON public.tickets
  FOR SELECT
  TO authenticated
  USING (
    customer_id = auth.uid()
    AND (is_deleted IS NULL OR is_deleted = FALSE)
    AND deleted_at IS NULL
  );

-- Customer Policy: Insert new ticket with customer_id = auth.uid()
CREATE POLICY "customer_insert_own_tickets"
  ON public.tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
  );

-- Customer Policy: Update own tickets (e.g. resolve/close)
CREATE POLICY "customer_update_own_tickets"
  ON public.tickets
  FOR UPDATE
  TO authenticated
  USING (
    customer_id = auth.uid()
  )
  WITH CHECK (
    customer_id = auth.uid()
  );

-- Agent Policy: View assigned tickets or unassigned workspace tickets
CREATE POLICY "agent_select_assigned_and_open_tickets"
  ON public.tickets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'SUPPORT_AGENT'
        AND u.is_approved = TRUE
    )
    AND (
      assigned_agent_id = auth.uid()
      OR assigned_agent_id IS NULL
    )
    AND (is_deleted IS NULL OR is_deleted = FALSE)
    AND deleted_at IS NULL
  );

-- Agent Policy: Update assigned tickets
CREATE POLICY "agent_update_assigned_tickets"
  ON public.tickets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'SUPPORT_AGENT'
        AND u.is_approved = TRUE
    )
    AND (
      assigned_agent_id = auth.uid()
      OR assigned_agent_id IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'SUPPORT_AGENT'
        AND u.is_approved = TRUE
    )
  );

-- 5. Realtime publication setup
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
    WHERE pubname = 'supabase_realtime' AND tablename = 'ticket_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_comments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'users'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
