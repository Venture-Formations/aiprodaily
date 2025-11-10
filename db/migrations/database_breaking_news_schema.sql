-- ============================================
-- BREAKING NEWS RSS FEEDS SCHEMA
-- ============================================
-- Created: 2025-10-13
-- Purpose: Separate RSS feed system for Breaking News and Beyond the Feed sections

-- ============================================
-- 1. BREAKING NEWS RSS FEEDS TABLE
-- ============================================

CREATE TABLE breaking_news_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_id UUID NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,

  -- Feed Details
  feed_url TEXT NOT NULL,
  feed_name TEXT NOT NULL,
  description TEXT, -- Optional description of the feed source

  -- Status & Processing
  is_active BOOLEAN DEFAULT true,
  last_processed TIMESTAMPTZ,
  last_error TEXT, -- Store last error message
  processing_errors INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_breaking_news_feeds_newsletter ON breaking_news_feeds(newsletter_id);
CREATE INDEX idx_breaking_news_feeds_active ON breaking_news_feeds(is_active);
CREATE INDEX idx_breaking_news_feeds_last_processed ON breaking_news_feeds(last_processed);

-- ============================================
-- 2. BREAKING NEWS ARTICLES TABLE
-- ============================================
-- This extends the existing articles table with breaking news scoring

-- Add columns to existing articles table
ALTER TABLE articles ADD COLUMN IF NOT EXISTS breaking_news_score INT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS breaking_news_category TEXT; -- 'breaking' or 'beyond_feed'
ALTER TABLE articles ADD COLUMN IF NOT EXISTS ai_summary TEXT; -- ChatGPT-generated summary
ALTER TABLE articles ADD COLUMN IF NOT EXISTS ai_title TEXT; -- ChatGPT-generated title

CREATE INDEX IF NOT EXISTS idx_articles_breaking_score ON articles(breaking_news_score DESC);
CREATE INDEX IF NOT EXISTS idx_articles_breaking_category ON articles(breaking_news_category);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE breaking_news_feeds IS 'RSS feeds for Breaking News and Beyond the Feed sections';
COMMENT ON COLUMN breaking_news_feeds.feed_url IS 'RSS feed URL to fetch articles from';
COMMENT ON COLUMN breaking_news_feeds.feed_name IS 'Human-readable name for the feed';
COMMENT ON COLUMN breaking_news_feeds.description IS 'Description of the feed source';
COMMENT ON COLUMN breaking_news_feeds.is_active IS 'Whether this feed should be processed';
COMMENT ON COLUMN breaking_news_feeds.last_processed IS 'Last time this feed was successfully processed';
COMMENT ON COLUMN breaking_news_feeds.last_error IS 'Last error message if processing failed';
COMMENT ON COLUMN breaking_news_feeds.processing_errors IS 'Count of consecutive processing errors';

COMMENT ON COLUMN articles.breaking_news_score IS 'AI relevance/importance score (0-100) for Breaking News section';
COMMENT ON COLUMN articles.breaking_news_category IS 'Category: breaking (top 3) or beyond_feed (next 3)';
COMMENT ON COLUMN articles.ai_summary IS 'ChatGPT-generated 2-3 sentence summary for newsletter';
COMMENT ON COLUMN articles.ai_title IS 'ChatGPT-generated title for newsletter display';
