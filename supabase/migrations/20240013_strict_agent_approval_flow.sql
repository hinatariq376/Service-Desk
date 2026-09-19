-- =============================================================================
-- Migration: 20240013_strict_agent_approval_flow.sql
-- Description: Strict One-Time Agent Approval Flow & Immutability Trigger
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Ensure Columns and Constraints on public.users
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

-- Set default values for non-agents
UPDATE public.users 
  SET is_approved = true, approval_status = 'APPROVED'
  WHERE UPPER(role) IN ('ADMIN', 'CUSTOMER');

-- ---------------------------------------------------------------------------
-- 2. Auth User Registration Trigger: New Support Agents Start as Unapproved (is_approved = false)
-- ---------------------------------------------------------------------------
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

  -- Support agents STRICTLY require one-time administrator approval (is_approved = false)
  IF v_role = 'SUPPORT_AGENT' THEN
    v_is_approved := FALSE;
    v_approval_status := 'PENDING';
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

-- Also ensure handle_auth_user_sync trigger matches if used
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
  user_role := UPPER(COALESCE(NEW.raw_user_meta_data->>'role', 'CUSTOMER'));
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), 'User');
  
  IF user_role = 'SUPPORT_AGENT' THEN
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

-- ---------------------------------------------------------------------------
-- 3. Strict Permanent Approval DB Invariant Trigger
-- Prevents approved agents (is_approved = true) from ever being revoked/unapproved
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_permanent_agent_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Strict permanent approval rule: once is_approved is TRUE, it cannot be reverted to FALSE
  IF OLD.is_approved = TRUE AND NEW.is_approved = FALSE THEN
    RAISE EXCEPTION 'Permanent approval rule violation: An approved Support Agent cannot be unapproved or revoked.';
  END IF;
  
  -- Once approved, approval_status cannot be changed back to PENDING or DENIED
  IF OLD.approval_status = 'APPROVED' AND NEW.approval_status IN ('PENDING', 'DENIED') THEN
    RAISE EXCEPTION 'Permanent approval rule violation: An approved Support Agent status cannot be changed.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_permanent_agent_approval ON public.users;
CREATE TRIGGER trg_enforce_permanent_agent_approval
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_permanent_agent_approval();

-- ---------------------------------------------------------------------------
-- 4. Reload PostgREST Cache
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
