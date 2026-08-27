-- =============================================================================
-- Migration: Audit trigger for the `ticket_comments` table
--
-- Records every INSERT and UPDATE on ticket_comments into audit_logs.
-- Distinguishes internal notes from public replies using the is_internal flag.
-- DELETE is also captured so comment removal leaves a forensic trail.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Trigger function: log ticket_comments INSERT, UPDATE, and DELETE events
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit.fn_audit_ticket_comments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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
  v_ticket_id  uuid;
  v_user_row   public.users%ROWTYPE;
BEGIN
  -- -------------------------------------------------------------------------
  -- Resolve the acting user from the JWT subject claim.
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
  -- Derive the parent ticket UUID, then format the entity ID.
  -- -------------------------------------------------------------------------
  v_ticket_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.ticket_id
    ELSE NEW.ticket_id
  END;

  v_entity_id := 'TCK-' || UPPER(
    REPLACE(SUBSTRING(v_ticket_id::text FROM 1 FOR 8), '-', '')
  );

  -- -------------------------------------------------------------------------
  -- Build action label and diff payload per operation type.
  -- -------------------------------------------------------------------------
  IF TG_OP = 'INSERT' THEN
    -- Distinguish internal note from a public reply at insert time.
    v_action  := CASE WHEN NEW.is_internal THEN 'INTERNAL_NOTE_ADDED' ELSE 'COMMENT_ADDED' END;
    v_old_val := NULL;
    v_new_val := jsonb_build_object(
      'comment_id',  NEW.id,
      'is_internal', NEW.is_internal,
      -- Truncate to 120 chars to match application-level behaviour in ticketService.ts
      'content',     LEFT(NEW.content, 120)
    );

  ELSIF TG_OP = 'UPDATE' THEN
    -- Comments are typically immutable in this app, but capture edits if they occur.
    v_action  := 'COMMENT_EDITED';
    v_old_val := jsonb_build_object(
      'content',     LEFT(OLD.content, 120),
      'is_internal', OLD.is_internal
    );
    v_new_val := jsonb_build_object(
      'content',     LEFT(NEW.content, 120),
      'is_internal', NEW.is_internal
    );

    -- Skip the audit row if nothing meaningful changed.
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
  -- Write the audit record.
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
    v_old_val,
    v_new_val
  );

  -- For DELETE triggers we must return OLD, not NEW.
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Attach the trigger to ticket_comments.
-- Covers INSERT (new comment / note), UPDATE (edit), and DELETE (removal).
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_ticket_comments ON public.ticket_comments;

CREATE TRIGGER trg_audit_ticket_comments
  AFTER INSERT OR UPDATE OR DELETE ON public.ticket_comments
  FOR EACH ROW
  EXECUTE FUNCTION audit.fn_audit_ticket_comments();

GRANT EXECUTE ON FUNCTION audit.fn_audit_ticket_comments() TO authenticated;
