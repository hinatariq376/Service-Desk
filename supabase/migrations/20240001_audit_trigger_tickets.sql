-- =============================================================================
-- Migration: 20240001_audit_trigger_tickets.sql
-- Description: Automated Audit Logs for the `tickets` table
--
-- Creates the trigger `trg_audit_ticket_changes` and function
-- `audit.fn_audit_ticket_changes()` that automatically inserts audit logs into
-- the `audit_logs` table directly from PostgreSQL on any INSERT, UPDATE, or
-- DELETE on `public.tickets` (not client-side).
-- =============================================================================

-- Ensure the audit schema exists
CREATE SCHEMA IF NOT EXISTS audit;

-- ---------------------------------------------------------------------------
-- Helper: resolve the current actor from Supabase JWT claims
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth.actor_id() RETURNS text
  LANGUAGE sql STABLE
  AS $$
    SELECT COALESCE(
      auth.uid()::text,
      current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
    );
$$;

-- ---------------------------------------------------------------------------
-- Trigger Function: audit.fn_audit_ticket_changes()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit.fn_audit_ticket_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
DECLARE
  v_actor_id   uuid;
  v_actor_name text;
  v_actor_role text;
  v_action     text;
  v_old_val    jsonb := NULL;
  v_new_val    jsonb := NULL;
  v_entity_id  text;
  v_user_row   public.users%ROWTYPE;
  v_raw_sub    text;
BEGIN
  -- -------------------------------------------------------------------------
  -- 1. Resolve Actor from Supabase Auth context
  -- -------------------------------------------------------------------------
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

  -- -------------------------------------------------------------------------
  -- 2. Format Entity ID (TCK-XXXXXXXX)
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
  -- 3. Determine Action & Payload Diff
  -- -------------------------------------------------------------------------
  IF TG_OP = 'INSERT' THEN
    v_action  := 'TICKET_CREATED';
    v_old_val := NULL;
    v_new_val := jsonb_build_object(
      'title',             NEW.title,
      'category',          NEW.category,
      'priority',          NEW.priority,
      'status',            NEW.status,
      'customer_id',       NEW.customer_id,
      'assigned_agent_id', NEW.assigned_agent_id
    );

  ELSIF TG_OP = 'UPDATE' THEN
    -- Check for Soft Delete / Restore first
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      v_action := 'TICKET_SOFT_DELETED';
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      v_action := 'TICKET_RESTORED';
    ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := 'STATUS_CHANGED';
    ELSIF OLD.priority IS DISTINCT FROM NEW.priority THEN
      v_action := 'PRIORITY_UPDATED';
    ELSIF OLD.assigned_agent_id IS DISTINCT FROM NEW.assigned_agent_id THEN
      v_action := 'AGENT_ASSIGNED';
    ELSIF (OLD.sla_breach = false OR OLD.sla_breach IS NULL) AND NEW.sla_breach = true THEN
      v_action := 'SLA_BREACHED';
    ELSE
      v_action := 'TICKET_UPDATED';
    END IF;

    -- Build column-level diffs
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

    IF OLD.deleted_at IS DISTINCT FROM NEW.deleted_at THEN
      v_old_val := v_old_val || jsonb_build_object('deleted_at', OLD.deleted_at);
      v_new_val := v_new_val || jsonb_build_object('deleted_at', NEW.deleted_at);
    END IF;

    IF OLD.sla_deadline IS DISTINCT FROM NEW.sla_deadline
       OR OLD.sla_response_deadline IS DISTINCT FROM NEW.sla_response_deadline
       OR OLD.sla_resolution_deadline IS DISTINCT FROM NEW.sla_resolution_deadline THEN
      v_old_val := v_old_val || jsonb_build_object(
        'sla_response_deadline',   OLD.sla_response_deadline,
        'sla_resolution_deadline', OLD.sla_resolution_deadline
      );
      v_new_val := v_new_val || jsonb_build_object(
        'sla_response_deadline',   NEW.sla_response_deadline,
        'sla_resolution_deadline', NEW.sla_resolution_deadline
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

    -- If no tracked columns changed, skip insertion
    IF v_old_val = '{}'::jsonb AND v_new_val = '{}'::jsonb THEN
      RETURN NEW;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    v_action  := 'TICKET_DELETED';
    v_old_val := jsonb_build_object(
      'id',                OLD.id,
      'title',             OLD.title,
      'category',          OLD.category,
      'priority',          OLD.priority,
      'status',            OLD.status,
      'customer_id',       OLD.customer_id,
      'assigned_agent_id', OLD.assigned_agent_id
    );
    v_new_val := NULL;
  END IF;

  -- -------------------------------------------------------------------------
  -- 4. Insert Audit Log Entry
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
    v_actor_id,
    v_actor_name,
    v_actor_role,
    v_action,
    v_entity_id,
    'Ticket',
    NULLIF(v_old_val, '{}'::jsonb),
    NULLIF(v_new_val, '{}'::jsonb)
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Attach Trigger: trg_audit_ticket_changes
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_ticket_changes ON public.tickets;
DROP TRIGGER IF EXISTS trg_audit_tickets ON public.tickets;

CREATE TRIGGER trg_audit_ticket_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION audit.fn_audit_ticket_changes();

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION audit.fn_audit_ticket_changes() TO authenticated, service_role;
