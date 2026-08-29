-- =============================================================================
-- Migration: 20240002_audit_trigger_comments.sql
-- Description: Audit trigger for the `ticket_comments` table
--
-- Records every INSERT, UPDATE, and DELETE on ticket_comments into audit_logs.
-- Distinguishes internal notes from public replies using the is_internal flag.
-- Runs with SECURITY DEFINER directly inside PostgreSQL.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS audit;

-- ---------------------------------------------------------------------------
-- Trigger Function: audit.fn_audit_ticket_comments()
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
  v_entity_id  text;
  v_ticket_id  uuid;
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
  -- 2. Derive parent ticket UUID and format entity ID
  -- -------------------------------------------------------------------------
  v_ticket_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.ticket_id
    ELSE NEW.ticket_id
  END;

  v_entity_id := 'TCK-' || UPPER(
    REPLACE(SUBSTRING(v_ticket_id::text FROM 1 FOR 8), '-', '')
  );

  -- -------------------------------------------------------------------------
  -- 3. Determine Action & Payload Diff
  -- -------------------------------------------------------------------------
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

  -- -------------------------------------------------------------------------
  -- 4. Insert Audit Log
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
    v_old_val,
    v_new_val
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Attach Trigger: trg_audit_ticket_comments
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_ticket_comments ON public.ticket_comments;

CREATE TRIGGER trg_audit_ticket_comments
  AFTER INSERT OR UPDATE OR DELETE ON public.ticket_comments
  FOR EACH ROW
  EXECUTE FUNCTION audit.fn_audit_ticket_comments();

GRANT EXECUTE ON FUNCTION audit.fn_audit_ticket_comments() TO authenticated, service_role;
