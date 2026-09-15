-- =============================================================================
-- Migration: 20240007_user_sync_and_agent_approval.sql
-- Description: User Backfill, Automatic Auth Sync Trigger, and Agent Approval Workflow
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. ADD IS_APPROVED COLUMN TO PUBLIC.USERS
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

-- Customers and Admins are approved by default; existing support agents default to approved
UPDATE public.users 
SET is_approved = true 
WHERE role IN ('CUSTOMER', 'ADMIN') OR is_approved IS NULL;

-- ---------------------------------------------------------------------------
-- 2. BACKFILL MISSING USERS FROM AUTH.USERS TO PUBLIC.USERS
-- ---------------------------------------------------------------------------
INSERT INTO public.users (id, name, email, role, is_approved, created_at, updated_at)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1), 'User') AS name,
  au.email,
  COALESCE(au.raw_user_meta_data->>'role', 'CUSTOMER') AS role,
  CASE 
    WHEN COALESCE(au.raw_user_meta_data->>'role', 'CUSTOMER') = 'SUPPORT_AGENT' THEN false 
    ELSE true 
  END AS is_approved,
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
-- 3. AFTER INSERT OR UPDATE TRIGGER ON AUTH.USERS FOR AUTOMATIC SYNC
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
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'CUSTOMER');
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), 'User');
  
  -- Support agents require approval, customers and admins are auto-approved
  user_approved := (user_role != 'SUPPORT_AGENT');

  INSERT INTO public.users (id, name, email, role, is_approved, created_at, updated_at)
  VALUES (
    NEW.id,
    user_name,
    NEW.email,
    user_role,
    user_approved,
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

-- ---------------------------------------------------------------------------
-- 4. RELOAD POSTGREST SCHEMA CACHE
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
