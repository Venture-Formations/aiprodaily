-- ============================================
-- DEDUPLICATION SYSTEM TABLES
-- ============================================
-- This migration creates the complete deduplication system
-- with enhanced metadata tracking for the 3-stage deduplication
--
-- IMPORTANT: Mixed types to match your actual schema:
-- - newsletter_campaigns.id = TEXT
-- - rss_posts.id = UUID

-- Create duplicate_groups table
CREATE TABLE IF NOT EXISTS duplicate_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  primary_post_id UUID NOT NULL REFERENCES rss_posts(id) ON DELETE CASCADE,
  topic_signature TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create duplicate_posts table with new metadata fields
CREATE TABLE IF NOT EXISTS duplicate_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES duplicate_groups(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES rss_posts(id) ON DELETE CASCADE,
  similarity_score NUMERIC DEFAULT 0.8,
  detection_method VARCHAR(50),
  actual_similarity_score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint: detection_method must be one of the valid methods
  CONSTRAINT check_detection_method
    CHECK (detection_method IN ('content_hash', 'title_similarity', 'ai_semantic'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_duplicate_groups_campaign_id
  ON duplicate_groups(campaign_id);

CREATE INDEX IF NOT EXISTS idx_duplicate_groups_primary_post_id
  ON duplicate_groups(primary_post_id);

CREATE INDEX IF NOT EXISTS idx_duplicate_posts_group_id
  ON duplicate_posts(group_id);

CREATE INDEX IF NOT EXISTS idx_duplicate_posts_post_id
  ON duplicate_posts(post_id);

-- Add comments for documentation
COMMENT ON TABLE duplicate_groups IS 'Groups of duplicate posts, each group has one primary post and multiple duplicates';
COMMENT ON TABLE duplicate_posts IS 'Individual posts that have been identified as duplicates';
COMMENT ON COLUMN duplicate_posts.detection_method IS 'Method used to detect duplicate: content_hash (exact match), title_similarity (Jaccard >80%), or ai_semantic (OpenAI)';
COMMENT ON COLUMN duplicate_posts.actual_similarity_score IS 'Actual calculated similarity score (0.0-1.0), may differ from legacy similarity_score field';
COMMENT ON COLUMN duplicate_posts.similarity_score IS 'Legacy similarity score field, now defaults to 0.8 for backward compatibility';
