-- Migration: Add Real Click Tracking
-- Purpose: Track which subscribers have real (non-bot) clicks to sync Real_Click field to MailerLite
-- Date: 2026-02-02

-- Table to track the current Real_Click state for each subscriber
-- This allows us to only update MailerLite when state actually changes
CREATE TABLE IF NOT EXISTS subscriber_real_click_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  subscriber_email TEXT NOT NULL,
  has_real_click BOOLEAN NOT NULL DEFAULT false,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint per publication + email
  UNIQUE(publication_id, subscriber_email)
);

-- Index for efficient lookups
CREATE INDEX idx_real_click_status_publication ON subscriber_real_click_status(publication_id);
CREATE INDEX idx_real_click_status_email ON subscriber_real_click_status(subscriber_email);
CREATE INDEX idx_real_click_status_has_click ON subscriber_real_click_status(publication_id, has_real_click);

-- Enable RLS
ALTER TABLE subscriber_real_click_status ENABLE ROW LEVEL SECURITY;

-- RLS policy for service role access
CREATE POLICY "Service role can manage subscriber_real_click_status"
  ON subscriber_real_click_status
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE subscriber_real_click_status IS 'Tracks Real_Click field state to sync with MailerLite only when changes occur';
COMMENT ON COLUMN subscriber_real_click_status.has_real_click IS 'Current state: true if subscriber has any valid (non-excluded IP) clicks';
COMMENT ON COLUMN subscriber_real_click_status.last_synced_at IS 'When this state was last synced to MailerLite';
