-- Create Poll Tables with Multi-Tenant Support
-- Migration: create_polls_tables.sql
-- Date: 2025-11-17
-- Description: Creates polls and poll_responses tables with publication_id for multi-tenant isolation

-- ============================================
-- POLLS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS polls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  question TEXT NOT NULL,
  options TEXT[] NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- POLL RESPONSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS poll_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  issue_id TEXT REFERENCES publication_issues(id) ON DELETE SET NULL,
  subscriber_email TEXT NOT NULL,
  selected_option TEXT NOT NULL,
  responded_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure one response per subscriber per poll
  UNIQUE(poll_id, subscriber_email)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Poll indexes
CREATE INDEX IF NOT EXISTS idx_polls_publication ON polls(publication_id);
CREATE INDEX IF NOT EXISTS idx_polls_active ON polls(is_active);
CREATE INDEX IF NOT EXISTS idx_polls_publication_active ON polls(publication_id, is_active);

-- Poll response indexes
CREATE INDEX IF NOT EXISTS idx_poll_responses_poll ON poll_responses(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_responses_publication ON poll_responses(publication_id);
CREATE INDEX IF NOT EXISTS idx_poll_responses_issue ON poll_responses(issue_id);
CREATE INDEX IF NOT EXISTS idx_poll_responses_email ON poll_responses(subscriber_email);

-- ============================================
-- TRIGGER FOR UPDATED_AT
-- ============================================

-- Ensure the update function exists (may already exist from other migrations)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to polls table
DROP TRIGGER IF EXISTS update_polls_updated_at ON polls;
CREATE TRIGGER update_polls_updated_at
  BEFORE UPDATE ON polls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE polls IS 'Newsletter polls for subscriber engagement, scoped by publication';
COMMENT ON COLUMN polls.publication_id IS 'Multi-tenant isolation key - each publication has its own polls';
COMMENT ON COLUMN polls.is_active IS 'Only one poll should be active per publication at a time';
COMMENT ON COLUMN polls.options IS 'Array of poll option strings';

COMMENT ON TABLE poll_responses IS 'Subscriber responses to polls, with deduplication';
COMMENT ON COLUMN poll_responses.publication_id IS 'Denormalized for query efficiency - matches poll.publication_id';
COMMENT ON COLUMN poll_responses.issue_id IS 'Links response to specific newsletter issue (campaign)';
COMMENT ON CONSTRAINT poll_responses_poll_id_subscriber_email_key ON poll_responses IS 'Ensures one vote per subscriber per poll';
