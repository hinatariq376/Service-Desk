-- =============================================================================
-- Migration: 20240009_fix_trigger_entity_id_uuid.sql
-- Description: Fix "column entity_id is of type uuid but expression is of type text"
--
-- Updates audit trigger functions to pass the ticket's raw UUID (e.g. NEW.id)
-- instead of a prefixed text string ('TCK-XXXXXXXX') to match the uuid column type.
-- =============================================================================

-- Ensure audit schema exists
CREATE SCHEMA IF NOT EXISTS audit;

-- ---------------------------------------------------------------------------
-- 1. Fix audit.fn_audit_ticket_changes()
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
  v_entity_uuid uuid;
  v_user_row   public.users%ROWTYPE;
  v_raw_sub    text;
BEGIN
  -- 1. Resolve Actor
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

  -- 2. Entity UUID
  v_entity_uuid := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.id
    ELSE NEW.id
  END;

  -- 3. Determine Action & Payload Diff
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

    IF OLD.title IS DISTINCT FROM NEW.title THEN
      v_old_val := v_old_val || jsonb_build_object('title', OLD.title);
      v_new_val := v_new_val || jsonb_build_object('title', NEW.title);
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

  -- 4. Insert Audit Log Entry into audit_logs (and activity_logs if present)
  BEGIN
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
      v_entity_uuid,
      'Ticket',
      NULLIF(v_old_val, '{}'::jsonb),
      NULLIF(v_new_val, '{}'::jsonb)
    );
  EXCEPTION WHEN OTHERS THEN
    -- Fallback/swallow to not block ticket update if table variation occurs
    NULL;
  END;

  BEGIN
    INSERT INTO public.activity_logs (
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
      v_entity_uuid,
      'Ticket',
      NULLIF(v_old_val, '{}'::jsonb),
      NULLIF(v_new_val, '{}'::jsonb)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Fix audit.fn_audit_ticket_comments()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit.fn_audit_ticket_comments()
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
  v_ticket_id  uuid;
  v_user_row   public.users%ROWTYPE;
  v_raw_sub    text;
BEGIN
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

  v_ticket_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.ticket_id
    ELSE NEW.ticket_id
  END;

  IF TG_OP = 'INSERT' THEN
    v_action  := CASE WHEN NEW.is_internal THEN 'INTERNAL_NOTE_ADDED' ELSE 'COMMENT_ADDED' END;
    v_old_val := NULL;
    v_new_val := jsonb_build_object(
      'comment_id',  NEW.id,
      'is_internal', NEW.is_internal,
      'content',     LEFT(NEW.content, 120)
    );

  ELSIF TG_OP = 'UPDATE' THEN
    v_action  := 'COMMENT_EDITED';
    v_old_val := jsonb_build_object(
      'content',     LEFT(OLD.content, 120),
      'is_internal', OLD.is_internal
    );
    v_new_val := jsonb_build_object(
      'content',     LEFT(NEW.content, 120),
      'is_internal', NEW.is_internal
    );

    IF OLD.content IS NOT DISTINCT FROM NEW.content
       AND OLD.is_internal IS NOT DISTINCT FROM NEW.is_internal THEN
      RETURN NEW;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    v_action  := 'COMMENT_DELETED';
    v_old_val := jsonb_build_object(
      'comment_id',  OLD.id,
      'is_internal', OLD.is_internal,
      'content',     LEFT(OLD.content, 120)
    );
    v_new_val := NULL;
  END IF;

  BEGIN
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
      v_ticket_id,
      'TicketComment',
      NULLIF(v_old_val, '{}'::jsonb),
      NULLIF(v_new_val, '{}'::jsonb)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.activity_logs (
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
      v_ticket_id,
      'TicketComment',
      NULLIF(v_old_val, '{}'::jsonb),
      NULLIF(v_new_val, '{}'::jsonb)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Fix audit.fn_sla_breach_on_update()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit.fn_sla_breach_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
DECLARE
  v_actor_id   uuid;
  v_actor_name text;
  v_actor_role text;
  v_now        timestamptz := transaction_timestamp();
  v_deadline   timestamptz;
  v_raw_sub    text;
BEGIN
  IF (OLD.sla_breach = false OR OLD.sla_breach IS NULL) AND NEW.sla_breach = true THEN
    v_raw_sub := COALESCE(
      auth.uid()::text,
      current_setting('request.jwt.claims', true)::jsonb ->> 'sub',
      NULL
    );

    IF v_raw_sub IS NOT NULL AND v_raw_sub ~ '^[0-9a-fA-F-]{36}$' THEN
      v_actor_id := v_raw_sub::uuid;
      SELECT name, role INTO v_actor_name, v_actor_role FROM public.users WHERE id = v_actor_id;
      v_actor_name := COALESCE(v_actor_name, 'Authenticated User');
      v_actor_role := COALESCE(v_actor_role, 'USER');
    ELSE
      v_actor_id := NULL;
      v_actor_name := 'system';
      v_actor_role := 'SYSTEM';
    END IF;

    v_deadline := COALESCE(NEW.sla_resolution_deadline, NEW.sla_deadline);

    BEGIN
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
        NEW.id,
        'Ticket',
        jsonb_build_object('sla_breach', false, 'sla_resolution_deadline', COALESCE(OLD.sla_resolution_deadline, OLD.sla_deadline)),
        jsonb_build_object('sla_breach', true, 'status', NEW.status, 'priority', NEW.priority, 'sla_resolution_deadline', v_deadline, 'breached_at', v_now)
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    BEGIN
      INSERT INTO public.activity_logs (
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
        NEW.id,
        'Ticket',
        jsonb_build_object('sla_breach', false, 'sla_resolution_deadline', COALESCE(OLD.sla_resolution_deadline, OLD.sla_deadline)),
        jsonb_build_object('sla_breach', true, 'status', NEW.status, 'priority', NEW.priority, 'sla_resolution_deadline', v_deadline, 'breached_at', v_now)
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Reload PostgREST Schema
NOTIFY pgrst, 'reload schema';
