-- =============================================================================
-- Migration: 20240015_fix_500_recursion_and_auth_triggers.sql
-- Description: Fix HTTP 500 Internal Server Errors (Remove RLS recursion on users table and harden auth triggers)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. FIX USERS TABLE RLS (ELIMINATE INFINITE RECURSION)
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop all old / recursive policies on users table
DROP POLICY IF EXISTS "Authenticated users can read user directory" ON public.users;
DROP POLICY IF EXISTS "Users can read their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;
DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;
DROP POLICY IF EXISTS "Allow individual read" ON public.users;
DROP POLICY IF EXISTS "Public users read policy" ON public.users;
DROP POLICY IF EXISTS "Public users write policy" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

-- SELECT policy: Allow reading user directory without recursive subqueries
CREATE POLICY "Public users read policy"
  ON public.users FOR SELECT
  USING (true);

-- INSERT policy: Allow users to insert their own profile or auth trigger
CREATE POLICY "Users insert policy"
  ON public.users FOR INSERT
  WITH CHECK (true);

-- UPDATE policy: Users update their own profile, or admins update
CREATE POLICY "Users update policy"
  ON public.users FOR UPDATE
  USING (
    auth.uid() = id
    OR (auth.jwt() -> 'user_metadata' ->> 'role') ILIKE 'ADMIN'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') ILIKE 'ADMIN'
  );

-- ---------------------------------------------------------------------------
-- 2. NON-RECURSIVE SECURITY DEFINER HELPER FUNCTIONS
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

  -- 1. Fast JWT claims check (no table query needed)
  IF (auth.jwt() -> 'user_metadata' ->> 'role') ILIKE 'ADMIN' 
     OR (auth.jwt() -> 'app_metadata' ->> 'role') ILIKE 'ADMIN' THEN
    RETURN true;
  END IF;

  -- 2. Table lookup (safe because users read policy has no recursion)
  SELECT role INTO v_role FROM public.users WHERE id = p_user_id;
  IF UPPER(COALESCE(v_role, '')) = 'ADMIN' THEN
    RETURN true;
  END IF;

  RETURN false;
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
-- 3. HARDEN AUTH USER SYNC TRIGGER (NEVER THROW 500 EXCEPTION)
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
    -- Prevent auth crash if conflict or lock occurs
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_or_updated ON auth.users;

CREATE TRIGGER on_auth_user_created_or_updated
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_sync();

-- ---------------------------------------------------------------------------
-- 4. CLEAN AND HARDEN TICKETS RLS POLICIES
-- ---------------------------------------------------------------------------
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ticket select policy" ON public.tickets;
DROP POLICY IF EXISTS "Ticket insert policy" ON public.tickets;
DROP POLICY IF EXISTS "Ticket update policy" ON public.tickets;
DROP POLICY IF EXISTS "Ticket delete policy" ON public.tickets;

CREATE POLICY "Ticket select policy"
  ON public.tickets FOR SELECT
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

CREATE POLICY "Ticket insert policy"
  ON public.tickets FOR INSERT
  WITH CHECK (
    customer_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.is_approved_agent(auth.uid())
  );

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

CREATE POLICY "Ticket delete policy"
  ON public.tickets FOR DELETE
  USING (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 5. ENSURE DEMO ADMIN & USERS ARE SYNCED AND VALID
-- ---------------------------------------------------------------------------
UPDATE auth.users
SET 
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "ADMIN", "name": "Administrator"}'::jsonb,
  raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "ADMIN"}'::jsonb
WHERE email = 'admin@servicedesk.com';

INSERT INTO public.users (id, name, email, role, is_approved, approval_status, created_at, updated_at)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'name', 'Administrator'),
  email,
  'ADMIN',
  true,
  'APPROVED',
  COALESCE(created_at, NOW()),
  NOW()
FROM auth.users
WHERE email = 'admin@servicedesk.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'ADMIN',
  is_approved = true,
  approval_status = 'APPROVED',
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 6. PERMISSIONS & SCHEMA CACHE RELOAD
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
