-- Article Archive Migration
-- This creates tables to preserve articles and posts before RSS processing clears them
-- Run this in Supabase SQL Editor

-- Create archived_articles table (copy of articles structure with archive metadata)
CREATE TABLE IF NOT EXISTS archived_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Original article data
  original_article_id uuid NOT NULL, -- Reference to original article ID
  post_id uuid,
  campaign_id uuid NOT NULL,
  headline text NOT NULL,
  content text NOT NULL,
  rank integer,
  is_active boolean NOT NULL DEFAULT false,
  fact_check_score integer,
  fact_check_details text,
  word_count integer,
  review_position integer, -- IMPORTANT: Preserves position data
  final_position integer,   -- IMPORTANT: Preserves position data

  -- Archive metadata
  archived_at timestamp with time zone DEFAULT now() NOT NULL,
  archive_reason text DEFAULT 'rss_processing_clear' NOT NULL,
  campaign_date date, -- Denormalized for easier querying
  campaign_status text, -- Campaign status at time of archiving

  -- Original timestamps
  original_created_at timestamp with time zone NOT NULL,
  original_updated_at timestamp with time zone NOT NULL,

  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create archived_rss_posts table (copy of rss_posts structure with archive metadata)
CREATE TABLE IF NOT EXISTS archived_rss_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Original post data
  original_post_id uuid NOT NULL, -- Reference to original post ID
  feed_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  external_id text NOT NULL,
  title text NOT NULL,
  description text,
  content text,
  author text,
  publication_date timestamp with time zone,
  source_url text,
  image_url text,
  processed_at timestamp with time zone NOT NULL,

  -- Archive metadata
  archived_at timestamp with time zone DEFAULT now() NOT NULL,
  archive_reason text DEFAULT 'rss_processing_clear' NOT NULL,
  campaign_date date, -- Denormalized for easier querying

  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create archived_post_ratings table (copy of post ratings)
CREATE TABLE IF NOT EXISTS archived_post_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Original rating data
  original_rating_id uuid NOT NULL,
  archived_post_id uuid NOT NULL REFERENCES archived_rss_posts(id) ON DELETE CASCADE,
  interest_level integer NOT NULL,
  local_relevance integer NOT NULL,
  community_impact integer NOT NULL,
  total_score integer NOT NULL,
  ai_reasoning text,

  -- Archive metadata
  archived_at timestamp with time zone DEFAULT now() NOT NULL,

  -- Original timestamp
  original_created_at timestamp with time zone NOT NULL,

  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_archived_articles_campaign_id ON archived_articles(campaign_id);
CREATE INDEX IF NOT EXISTS idx_archived_articles_archived_at ON archived_articles(archived_at);
CREATE INDEX IF NOT EXISTS idx_archived_articles_campaign_date ON archived_articles(campaign_date);
CREATE INDEX IF NOT EXISTS idx_archived_articles_review_position ON archived_articles(review_position);
CREATE INDEX IF NOT EXISTS idx_archived_articles_final_position ON archived_articles(final_position);

CREATE INDEX IF NOT EXISTS idx_archived_rss_posts_campaign_id ON archived_rss_posts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_archived_rss_posts_archived_at ON archived_rss_posts(archived_at);
CREATE INDEX IF NOT EXISTS idx_archived_rss_posts_campaign_date ON archived_rss_posts(campaign_date);

CREATE INDEX IF NOT EXISTS idx_archived_post_ratings_archived_post_id ON archived_post_ratings(archived_post_id);

-- Add comments for documentation
COMMENT ON TABLE archived_articles IS 'Archive of articles before RSS processing clears them - preserves position data and historical content';
COMMENT ON COLUMN archived_articles.review_position IS 'Position (1-5) when sent for review - preserved from original article';
COMMENT ON COLUMN archived_articles.final_position IS 'Position (1-5) when finally sent - preserved from original article';
COMMENT ON COLUMN archived_articles.archive_reason IS 'Why this article was archived (e.g., rss_processing_clear, manual_archive)';

COMMENT ON TABLE archived_rss_posts IS 'Archive of RSS posts before RSS processing clears them';
COMMENT ON TABLE archived_post_ratings IS 'Archive of post ratings linked to archived posts';