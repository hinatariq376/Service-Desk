-- =============================================================================
-- Migration: 20240005_add_deleted_at_columns.sql
-- Description: Add deleted_at columns for soft-delete data retention and active query indexing
-- =============================================================================

-- Add soft-delete column to tickets
ALTER TABLE public.tickets 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add soft-delete column to ticket_comments
ALTER TABLE public.ticket_comments 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create performance indexes for non-deleted records
CREATE INDEX IF NOT EXISTS idx_tickets_active 
  ON public.tickets (customer_id, assigned_agent_id, status) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_deleted_at 
  ON public.tickets (deleted_at);

CREATE INDEX IF NOT EXISTS idx_ticket_comments_active 
  ON public.ticket_comments (ticket_id) 
  WHERE deleted_at IS NULL;
