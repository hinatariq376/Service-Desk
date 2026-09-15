-- =============================================================================
-- Migration: 20240010_agent_approval_and_ticket_fixes.sql
-- Description: Agent Approval Status (PENDING, APPROVED, DENIED) and Ticket RLS Fixes
-- =============================================================================

-- 1. Add approval_status to public.users if not exists
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'PENDING';

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS chk_users_approval_status;

ALTER TABLE public.users
  ADD CONSTRAINT chk_users_approval_status 
  CHECK (approval_status IN ('PENDING', 'APPROVED', 'DENIED'));

-- 2. Backfill approval_status based on existing is_approved and role
UPDATE public.users
  SET approval_status = 'APPROVED', is_approved = true
  WHERE UPPER(role) != 'SUPPORT_AGENT';

UPDATE public.users
  SET approval_status = 'APPROVED'
  WHERE UPPER(role) = 'SUPPORT_AGENT' AND is_approved = true;

UPDATE public.users
  SET approval_status = 'PENDING'
  WHERE UPPER(role) = 'SUPPORT_AGENT' AND (is_approved = false OR is_approved IS NULL) AND approval_status IS NULL;

-- 3. Hardened Ticket Selection Policy for Admins and Customers (Case-Insensitive & Reliable)
DROP POLICY IF EXISTS "Ticket select policy" ON public.tickets;

CREATE POLICY "Ticket select policy"
  ON public.tickets FOR SELECT
  USING (
    -- Customer: tickets submitted by customer
    (
      customer_id = auth.uid()
      AND deleted_at IS NULL
    )
    OR
    -- Support Agent: assigned or unassigned tickets (approved agents only)
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
    -- Admin: full access to all active non-deleted tickets
    (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() 
          AND UPPER(role) = 'ADMIN'
      )
    )
  );

-- 4. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
