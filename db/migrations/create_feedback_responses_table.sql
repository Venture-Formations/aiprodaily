-- Migration: Create Feedback Responses Table
-- Purpose: Track section preference feedback from newsletter subscribers
-- Date: 2026-02-02

-- Feedback Responses (section preference tracking)
CREATE TABLE IF NOT EXISTS feedback_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_date DATE NOT NULL,
  issue_id UUID REFERENCES publication_issues(id) ON DELETE SET NULL,
  publication_id UUID REFERENCES publications(id) ON DELETE CASCADE,
  subscriber_email TEXT NOT NULL,
  section_choice TEXT NOT NULL,
  mailerlite_updated BOOLEAN DEFAULT false,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_date, subscriber_email)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_feedback_responses_date ON feedback_responses(campaign_date);
CREATE INDEX IF NOT EXISTS idx_feedback_responses_publication ON feedback_responses(publication_id);
CREATE INDEX IF NOT EXISTS idx_feedback_responses_email ON feedback_responses(subscriber_email);

-- Enable RLS
ALTER TABLE feedback_responses ENABLE ROW LEVEL SECURITY;

-- RLS policy for service role access
CREATE POLICY "Service role can manage feedback_responses"
  ON feedback_responses
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE feedback_responses IS 'Tracks subscriber section preference feedback from newsletters';
