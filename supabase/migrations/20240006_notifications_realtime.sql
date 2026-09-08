-- =============================================================================
-- Migration: 20240006_notifications_realtime.sql
-- Description: Real-Time Notification System
--
-- Creates:
--   1. public.notifications table (user-targeted push events)
--   2. Supabase Realtime publication for notifications, tickets, ticket_comments
--   3. RLS policies (users read/update own; trigger-only INSERT via SECURITY DEFINER)
--   4. audit.fn_notify_on_ticket_change() — inserts targeted notifications when:
--        • A ticket is created     → notify all ADMIN users
--        • Status changes          → notify customer + assigned agent
--        • Agent is assigned       → notify the assigned agent
--        • Comment is added        → notify customer (if agent posted) or agent (if customer posted)
--   5. Triggers wired to tickets and ticket_comments tables
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. NOTIFICATIONS TABLE
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN (
                'TICKET_CREATED',
                'STATUS_CHANGED',
                'AGENT_ASSIGNED',
                'COMMENT_ADDED',
                'INTERNAL_NOTE_ADDED',
                'SLA_BREACH_WARNING',
                'SLA_BREACHED'
              )),
  title       text NOT NULL,
  body        text NOT NULL,
  entity_id   text NOT NULL,  -- TCK-XXXXXXXX formatted ticket ID
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, is_read, created_at DESC)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON public.notifications (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. ENABLE ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop any stale policies
DROP POLICY IF EXISTS "Users can read own notifications"          ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications"        ON public.notifications;
DROP POLICY IF EXISTS "Deny direct insert on notifications"       ON public.notifications;
DROP POLICY IF EXISTS "Deny direct delete on notifications"       ON public.notifications;

-- SELECT: users can only see their own notifications
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

-- UPDATE: users can only mark their own notifications as read
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- INSERT: strictly blocked from clients; only SECURITY DEFINER triggers may insert
CREATE POLICY "Deny direct insert on notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (false);

-- DELETE: users may delete (dismiss) their own notifications
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. GRANTS
-- ---------------------------------------------------------------------------
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
GRANT USAGE ON SEQUENCE public.notifications_id_seq TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. SUPABASE REALTIME — Enable publications
-- ---------------------------------------------------------------------------
-- Supabase Realtime uses the supabase_realtime publication.
-- The notifications table must be added so postgres_changes events fire.
DO $$
BEGIN
  -- Add notifications table if not already in the publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  -- Ensure tickets table is in the publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
  END IF;

  -- Ensure ticket_comments table is in the publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'ticket_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_comments;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. HELPER: Format Ticket Entity ID (TCK-XXXXXXXX)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit.format_ticket_entity_id(p_id uuid)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT 'TCK-' || UPPER(REPLACE(SUBSTRING(p_id::text FROM 1 FOR 8), '-', ''));
$$;

-- ---------------------------------------------------------------------------
-- 6. NOTIFICATION TRIGGER FUNCTION — Tickets Table
--    Fires AFTER INSERT or UPDATE on public.tickets
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit.fn_notify_on_ticket_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
DECLARE
  v_entity_id   text;
  v_actor_id    uuid;
  v_raw_sub     text;
  v_admin_row   RECORD;
BEGIN
  -- Resolve current actor (the user making the change)
  v_raw_sub := COALESCE(
    auth.uid()::text,
    current_setting('request.jwt.claims', true)::jsonb ->> 'sub',
    NULL
  );

  IF v_raw_sub IS NOT NULL AND v_raw_sub ~ '^[0-9a-fA-F-]{36}$' THEN
    v_actor_id := v_raw_sub::uuid;
  ELSE
    v_actor_id := NULL;
  END IF;

  v_entity_id := audit.format_ticket_entity_id(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END
  );

  -- -------------------------------------------------------------------------
  -- A. TICKET CREATED — notify all ADMIN users
  -- -------------------------------------------------------------------------
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, type, title, body, entity_id)
    SELECT
      u.id,
      'TICKET_CREATED',
      'New Ticket: ' || NEW.title,
      'A new ' || NEW.priority || ' priority ticket has been submitted by a customer.',
      v_entity_id
    FROM public.users u
    WHERE u.role = 'ADMIN'
      AND (v_actor_id IS NULL OR u.id <> v_actor_id); -- don't notify the creator if they are an admin
    RETURN NEW;
  END IF;

  -- -------------------------------------------------------------------------
  -- B. UPDATE events
  -- -------------------------------------------------------------------------
  IF TG_OP = 'UPDATE' THEN

    -- B1. AGENT ASSIGNED — notify the newly assigned agent
    IF OLD.assigned_agent_id IS DISTINCT FROM NEW.assigned_agent_id
       AND NEW.assigned_agent_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, entity_id)
      VALUES (
        NEW.assigned_agent_id,
        'AGENT_ASSIGNED',
        'Ticket Assigned to You: ' || v_entity_id,
        'You have been assigned ticket "' || NEW.title || '" (' || NEW.priority || ' priority).',
        v_entity_id
      )
      ON CONFLICT DO NOTHING;
    END IF;

    -- B2. STATUS CHANGED — notify customer; also notify assigned agent if customer triggered it
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      -- Notify the customer (ticket owner) unless they triggered the change
      IF NEW.customer_id IS NOT NULL
         AND (v_actor_id IS NULL OR NEW.customer_id <> v_actor_id) THEN
        INSERT INTO public.notifications (user_id, type, title, body, entity_id)
        VALUES (
          NEW.customer_id,
          'STATUS_CHANGED',
          'Ticket ' || v_entity_id || ' Updated',
          'Status changed from ' || REPLACE(OLD.status, '_', ' ')
            || ' → ' || REPLACE(NEW.status, '_', ' ') || '.',
          v_entity_id
        );
      END IF;

      -- Also notify assigned agent if the customer (or system) changed status
      IF NEW.assigned_agent_id IS NOT NULL
         AND (v_actor_id IS NULL OR NEW.assigned_agent_id <> v_actor_id)
         AND NEW.assigned_agent_id <> NEW.customer_id THEN
        INSERT INTO public.notifications (user_id, type, title, body, entity_id)
        VALUES (
          NEW.assigned_agent_id,
          'STATUS_CHANGED',
          'Ticket ' || v_entity_id || ' Status Changed',
          'Status changed from ' || REPLACE(OLD.status, '_', ' ')
            || ' → ' || REPLACE(NEW.status, '_', ' ') || '.',
          v_entity_id
        );
      END IF;
    END IF;

    -- B3. SLA BREACHED — notify customer and assigned agent
    IF (COALESCE(OLD.sla_breach, false) = false AND NEW.sla_breach = true) THEN
      -- Notify customer
      IF NEW.customer_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, entity_id)
        VALUES (
          NEW.customer_id,
          'SLA_BREACHED',
          'SLA Breached: ' || v_entity_id,
          'The SLA deadline for your ' || NEW.priority || ' ticket has been exceeded.',
          v_entity_id
        );
      END IF;

      -- Notify assigned agent
      IF NEW.assigned_agent_id IS NOT NULL
         AND NEW.assigned_agent_id <> NEW.customer_id THEN
        INSERT INTO public.notifications (user_id, type, title, body, entity_id)
        VALUES (
          NEW.assigned_agent_id,
          'SLA_BREACHED',
          'SLA Breached on Assigned Ticket: ' || v_entity_id,
          'Ticket "' || NEW.title || '" has exceeded its SLA deadline. Immediate action required.',
          v_entity_id
        );
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. NOTIFICATION TRIGGER FUNCTION — ticket_comments Table
--    Fires AFTER INSERT on public.ticket_comments
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit.fn_notify_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
DECLARE
  v_ticket      public.tickets%ROWTYPE;
  v_author      public.users%ROWTYPE;
  v_entity_id   text;
  v_notif_type  text;
  v_title       text;
  v_body        text;
  v_target_id   uuid;
BEGIN
  -- Load parent ticket
  SELECT * INTO v_ticket FROM public.tickets WHERE id = NEW.ticket_id;
  IF NOT FOUND OR v_ticket.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Load comment author
  SELECT * INTO v_author FROM public.users WHERE id = NEW.author_id;

  v_entity_id := audit.format_ticket_entity_id(NEW.ticket_id);

  -- Internal notes only go to agents/admins — skip customer notification
  IF NEW.is_internal THEN
    -- Notify all ADMINs if the author is not already an admin
    INSERT INTO public.notifications (user_id, type, title, body, entity_id)
    SELECT
      u.id,
      'INTERNAL_NOTE_ADDED',
      'Internal Note on ' || v_entity_id,
      COALESCE(v_author.name, 'An agent') || ' added an internal note.',
      v_entity_id
    FROM public.users u
    WHERE u.role IN ('ADMIN', 'SUPPORT_AGENT')
      AND u.id <> NEW.author_id;
    RETURN NEW;
  END IF;

  -- Determine who to notify (the OTHER party)
  v_notif_type := 'COMMENT_ADDED';

  IF v_author.role = 'CUSTOMER' THEN
    -- Customer posted → notify assigned agent (or all agents/admins if unassigned)
    IF v_ticket.assigned_agent_id IS NOT NULL THEN
      v_target_id := v_ticket.assigned_agent_id;
      v_title := 'Customer replied on ' || v_entity_id;
      v_body  := COALESCE(v_author.name, 'Customer') || ' replied: "'
                 || LEFT(NEW.content, 80) || CASE WHEN LENGTH(NEW.content) > 80 THEN '…' ELSE '' END || '"';
      INSERT INTO public.notifications (user_id, type, title, body, entity_id)
      VALUES (v_target_id, v_notif_type, v_title, v_body, v_entity_id);
    ELSE
      -- Unassigned — notify all admins
      INSERT INTO public.notifications (user_id, type, title, body, entity_id)
      SELECT
        u.id,
        v_notif_type,
        'Customer replied on ' || v_entity_id,
        COALESCE(v_author.name, 'Customer') || ' replied to an unassigned ticket.',
        v_entity_id
      FROM public.users u
      WHERE u.role = 'ADMIN'
        AND u.id <> NEW.author_id;
    END IF;
  ELSE
    -- Agent or Admin posted (public reply) → notify customer
    IF v_ticket.customer_id IS NOT NULL AND v_ticket.customer_id <> NEW.author_id THEN
      v_title := 'New reply on ' || v_entity_id;
      v_body  := COALESCE(v_author.name, 'Support') || ' replied: "'
                 || LEFT(NEW.content, 80) || CASE WHEN LENGTH(NEW.content) > 80 THEN '…' ELSE '' END || '"';
      INSERT INTO public.notifications (user_id, type, title, body, entity_id)
      VALUES (v_ticket.customer_id, v_notif_type, v_title, v_body, v_entity_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. ATTACH TRIGGERS
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_notify_on_ticket_change ON public.tickets;
CREATE TRIGGER trg_notify_on_ticket_change
  AFTER INSERT OR UPDATE OF status, assigned_agent_id, sla_breach ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION audit.fn_notify_on_ticket_change();

DROP TRIGGER IF EXISTS trg_notify_on_comment ON public.ticket_comments;
CREATE TRIGGER trg_notify_on_comment
  AFTER INSERT ON public.ticket_comments
  FOR EACH ROW
  EXECUTE FUNCTION audit.fn_notify_on_comment();

-- ---------------------------------------------------------------------------
-- 9. GRANTS ON TRIGGER FUNCTIONS
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION audit.fn_notify_on_ticket_change() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION audit.fn_notify_on_comment()       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION audit.format_ticket_entity_id(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 10. CONVENIENCE RPC: fn_mark_all_notifications_read
--     Called from the client to bulk-mark read for the current user.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.notifications
  SET is_read = true
  WHERE user_id = auth.uid()
    AND is_read = false;
$$;

REVOKE ALL ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
