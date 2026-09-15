-- =============================================================================
-- Migration: 20240008_activity_logs_and_joins.sql
-- Description: Ensure public.activity_logs table & real-time replication
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  actor_name text NOT NULL,
  actor_role text NOT NULL,
  action text NOT NULL,
  entity_id uuid,
  entity_type text NOT NULL,
  old_value jsonb,
  new_value jsonb
);

-- Realtime Publication for activity_logs and audit_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_id ON public.activity_logs (entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.activity_logs (action);

-- RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read all activity logs" ON public.activity_logs;
CREATE POLICY "Admins can read all activity logs"
  ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()
        AND public.users.role = 'ADMIN'
    )
  );

-- Reload PostgREST Schema
NOTIFY pgrst, 'reload schema';
