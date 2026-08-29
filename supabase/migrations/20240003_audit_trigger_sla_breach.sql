-- =============================================================================
-- Migration: 20240003_audit_trigger_sla_breach.sql
-- Description: Server-side SLA Calculations and Breach Monitoring
--
-- Guarantees SLA integrity by calculating deadlines and detecting breaches
-- strictly via PostgreSQL server-side transaction_timestamp() / NOW().
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS audit;

-- ---------------------------------------------------------------------------
-- 1. Helper: Terminal statuses exempt from active SLA monitoring
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit.sla_terminal_statuses()
RETURNS text[]
LANGUAGE sql IMMUTABLE
AS $$
  SELECT ARRAY['RESOLVED', 'CLOSED'];
$$;

-- ---------------------------------------------------------------------------
-- 2. Server-side SLA Calculation Engine
-- Computes response and resolution deadlines relative to a base timestamp.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit.calculate_sla_deadlines(
  p_priority text,
  p_base_time timestamptz DEFAULT transaction_timestamp()
)
RETURNS TABLE(
  sla_response_deadline timestamptz,
  sla_resolution_deadline timestamptz,
  sla_deadline timestamptz
)
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  v_base timestamptz := COALESCE(p_base_time, transaction_timestamp());
  v_resp timestamptz;
  v_res  timestamptz;
BEGIN
  CASE UPPER(COALESCE(p_priority, 'MEDIUM'))
    WHEN 'CRITICAL' THEN
      v_resp := v_base + interval '15 minutes';
      v_res  := v_base + interval '4 hours';
    WHEN 'HIGH' THEN
      v_resp := v_base + interval '1 hour';
      v_res  := v_base + interval '8 hours';
    WHEN 'MEDIUM' THEN
      v_resp := v_base + interval '4 hours';
      v_res  := v_base + interval '24 hours';
    WHEN 'LOW' THEN
      v_resp := v_base + interval '8 hours';
      v_res  := v_base + interval '72 hours';
    ELSE
      v_resp := v_base + interval '4 hours';
      v_res  := v_base + interval '24 hours';
  END CASE;

  sla_response_deadline   := v_resp;
  sla_resolution_deadline := v_res;
  sla_deadline            := v_res;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. BEFORE Trigger: Enforce Server-Side SLA Calculation on Ticket Insert / Priority Change
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit.fn_enforce_ticket_sla()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
DECLARE
  v_sla RECORD;
  v_base_time timestamptz;
BEGIN
  -- Guarantee server-side timestamp for created_at and updated_at
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := COALESCE(NEW.created_at, transaction_timestamp());
    NEW.updated_at := transaction_timestamp();
    v_base_time := NEW.created_at;

    -- Calculate SLA deadlines server-side
    SELECT * INTO v_sla FROM audit.calculate_sla_deadlines(NEW.priority, v_base_time);
    NEW.sla_response_deadline   := v_sla.sla_response_deadline;
    NEW.sla_resolution_deadline := v_sla.sla_resolution_deadline;
    NEW.sla_deadline            := v_sla.sla_deadline;
    NEW.sla_breach              := COALESCE(NEW.sla_breach, false);

  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_at := transaction_timestamp();

    -- If priority changed, recalculate SLA deadlines preserving original created_at
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
      v_base_time := COALESCE(OLD.created_at, transaction_timestamp());
      SELECT * INTO v_sla FROM audit.calculate_sla_deadlines(NEW.priority, v_base_time);
      NEW.sla_response_deadline   := v_sla.sla_response_deadline;
      NEW.sla_resolution_deadline := v_sla.sla_resolution_deadline;
      NEW.sla_deadline            := v_sla.sla_deadline;

      -- Check if new priority deadline is already breached at current time
      IF NEW.status <> ALL(audit.sla_terminal_statuses()) THEN
        NEW.sla_breach := (v_sla.sla_resolution_deadline <= transaction_timestamp());
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calculate_ticket_sla ON public.tickets;
CREATE TRIGGER trg_calculate_ticket_sla
  BEFORE INSERT OR UPDATE OF priority ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION audit.fn_enforce_ticket_sla();

-- ---------------------------------------------------------------------------
-- 4. Reactive Trigger: SLA Breach on Ticket Update
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit.fn_sla_breach_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
DECLARE
  v_actor_id    uuid;
  v_actor_name  text;
  v_actor_role  text;
  v_entity_id   text;
  v_user_row    public.users%ROWTYPE;
  v_deadline    timestamptz;
  v_is_breached boolean;
  v_raw_sub     text;
  v_now         timestamptz := transaction_timestamp();
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Skip terminal or soft-deleted tickets
  IF NEW.status = ANY(audit.sla_terminal_statuses()) OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_deadline := COALESCE(NEW.sla_resolution_deadline, NEW.sla_deadline);

  -- Evaluate breach: flipped true OR server deadline has passed
  v_is_breached := (
    (COALESCE(OLD.sla_breach, false) = false AND NEW.sla_breach = true)
    OR
    (COALESCE(NEW.sla_breach, false) = false AND v_deadline IS NOT NULL AND v_deadline <= v_now)
  );

  IF NOT v_is_breached THEN
    RETURN NEW;
  END IF;

  -- If deadline has passed and flag is not yet persisted, update it
  IF COALESCE(NEW.sla_breach, false) = false AND v_deadline <= v_now THEN
    UPDATE public.tickets
      SET sla_breach = true,
          updated_at = v_now
    WHERE id = NEW.id;

    NEW.sla_breach := true;
  END IF;

  -- Resolve Actor
  v_raw_sub := COALESCE(
    auth.uid()::text,
    current_setting('request.jwt.claims', true)::jsonb ->> 'sub',
    NULL
  );

  IF v_raw_sub IS NOT NULL AND v_raw_sub ~ '^[0-9a-fA-F-]{36}$' THEN
    v_actor_id := v_raw_sub::uuid;
    SELECT * INTO v_user_row FROM public.users WHERE id = v_actor_id;
    v_actor_name := COALESCE(v_user_row.name, 'Authenticated User');
    v_actor_role := COALESCE(v_user_row.role, 'USER');
  ELSE
    v_actor_id := NULL;
    v_actor_name := 'system';
    v_actor_role := 'SYSTEM';
  END IF;

  v_entity_id := 'TCK-' || UPPER(REPLACE(SUBSTRING(NEW.id::text FROM 1 FOR 8), '-', ''));

  -- Insert SLA_BREACHED Audit Log Entry
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
    v_actor_id,
    v_actor_name,
    v_actor_role,
    'SLA_BREACHED',
    v_entity_id,
    'Ticket',
    jsonb_build_object(
      'sla_breach', false,
      'sla_resolution_deadline', COALESCE(OLD.sla_resolution_deadline, OLD.sla_deadline)
    ),
    jsonb_build_object(
      'sla_breach', true,
      'status', NEW.status,
      'priority', NEW.priority,
      'sla_resolution_deadline', v_deadline,
      'breached_at', v_now
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sla_breach_on_update ON public.tickets;
CREATE TRIGGER trg_sla_breach_on_update
  AFTER UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION audit.fn_sla_breach_on_update();

-- ---------------------------------------------------------------------------
-- 5. Scheduled Proactive SLA Sweep Function
-- ---------------------------------------------------------------------------
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
SET search_path = public, audit, pg_temp
AS $$
DECLARE
  v_rec    RECORD;
  v_entity text;
  v_now    timestamptz := transaction_timestamp();
BEGIN
  FOR v_rec IN
    SELECT
      t.id,
      t.status,
      t.priority,
      t.customer_id,
      COALESCE(t.sla_resolution_deadline, t.sla_deadline) AS eff_deadline
    FROM public.tickets t
    WHERE
      COALESCE(t.sla_breach, false) = false
      AND t.deleted_at IS NULL
      AND t.status <> ALL(audit.sla_terminal_statuses())
      AND COALESCE(t.sla_resolution_deadline, t.sla_deadline) <= v_now
    FOR UPDATE OF t
  LOOP
    -- Flip breach flag
    UPDATE public.tickets
      SET sla_breach = true,
          updated_at = v_now
    WHERE id = v_rec.id;

    v_entity := 'TCK-' || UPPER(REPLACE(SUBSTRING(v_rec.id::text FROM 1 FOR 8), '-', ''));

    -- Write Audit Log
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
        'status', v_rec.status,
        'priority', v_rec.priority,
        'breached_at', v_now
      )
    );

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
-- 6. Public RPC wrapper for background Edge Functions or pg_cron
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
SET search_path = public, audit, pg_temp
AS $$
  SELECT * FROM audit.fn_check_sla_breaches();
$$;

REVOKE ALL ON FUNCTION public.check_sla_breaches() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_sla_breaches() TO service_role;
GRANT EXECUTE ON FUNCTION audit.fn_check_sla_breaches() TO service_role;
GRANT EXECUTE ON FUNCTION audit.calculate_sla_deadlines(text, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION audit.sla_terminal_statuses() TO authenticated, service_role;
