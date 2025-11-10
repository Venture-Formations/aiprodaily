-- Create the archived_post_ratings table to fix archiving system
-- This table stores ratings for archived RSS posts

CREATE TABLE IF NOT EXISTS archived_post_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archived_post_id UUID REFERENCES archived_rss_posts(id) ON DELETE CASCADE,
  interest_level INTEGER,
  local_relevance INTEGER,
  community_impact INTEGER,
  ai_reasoning TEXT,
  total_score NUMERIC,
  criteria_1_score INTEGER,
  criteria_1_reason TEXT,
  criteria_1_weight NUMERIC,
  criteria_2_score INTEGER,
  criteria_2_reason TEXT,
  criteria_2_weight NUMERIC,
  criteria_3_score INTEGER,
  criteria_3_reason TEXT,
  criteria_3_weight NUMERIC,
  criteria_4_score INTEGER,
  criteria_4_reason TEXT,
  criteria_4_weight NUMERIC,
  criteria_5_score INTEGER,
  criteria_5_reason TEXT,
  criteria_5_weight NUMERIC,
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_archived_post_ratings_post_id
  ON archived_post_ratings(archived_post_id);

COMMENT ON TABLE archived_post_ratings IS 'Archives of post ratings, preserving AI evaluation scores and reasoning';
COMMENT ON COLUMN archived_post_ratings.archived_post_id IS 'Reference to the archived RSS post';
COMMENT ON COLUMN archived_post_ratings.total_score IS 'Combined weighted score from all criteria';
