-- =============================================================================
-- MASTER DATABASE RESET & SCHEMA INITIALIZATION
-- =============================================================================
-- This script completely cleans and resets all tables, triggers, policies,
-- realtime publications, and initializes fresh tables and pre-seeded demo users.
-- =============================================================================

-- Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. DROP EXISTING TRIGGERS & TABLES (CLEAN SLATE)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_or_updated ON auth.users;
DROP TRIGGER IF EXISTS trg_audit_tickets ON public.tickets;
DROP TRIGGER IF EXISTS trg_audit_ticket_comments ON public.ticket_comments;
DROP TRIGGER IF EXISTS trg_enforce_permanent_agent_approval ON public.users;

DROP TABLE IF EXISTS public.ticket_comments CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.tickets CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Clean existing auth records to eliminate any unique email/id conflicts
DELETE FROM auth.identities WHERE provider = 'email' AND (
  identity_data->>'email' IN ('admin@servicedesk.com', 'agent@servicedesk.com', 'customer@servicedesk.com')
  OR user_id IN (
    SELECT id FROM auth.users WHERE email IN ('admin@servicedesk.com', 'agent@servicedesk.com', 'customer@servicedesk.com')
  )
);

DELETE FROM auth.users WHERE email IN (
  'admin@servicedesk.com',
  'agent@servicedesk.com',
  'customer@servicedesk.com'
) OR id IN (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003'
);

-- ---------------------------------------------------------------------------
-- 2. CREATE CORE TABLES
-- ---------------------------------------------------------------------------

-- 1. Users table (synced with auth.users)
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('CUSTOMER', 'SUPPORT_AGENT', 'ADMIN')),
  avatar text,
  is_approved boolean NOT NULL DEFAULT false,
  approval_status text DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'DENIED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Tickets table
CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  priority text NOT NULL CHECK (priority IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED')),
  customer_id uuid NOT NULL CONSTRAINT tickets_customer_id_fkey REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_agent_id uuid CONSTRAINT tickets_assigned_agent_id_fkey REFERENCES public.users(id) ON DELETE SET NULL,
  sla_response_deadline timestamptz,
  sla_resolution_deadline timestamptz,
  sla_deadline timestamptz,
  sla_breach boolean NOT NULL DEFAULT false,
  attachments jsonb DEFAULT '[]'::jsonb,
  tags text[] DEFAULT '{}'::text[],
  deleted_at timestamptz DEFAULT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Ticket Comments table
CREATE TABLE public.ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  deleted_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  entity_id text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Activity Logs table
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,
  actor_name text NOT NULL DEFAULT 'System',
  actor_role text NOT NULL DEFAULT 'SYSTEM',
  action text NOT NULL,
  entity_id text,
  entity_type text NOT NULL,
  old_value jsonb,
  new_value jsonb
);

-- 6. Audit Logs table (for backward compatibility)
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,
  actor_name text NOT NULL DEFAULT 'System',
  actor_role text NOT NULL DEFAULT 'SYSTEM',
  action text NOT NULL,
  entity_id text,
  entity_type text NOT NULL,
  old_value jsonb,
  new_value jsonb
);

-- ---------------------------------------------------------------------------
-- 3. INDEXES FOR HIGH PERFORMANCE
-- ---------------------------------------------------------------------------
CREATE INDEX idx_tickets_customer_id ON public.tickets(customer_id);
CREATE INDEX idx_tickets_assigned_agent_id ON public.tickets(assigned_agent_id);
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_tickets_created_at ON public.tickets(created_at DESC);
CREATE INDEX idx_ticket_comments_ticket_id ON public.ticket_comments(ticket_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- ---------------------------------------------------------------------------
-- 4. HELPER FUNCTIONS
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

  IF (auth.jwt() -> 'user_metadata' ->> 'role') ILIKE 'ADMIN' 
     OR (auth.jwt() -> 'app_metadata' ->> 'role') ILIKE 'ADMIN' THEN
    RETURN true;
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = p_user_id;
  RETURN UPPER(COALESCE(v_role, '')) = 'ADMIN';
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

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
  SET is_read = true
  WHERE user_id = auth.uid();
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES (ZERO-RECURSION)
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- USERS POLICIES
CREATE POLICY "Public users read policy"
  ON public.users FOR SELECT
  USING (true);

CREATE POLICY "Users insert policy"
  ON public.users FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users update policy"
  ON public.users FOR UPDATE
  USING (
    auth.uid() = id
    OR (auth.jwt() -> 'user_metadata' ->> 'role') ILIKE 'ADMIN'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') ILIKE 'ADMIN'
  );

-- TICKETS POLICIES
CREATE POLICY "Ticket select policy"
  ON public.tickets FOR SELECT
  USING (true);

CREATE POLICY "Ticket insert policy"
  ON public.tickets FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Ticket update policy"
  ON public.tickets FOR UPDATE
  USING (true);

CREATE POLICY "Ticket delete policy"
  ON public.tickets FOR DELETE
  USING (public.is_admin(auth.uid()));

-- COMMENTS POLICIES
CREATE POLICY "Comments select policy"
  ON public.ticket_comments FOR SELECT
  USING (true);

CREATE POLICY "Comments insert policy"
  ON public.ticket_comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Comments update policy"
  ON public.ticket_comments FOR UPDATE
  USING (author_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Comments delete policy"
  ON public.ticket_comments FOR DELETE
  USING (author_id = auth.uid() OR public.is_admin(auth.uid()));

-- NOTIFICATIONS POLICIES
CREATE POLICY "Notifications select policy"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Notifications insert policy"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Notifications update policy"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Notifications delete policy"
  ON public.notifications FOR DELETE
  USING (user_id = auth.uid());

-- ACTIVITY & AUDIT LOGS POLICIES
CREATE POLICY "Activity logs select policy"
  ON public.activity_logs FOR SELECT
  USING (true);

CREATE POLICY "Activity logs insert policy"
  ON public.activity_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Audit logs select policy"
  ON public.audit_logs FOR SELECT
  USING (true);

CREATE POLICY "Audit logs insert policy"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 6. AUTOMATIC AUTH USER SYNC TRIGGER
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_auth_user_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_name text;
  v_approved boolean;
  v_status text;
BEGIN
  v_role := UPPER(COALESCE(
    NEW.raw_user_meta_data->>'role',
    NEW.raw_app_meta_data->>'role',
    'CUSTOMER'
  ));
  
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1),
    'User'
  );

  IF v_role = 'SUPPORT_AGENT' THEN
    v_approved := false;
    v_status := 'PENDING';
  ELSE
    v_approved := true;
    v_status := 'APPROVED';
  END IF;

  BEGIN
    INSERT INTO public.users (id, name, email, role, is_approved, approval_status, created_at, updated_at)
    VALUES (
      NEW.id,
      v_name,
      NEW.email,
      v_role,
      v_approved,
      v_status,
      COALESCE(NEW.created_at, NOW()),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = COALESCE(EXCLUDED.name, public.users.name),
      role = COALESCE(EXCLUDED.role, public.users.role),
      updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_or_updated
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_sync();

-- ---------------------------------------------------------------------------
-- 7. REALTIME REPLICATION CONFIGURATION
-- ---------------------------------------------------------------------------
ALTER TABLE public.tickets REPLICA IDENTITY FULL;
ALTER TABLE public.users REPLICA IDENTITY FULL;
ALTER TABLE public.ticket_comments REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.activity_logs REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tickets') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'users') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'ticket_comments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_comments;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'activity_logs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. PRE-SEED CLEAN AUTH USERS & PROFILES (Password: Demo123!)
-- ---------------------------------------------------------------------------

-- 1. Admin: admin@servicedesk.com
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'admin@servicedesk.com',
  crypt('Demo123!', gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"], "role": "ADMIN"}'::jsonb,
  '{"name": "System Administrator", "role": "ADMIN"}'::jsonb,
  NOW(), NOW(), 'authenticated', 'authenticated'
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = crypt('Demo123!', gen_salt('bf')),
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  raw_app_meta_data = EXCLUDED.raw_app_meta_data;

-- 2. Support Agent: agent@servicedesk.com
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
) VALUES (
  'a0000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'agent@servicedesk.com',
  crypt('Demo123!', gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"], "role": "SUPPORT_AGENT"}'::jsonb,
  '{"name": "Support Agent", "role": "SUPPORT_AGENT"}'::jsonb,
  NOW(), NOW(), 'authenticated', 'authenticated'
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = crypt('Demo123!', gen_salt('bf')),
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  raw_app_meta_data = EXCLUDED.raw_app_meta_data;

-- 3. Customer: customer@servicedesk.com
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
) VALUES (
  'a0000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'customer@servicedesk.com',
  crypt('Demo123!', gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"], "role": "CUSTOMER"}'::jsonb,
  '{"name": "Customer User", "role": "CUSTOMER"}'::jsonb,
  NOW(), NOW(), 'authenticated', 'authenticated'
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = crypt('Demo123!', gen_salt('bf')),
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  raw_app_meta_data = EXCLUDED.raw_app_meta_data;

-- Sync them into public.users
INSERT INTO public.users (id, name, email, role, is_approved, approval_status, created_at, updated_at)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'System Administrator', 'admin@servicedesk.com', 'ADMIN', true, 'APPROVED', NOW(), NOW()),
  ('a0000000-0000-0000-0000-000000000002', 'Support Agent', 'agent@servicedesk.com', 'SUPPORT_AGENT', true, 'APPROVED', NOW(), NOW()),
  ('a0000000-0000-0000-0000-000000000003', 'Customer User', 'customer@servicedesk.com', 'CUSTOMER', true, 'APPROVED', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  is_approved = EXCLUDED.is_approved,
  approval_status = EXCLUDED.approval_status;

-- ---------------------------------------------------------------------------
-- 9. PERMISSIONS & SCHEMA CACHE RELOAD
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
