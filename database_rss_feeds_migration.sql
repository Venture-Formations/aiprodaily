-- ============================================
-- RSS FEEDS TABLE MIGRATION FOR BREAKING NEWS
-- ============================================
-- Created: 2025-10-13
-- Purpose: Extend existing rss_feeds table for Breaking News and Beyond the Feed sections

-- ============================================
-- 1. ADD MISSING COLUMNS TO rss_feeds TABLE
-- ============================================

-- Add newsletter_id for multi-tenant support
ALTER TABLE rss_feeds ADD COLUMN IF NOT EXISTS newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE;

-- Add description field
ALTER TABLE rss_feeds ADD COLUMN IF NOT EXISTS description TEXT;

-- Add last_error tracking
ALTER TABLE rss_feeds ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Create index on newsletter_id
CREATE INDEX IF NOT EXISTS idx_rss_feeds_newsletter ON rss_feeds(newsletter_id);

-- ============================================
-- 2. EXTEND rss_posts TABLE FOR BREAKING NEWS
-- ============================================

-- Add Breaking News scoring and categorization columns to rss_posts
ALTER TABLE rss_posts ADD COLUMN IF NOT EXISTS breaking_news_score INT;
ALTER TABLE rss_posts ADD COLUMN IF NOT EXISTS breaking_news_category TEXT; -- 'breaking' or 'beyond_feed'
ALTER TABLE rss_posts ADD COLUMN IF NOT EXISTS ai_summary TEXT; -- ChatGPT-generated summary
ALTER TABLE rss_posts ADD COLUMN IF NOT EXISTS ai_title TEXT; -- ChatGPT-generated title

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rss_posts_breaking_score ON rss_posts(breaking_news_score DESC);
CREATE INDEX IF NOT EXISTS idx_rss_posts_breaking_category ON rss_posts(breaking_news_category);

-- ============================================
-- 3. EXTEND articles TABLE FOR BREAKING NEWS
-- ============================================

-- Add Breaking News scoring and categorization columns to articles
ALTER TABLE articles ADD COLUMN IF NOT EXISTS breaking_news_score INT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS breaking_news_category TEXT; -- 'breaking' or 'beyond_feed'
ALTER TABLE articles ADD COLUMN IF NOT EXISTS ai_summary TEXT; -- ChatGPT-generated summary
ALTER TABLE articles ADD COLUMN IF NOT EXISTS ai_title TEXT; -- ChatGPT-generated title

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_articles_breaking_score ON articles(breaking_news_score DESC);
CREATE INDEX IF NOT EXISTS idx_articles_breaking_category ON articles(breaking_news_category);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON COLUMN rss_feeds.newsletter_id IS 'Links feed to specific newsletter for multi-tenant support';
COMMENT ON COLUMN rss_feeds.description IS 'Description of the RSS feed source';
COMMENT ON COLUMN rss_feeds.last_error IS 'Last error message if processing failed';

COMMENT ON COLUMN articles.breaking_news_score IS 'AI relevance/importance score (0-100) for Breaking News section';
COMMENT ON COLUMN articles.breaking_news_category IS 'Category: breaking (top 3) or beyond_feed (next 3)';
COMMENT ON COLUMN articles.ai_summary IS 'ChatGPT-generated 2-3 sentence summary for newsletter';
COMMENT ON COLUMN articles.ai_title IS 'ChatGPT-generated title for newsletter display';
