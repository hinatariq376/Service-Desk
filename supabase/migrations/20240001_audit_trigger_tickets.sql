-- =============================================================================
-- Migration: Audit trigger for the `tickets` table
--
-- Records every INSERT and UPDATE on the tickets table into audit_logs.
-- The trigger uses the authenticated user's JWT claims to identify the actor.
-- When running from a service role (no JWT claims), actor_id is NULL and
-- actor_name / actor_role fall back to a "system" sentinel value so audit
-- entries are always written even for server-side operations.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: resolve the current actor from Supabase JWT claims
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth.actor_id() RETURNS text
  LANGUAGE sql STABLE
  AS $$
    SELECT COALESCE(
      auth.uid()::text,
      current_setting('request.jwt.claims', true)::json->>'sub'
    );
$$;

-- ---------------------------------------------------------------------------
-- Trigger function: log ticket INSERT and UPDATE events
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit.fn_audit_tickets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER   -- runs as the function owner, bypasses RLS on audit_logs
SET search_path = public, audit
AS $$
DECLARE
  v_actor_id   text;
  v_actor_name text;
  v_actor_role text;
  v_action     text;
  v_old_val    jsonb;
  v_new_val    jsonb;
  v_entity_id  text;
  v_user_row   public.users%ROWTYPE;
BEGIN
  -- -------------------------------------------------------------------------
  -- Resolve the acting user from the JWT subject claim.
  -- Falls back to 'system' when running outside an authenticated request
  -- (e.g., edge functions using the service key, scheduled jobs).
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

  -- -------------------------------------------------------------------------
  -- Format the entity ID to match the application TCK-XXXXXXXX convention.
  -- -------------------------------------------------------------------------
  v_entity_id := 'TCK-' || UPPER(REPLACE(
    SUBSTRING(
      CASE
        WHEN TG_OP = 'DELETE' THEN OLD.id::text
        ELSE NEW.id::text
      END
      FROM 1 FOR 8
    ),
    '-', ''
  ));

  -- -------------------------------------------------------------------------
  -- Determine the action and compute the diff (only changed columns).
  -- -------------------------------------------------------------------------
  IF TG_OP = 'INSERT' THEN
    v_action  := 'TICKET_CREATED';
    v_old_val := NULL;
    v_new_val := jsonb_build_object(
      'title',    NEW.title,
      'status',   NEW.status,
      'priority', NEW.priority
    );

  ELSIF TG_OP = 'UPDATE' THEN
    -- Detect the most semantically significant change and label it precisely.
    -- Multiple columns may change simultaneously (e.g., assignee + status);
    -- we record all of them in the diff but pick the primary action label.
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := 'STATUS_CHANGED';
    ELSIF OLD.priority IS DISTINCT FROM NEW.priority THEN
      v_action := 'PRIORITY_UPDATED';
    ELSIF OLD.assigned_agent_id IS DISTINCT FROM NEW.assigned_agent_id THEN
      v_action := 'AGENT_ASSIGNED';
    ELSIF OLD.sla_breach = false AND NEW.sla_breach = true THEN
      v_action := 'SLA_BREACHED';
    ELSE
      v_action := 'TICKET_UPDATED';
    END IF;

    -- Build diff: only include fields that actually changed.
    v_old_val := '{}'::jsonb;
    v_new_val := '{}'::jsonb;

    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_old_val := v_old_val || jsonb_build_object('status', OLD.status);
      v_new_val := v_new_val || jsonb_build_object('status', NEW.status);
    END IF;

    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
      v_old_val := v_old_val || jsonb_build_object('priority', OLD.priority);
      v_new_val := v_new_val || jsonb_build_object('priority', NEW.priority);
    END IF;

    IF OLD.assigned_agent_id IS DISTINCT FROM NEW.assigned_agent_id THEN
      v_old_val := v_old_val || jsonb_build_object('assigned_agent_id', OLD.assigned_agent_id);
      v_new_val := v_new_val || jsonb_build_object('assigned_agent_id', NEW.assigned_agent_id);
    END IF;

    IF OLD.sla_breach IS DISTINCT FROM NEW.sla_breach THEN
      v_old_val := v_old_val || jsonb_build_object('sla_breach', OLD.sla_breach);
      v_new_val := v_new_val || jsonb_build_object('sla_breach', NEW.sla_breach);
    END IF;

    IF OLD.sla_deadline IS DISTINCT FROM NEW.sla_deadline
       OR OLD.sla_response_deadline IS DISTINCT FROM NEW.sla_response_deadline
       OR OLD.sla_resolution_deadline IS DISTINCT FROM NEW.sla_resolution_deadline THEN
      v_old_val := v_old_val || jsonb_build_object(
        'sla_response_deadline',    OLD.sla_response_deadline,
        'sla_resolution_deadline',  OLD.sla_resolution_deadline
      );
      v_new_val := v_new_val || jsonb_build_object(
        'sla_response_deadline',    NEW.sla_response_deadline,
        'sla_resolution_deadline',  NEW.sla_resolution_deadline
      );
    END IF;

    IF OLD.title IS DISTINCT FROM NEW.title THEN
      v_old_val := v_old_val || jsonb_build_object('title', OLD.title);
      v_new_val := v_new_val || jsonb_build_object('title', NEW.title);
    END IF;

    IF OLD.description IS DISTINCT FROM NEW.description THEN
      v_old_val := v_old_val || jsonb_build_object('description', LEFT(OLD.description, 120));
      v_new_val := v_new_val || jsonb_build_object('description', LEFT(NEW.description, 120));
    END IF;

    -- If nothing changed that we track, skip the audit row entirely.
    IF v_old_val = '{}'::jsonb AND v_new_val = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
  END IF;

  -- -------------------------------------------------------------------------
  -- Insert the audit record.
  -- This uses SECURITY DEFINER so the INSERT always succeeds regardless of
  -- the caller's role, keeping the audit log append-only from the app's PoV.
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
    v_action,
    v_entity_id,
    'Ticket',
    NULLIF(v_old_val, '{}'::jsonb),
    NULLIF(v_new_val, '{}'::jsonb)
  );

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Attach the trigger to the tickets table (AFTER INSERT and AFTER UPDATE).
-- We use AFTER so NEW and OLD are fully committed values.
-- The trigger fires FOR EACH ROW so every individual row change is recorded.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_tickets ON public.tickets;

CREATE TRIGGER trg_audit_tickets
  AFTER INSERT OR UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION audit.fn_audit_tickets();

-- ---------------------------------------------------------------------------
-- Grant: the authenticated role needs EXECUTE on the trigger function.
-- SECURITY DEFINER handles the audit_logs INSERT internally, so no separate
-- INSERT grant on audit_logs is required for regular users.
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION audit.fn_audit_tickets() TO authenticated;
