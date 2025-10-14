-- ============================================
-- FIX DUPLICATE_GROUPS TABLE TYPE MISMATCH
-- ============================================
-- This drops and recreates the duplicate_groups and duplicate_posts
-- tables with correct UUID types for campaign_id
-- ============================================

-- Step 1: Force drop existing tables (even if they have wrong types)
DROP TABLE IF EXISTS duplicate_posts CASCADE;
DROP TABLE IF EXISTS duplicate_groups CASCADE;

-- Step 2: Recreate with correct UUID types
CREATE TABLE duplicate_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  primary_post_id UUID NOT NULL REFERENCES rss_posts(id) ON DELETE CASCADE,
  topic_signature TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE duplicate_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES duplicate_groups(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES rss_posts(id) ON DELETE CASCADE,
  similarity_score NUMERIC NOT NULL
);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_duplicate_groups_campaign ON duplicate_groups(campaign_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_posts_group ON duplicate_posts(group_id);

-- ============================================
-- COMPLETE!
-- ============================================
-- The duplicate_groups and duplicate_posts tables now have
-- correct UUID types that match newsletter_campaigns.id
-- ============================================
