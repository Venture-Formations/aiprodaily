-- Secondary Articles Implementation
-- This migration adds support for a second article section with independent RSS feed selection

-- 1. Add RSS feed section assignments to rss_feeds table
ALTER TABLE rss_feeds
ADD COLUMN IF NOT EXISTS use_for_primary_section BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS use_for_secondary_section BOOLEAN DEFAULT false;

-- 2. Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 3. Create secondary_articles table (mirrors articles structure)
-- Note: post_id is UUID (references rss_posts.id which is UUID)
-- Note: campaign_id is TEXT (references newsletter_campaigns.id which is TEXT)
CREATE TABLE IF NOT EXISTS secondary_articles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  post_id UUID NOT NULL REFERENCES rss_posts(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  headline TEXT NOT NULL,
  content TEXT NOT NULL,
  rank INTEGER,
  is_active BOOLEAN DEFAULT false,
  skipped BOOLEAN DEFAULT false,
  fact_check_score NUMERIC,
  fact_check_details TEXT,
  word_count INTEGER,
  review_position INTEGER,
  final_position INTEGER,
  breaking_news_score NUMERIC,
  breaking_news_category TEXT,
  ai_summary TEXT,
  ai_title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create archived_secondary_articles table (for archiving)
CREATE TABLE IF NOT EXISTS archived_secondary_articles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  original_article_id TEXT NOT NULL,
  post_id UUID,
  campaign_id TEXT NOT NULL,
  headline TEXT NOT NULL,
  content TEXT NOT NULL,
  rank INTEGER,
  is_active BOOLEAN,
  skipped BOOLEAN,
  fact_check_score NUMERIC,
  fact_check_details TEXT,
  word_count INTEGER,
  review_position INTEGER,
  final_position INTEGER,
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  archive_reason TEXT NOT NULL,
  campaign_date DATE,
  campaign_status TEXT,
  original_created_at TIMESTAMPTZ,
  original_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_secondary_articles_campaign ON secondary_articles(campaign_id);
CREATE INDEX IF NOT EXISTS idx_secondary_articles_post ON secondary_articles(post_id);
CREATE INDEX IF NOT EXISTS idx_secondary_articles_active ON secondary_articles(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_archived_secondary_articles_campaign ON archived_secondary_articles(campaign_id);

-- 6. Add trigger for updated_at timestamp
DROP TRIGGER IF EXISTS update_secondary_articles_updated_at ON secondary_articles;
CREATE TRIGGER update_secondary_articles_updated_at
BEFORE UPDATE ON secondary_articles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 7. Update app_settings with new AI prompts for secondary articles
-- These will be populated via the UI, but we'll add default structure

-- Note: Run this migration in Supabase SQL Editor
-- Then use the debug endpoint to verify columns were added correctly
