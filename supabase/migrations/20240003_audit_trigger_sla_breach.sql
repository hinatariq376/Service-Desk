-- =============================================================================
-- Migration: SLA breach detection trigger + scheduled check function
--
-- Two complementary mechanisms:
--
--   1. trg_sla_breach_on_update  (reactive)
--      Fires AFTER UPDATE on tickets. If sla_breach flips false → true, or
--      if the ticket's resolution deadline has passed while the ticket is
--      still open, it writes an SLA_BREACHED audit log entry immediately.
--
--   2. fn_check_sla_breaches()   (proactive / scheduled)
--      Scans all non-terminal, non-breached tickets whose sla_deadline has
--      elapsed. Sets sla_breach = true and inserts an SLA_BREACHED audit log
--      for each one. Designed to be called by a pg_cron job or a Supabase
--      Edge Function on a schedule (e.g. every 5 minutes).
--
-- The two mechanisms are complementary:
--   - The reactive trigger catches breaches that happen during a ticket UPDATE.
--   - The scheduled function catches tickets that breach between updates
--     (no one touched the ticket, but time ran out).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Ensure the audit schema exists (created by migration 0001 implicitly, but
-- declared here for safety when running migrations in isolation).
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS audit;

-- ---------------------------------------------------------------------------
-- Terminal statuses: tickets in these states are NOT subject to SLA checks.
-- Stored as a helper to avoid duplication between trigger and scheduled fn.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit.sla_terminal_statuses()
RETURNS text[]
LANGUAGE sql IMMUTABLE
AS $$
  SELECT ARRAY['RESOLVED', 'CLOSED'];
$$;

-- =============================================================================
-- 1. REACTIVE TRIGGER — fires on each ticket UPDATE
-- =============================================================================
CREATE OR REPLACE FUNCTION audit.fn_sla_breach_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit
AS $$
DECLARE
  v_actor_id   text;
  v_actor_name text;
  v_actor_role text;
  v_entity_id  text;
  v_user_row   public.users%ROWTYPE;
  v_deadline   timestamptz;
  v_is_breached boolean;
BEGIN
  -- Only relevant for UPDATE (this trigger is AFTER UPDATE only).
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Skip terminal tickets — resolved/closed tickets have no active SLA.
  IF NEW.status = ANY(audit.sla_terminal_statuses()) THEN
    RETURN NEW;
  END IF;

  -- Determine the effective SLA resolution deadline.
  v_deadline := COALESCE(
    NEW.sla_resolution_deadline::timestamptz,
    NEW.sla_deadline::timestamptz
  );

  -- Evaluate breach: flag was set this update, OR deadline has now passed.
  v_is_breached := (
    (OLD.sla_breach = false AND NEW.sla_breach = true)
    OR
    (NEW.sla_breach = false AND v_deadline IS NOT NULL AND v_deadline <= NOW())
  );

  IF NOT v_is_breached THEN
    RETURN NEW;
  END IF;

  -- If the deadline just passed but the flag isn't set yet, flip it now.
  -- (This handles the case where a non-breach update races the deadline.)
  IF NEW.sla_breach = false AND v_deadline <= NOW() THEN
    UPDATE public.tickets
      SET sla_breach = true,
          updated_at = NOW()::text
    WHERE id = NEW.id;

    -- Reflect the change on NEW for any subsequent triggers in this statement.
    NEW.sla_breach := true;
  END IF;

  -- -------------------------------------------------------------------------
  -- Resolve actor from JWT claims (same pattern as fn_audit_tickets).
  -- -------------------------------------------------------------------------
  v_actor_id := COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb ->> 'sub'),
    NULL
  );

  IF v_actor_id IS NOT NULL THEN
    SELECT * INTO v_user_row FROM public.users WHERE id = v_actor_id::uuid;
    v_actor_name := COALESCE(v_user_row.name, 'Unknown');
    v_actor_role := COALESCE(v_user_row.role, 'SYSTEM');
  ELSE
    v_actor_name := 'system';
    v_actor_role := 'SYSTEM';
  END IF;

  -- Format entity ID.
  v_entity_id := 'TCK-' || UPPER(
    REPLACE(SUBSTRING(NEW.id::text FROM 1 FOR 8), '-', '')
  );

  -- -------------------------------------------------------------------------
  -- Write the SLA_BREACHED audit entry.
  -- -------------------------------------------------------------------------
  INSERT INTO public.audit_logs (
    actor_id,
    actor_name,
    actor_role,
    action,
    entity_id,
    entity_type,
    old_value,
    new_value
  ) VALUES (
    v_actor_id::uuid,
    v_actor_name,
    v_actor_role,
    'SLA_BREACHED',
    v_entity_id,
    'Ticket',
    jsonb_build_object(
      'sla_breach',            false,
      'sla_resolution_deadline', COALESCE(
        OLD.sla_resolution_deadline,
        OLD.sla_deadline
      )
    ),
    jsonb_build_object(
      'sla_breach',            true,
      'status',                NEW.status,
      'priority',              NEW.priority,
      'sla_resolution_deadline', v_deadline
    )
  );

  RETURN NEW;
END;
$$;

-- Attach reactive trigger (AFTER UPDATE only — INSERT cannot breach by definition).
DROP TRIGGER IF EXISTS trg_sla_breach_on_update ON public.tickets;

CREATE TRIGGER trg_sla_breach_on_update
  AFTER UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION audit.fn_sla_breach_on_update();

GRANT EXECUTE ON FUNCTION audit.fn_sla_breach_on_update() TO authenticated;

-- =============================================================================
-- 2. SCHEDULED / PROACTIVE CHECK — call this on a cron schedule
-- =============================================================================
--
-- Usage (pg_cron example — run every 5 minutes):
--
--   SELECT cron.schedule(
--     'sla-breach-sweep',
--     '*/5 * * * *',
--     $$ SELECT audit.fn_check_sla_breaches(); $$
--   );
--
-- Supabase Edge Function alternative:
--   Call this via a Supabase RPC:  supabase.rpc('check_sla_breaches')
--   and expose it as a public wrapper function (see bottom of this file).
-- =============================================================================
CREATE OR REPLACE FUNCTION audit.fn_check_sla_breaches()
RETURNS TABLE(
  ticket_id   uuid,
  entity_id   text,
  priority    text,
  status      text,
  deadline    timestamptz,
  breached_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit
AS $$
DECLARE
  v_rec    RECORD;
  v_entity text;
  v_now    timestamptz := NOW();
BEGIN
  -- Find all tickets that:
  --   a) are not yet marked as breached (sla_breach = false)
  --   b) are not in a terminal state (RESOLVED / CLOSED)
  --   c) have a resolution deadline that has elapsed
  FOR v_rec IN
    SELECT
      t.id,
      t.status,
      t.priority,
      t.customer_id,
      COALESCE(t.sla_resolution_deadline::timestamptz, t.sla_deadline::timestamptz) AS eff_deadline
    FROM public.tickets t
    WHERE
      t.sla_breach = false
      AND t.status <> ALL(audit.sla_terminal_statuses())
      AND COALESCE(
            t.sla_resolution_deadline::timestamptz,
            t.sla_deadline::timestamptz
          ) <= v_now
  LOOP
    -- Flip the breach flag on the ticket row.
    UPDATE public.tickets
      SET sla_breach = true,
          updated_at = v_now::text
    WHERE id = v_rec.id;

    v_entity := 'TCK-' || UPPER(
      REPLACE(SUBSTRING(v_rec.id::text FROM 1 FOR 8), '-', '')
    );

    -- Write the audit log entry (actor is system / scheduled job).
    INSERT INTO public.audit_logs (
      actor_id,
      actor_name,
      actor_role,
      action,
      entity_id,
      entity_type,
      old_value,
      new_value
    ) VALUES (
      NULL,
      'system',
      'SYSTEM',
      'SLA_BREACHED',
      v_entity,
      'Ticket',
      jsonb_build_object(
        'sla_breach', false,
        'sla_resolution_deadline', v_rec.eff_deadline
      ),
      jsonb_build_object(
        'sla_breach', true,
        'status',     v_rec.status,
        'priority',   v_rec.priority,
        'breached_at', v_now
      )
    );

    -- Surface processed tickets to the caller for logging / verification.
    ticket_id   := v_rec.id;
    entity_id   := v_entity;
    priority    := v_rec.priority;
    status      := v_rec.status;
    deadline    := v_rec.eff_deadline;
    breached_at := v_now;
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;

-- ---------------------------------------------------------------------------
-- Public RPC wrapper so the Edge Function / client can call it without
-- knowing the audit schema.  Only service-role or privileged callers should
-- invoke this; RLS on the underlying tables enforces data isolation.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_sla_breaches()
RETURNS TABLE(
  ticket_id   uuid,
  entity_id   text,
  priority    text,
  status      text,
  deadline    timestamptz,
  breached_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, audit
AS $$
  SELECT * FROM audit.fn_check_sla_breaches();
$$;

-- Restrict public RPC to the service role only (not the anon / authenticated roles).
REVOKE ALL ON FUNCTION public.check_sla_breaches() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_sla_breaches() FROM anon;
REVOKE ALL ON FUNCTION public.check_sla_breaches() FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.check_sla_breaches() TO service_role;

GRANT EXECUTE ON FUNCTION audit.fn_check_sla_breaches()    TO service_role;
GRANT EXECUTE ON FUNCTION audit.sla_terminal_statuses()    TO authenticated, service_role;
