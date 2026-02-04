-- Feedback Module System Migration
-- Creates feedback_modules (singleton), feedback_votes, and feedback_comments tables

-- ============================================
-- 1. Create feedback_modules table (SINGLETON per publication)
-- ============================================
CREATE TABLE IF NOT EXISTS feedback_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Feedback',
  display_order INTEGER DEFAULT 999,
  is_active BOOLEAN DEFAULT true,

  -- Block order configuration
  block_order JSONB DEFAULT '["title", "body", "vote_options", "sign_off", "team_photos"]'::jsonb,

  -- Content configuration
  title_text TEXT DEFAULT 'That''s it for today!',
  body_text TEXT,
  body_is_italic BOOLEAN DEFAULT false,
  sign_off_text TEXT DEFAULT 'See you tomorrow!',
  sign_off_is_italic BOOLEAN DEFAULT true,

  -- Vote options (configurable per publication)
  -- Format: [{value: 5, label: "Nailed it", emoji: "star"}, ...]
  vote_options JSONB DEFAULT '[
    {"value": 5, "label": "Nailed it", "emoji": "star"},
    {"value": 3, "label": "Average", "emoji": "star"},
    {"value": 1, "label": "Fail", "emoji": "star"}
  ]'::jsonb,

  -- Team photos configuration (array of {name, image_url, title?})
  team_photos JSONB DEFAULT '[]'::jsonb,

  -- General config for future extensibility
  config JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- SINGLETON CONSTRAINT: Only ONE feedback module per publication
  UNIQUE(publication_id)
);

-- Indexes for feedback_modules
CREATE INDEX IF NOT EXISTS idx_feedback_modules_publication ON feedback_modules(publication_id);
CREATE INDEX IF NOT EXISTS idx_feedback_modules_active ON feedback_modules(publication_id, is_active);

-- ============================================
-- 2. Create feedback_votes table
-- ============================================
CREATE TABLE IF NOT EXISTS feedback_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_module_id UUID NOT NULL REFERENCES feedback_modules(id) ON DELETE CASCADE,
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  issue_id TEXT,

  -- Voter identification
  subscriber_email TEXT NOT NULL,
  ip_address TEXT,

  -- Vote data
  selected_value INTEGER NOT NULL,
  selected_label TEXT NOT NULL,

  -- Timestamps
  voted_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one vote per subscriber per issue
  UNIQUE(feedback_module_id, subscriber_email, issue_id)
);

-- Indexes for feedback_votes
CREATE INDEX IF NOT EXISTS idx_feedback_votes_module ON feedback_votes(feedback_module_id);
CREATE INDEX IF NOT EXISTS idx_feedback_votes_publication ON feedback_votes(publication_id);
CREATE INDEX IF NOT EXISTS idx_feedback_votes_issue ON feedback_votes(issue_id);
CREATE INDEX IF NOT EXISTS idx_feedback_votes_email ON feedback_votes(subscriber_email);
CREATE INDEX IF NOT EXISTS idx_feedback_votes_voted_at ON feedback_votes(voted_at);

-- ============================================
-- 3. Create feedback_comments table
-- ============================================
CREATE TABLE IF NOT EXISTS feedback_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_vote_id UUID NOT NULL REFERENCES feedback_votes(id) ON DELETE CASCADE,
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  issue_id TEXT,

  subscriber_email TEXT NOT NULL,
  comment_text TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for feedback_comments
CREATE INDEX IF NOT EXISTS idx_feedback_comments_vote ON feedback_comments(feedback_vote_id);
CREATE INDEX IF NOT EXISTS idx_feedback_comments_publication ON feedback_comments(publication_id);
CREATE INDEX IF NOT EXISTS idx_feedback_comments_issue ON feedback_comments(issue_id);
CREATE INDEX IF NOT EXISTS idx_feedback_comments_created_at ON feedback_comments(created_at);

-- ============================================
-- 4. Updated_at trigger for feedback_modules
-- ============================================
CREATE OR REPLACE FUNCTION update_feedback_modules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_feedback_modules_updated_at ON feedback_modules;
CREATE TRIGGER set_feedback_modules_updated_at
  BEFORE UPDATE ON feedback_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_modules_updated_at();

-- ============================================
-- 5. Enable RLS on new tables
-- ============================================
ALTER TABLE feedback_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for feedback_modules (service role full access)
DROP POLICY IF EXISTS feedback_modules_service_role ON feedback_modules;
CREATE POLICY feedback_modules_service_role ON feedback_modules
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS policies for feedback_votes (service role full access)
DROP POLICY IF EXISTS feedback_votes_service_role ON feedback_votes;
CREATE POLICY feedback_votes_service_role ON feedback_votes
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS policies for feedback_comments (service role full access)
DROP POLICY IF EXISTS feedback_comments_service_role ON feedback_comments;
CREATE POLICY feedback_comments_service_role ON feedback_comments
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Summary
-- ============================================
-- Created:
--   - feedback_modules table (singleton per publication - configurable feedback section)
--   - feedback_votes table (issue-specific voting with email/IP tracking)
--   - feedback_comments table (additional text feedback linked to votes)
--   - Indexes for efficient queries
--   - Updated_at trigger for feedback_modules
--   - RLS policies for service role access
