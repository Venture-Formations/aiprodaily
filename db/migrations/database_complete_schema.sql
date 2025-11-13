-- ============================================
-- AI PROFESSIONAL NEWSLETTER PLATFORM
-- Complete Database Schema
-- ============================================
-- Multi-tenant newsletter platform supporting multiple industries
-- (Accounting, Legal, Real Estate, etc.)
--
-- Run this in Supabase SQL Editor to set up the database
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CORE MULTI-TENANT TABLES
-- ============================================

-- Newsletters (each professional industry gets its own newsletter)
CREATE TABLE IF NOT EXISTS newsletters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Newsletter Settings (per-newsletter configuration)
CREATE TABLE IF NOT EXISTS newsletter_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  newsletter_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  custom_default TEXT,
  description TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(newsletter_id, key)
);

-- ============================================
-- CAMPAIGN & CONTENT MANAGEMENT
-- ============================================

-- Newsletter Campaigns
CREATE TABLE IF NOT EXISTS newsletter_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  newsletter_id UUID REFERENCES publications(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'changes_made', 'ready_to_send', 'sent', 'failed')),
  subject_line TEXT,
  review_sent_at TIMESTAMPTZ,
  final_sent_at TIMESTAMPTZ,
  last_action TEXT CHECK (last_action IN ('changes_made', 'approved')),
  last_action_at TIMESTAMPTZ,
  last_action_by TEXT,
  status_before_send TEXT,
  metrics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RSS Feeds
CREATE TABLE IF NOT EXISTS rss_feeds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  newsletter_id UUID REFERENCES publications(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  last_processed TIMESTAMPTZ,
  last_error TEXT,
  processing_errors INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RSS Posts
CREATE TABLE IF NOT EXISTS rss_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feed_id UUID NOT NULL REFERENCES rss_feeds(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  author TEXT,
  publication_date TIMESTAMPTZ,
  source_url TEXT,
  image_url TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  breaking_news_score NUMERIC,
  breaking_news_category TEXT,
  ai_summary TEXT,
  ai_title TEXT,
  UNIQUE(feed_id, external_id)
);

-- Post Ratings (AI scoring)
CREATE TABLE IF NOT EXISTS post_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES rss_posts(id) ON DELETE CASCADE,
  interest_level INTEGER NOT NULL CHECK (interest_level BETWEEN 0 AND 10),
  local_relevance INTEGER NOT NULL CHECK (local_relevance BETWEEN 0 AND 10),
  community_impact INTEGER NOT NULL CHECK (community_impact BETWEEN 0 AND 10),
  total_score INTEGER NOT NULL,
  ai_reasoning TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Articles (AI-generated from RSS posts)
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES rss_posts(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
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

-- Manual Articles (user-created content)
CREATE TABLE IF NOT EXISTS manual_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  source_url TEXT,
  rank INTEGER,
  is_active BOOLEAN DEFAULT true,
  review_position INTEGER,
  final_position INTEGER,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ARCHIVAL TABLES
-- ============================================

-- Archived Articles
CREATE TABLE IF NOT EXISTS archived_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_article_id UUID NOT NULL,
  post_id UUID,
  campaign_id UUID NOT NULL,
  headline TEXT NOT NULL,
  content TEXT NOT NULL,
  rank INTEGER,
  is_active BOOLEAN,
  skipped BOOLEAN DEFAULT false,
  fact_check_score NUMERIC,
  fact_check_details TEXT,
  word_count INTEGER,
  review_position INTEGER,
  final_position INTEGER,
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  archive_reason TEXT,
  campaign_date DATE,
  campaign_status TEXT,
  original_created_at TIMESTAMPTZ,
  original_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Archived RSS Posts
CREATE TABLE IF NOT EXISTS archived_rss_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_post_id UUID NOT NULL,
  feed_id UUID NOT NULL,
  campaign_id UUID NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  author TEXT,
  publication_date TIMESTAMPTZ,
  source_url TEXT,
  image_url TEXT,
  processed_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  archive_reason TEXT,
  campaign_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Archived Post Ratings
CREATE TABLE IF NOT EXISTS archived_post_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_rating_id UUID NOT NULL,
  archived_post_id UUID NOT NULL REFERENCES archived_rss_posts(id) ON DELETE CASCADE,
  interest_level INTEGER NOT NULL,
  local_relevance INTEGER NOT NULL,
  community_impact INTEGER NOT NULL,
  total_score INTEGER NOT NULL,
  ai_reasoning TEXT,
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  original_created_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DUPLICATE DETECTION
-- ============================================

-- Duplicate Groups
CREATE TABLE IF NOT EXISTS duplicate_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  primary_post_id UUID NOT NULL REFERENCES rss_posts(id) ON DELETE CASCADE,
  topic_signature TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Duplicate Posts
CREATE TABLE IF NOT EXISTS duplicate_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES duplicate_groups(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES rss_posts(id) ON DELETE CASCADE,
  similarity_score NUMERIC NOT NULL
);

-- ============================================
-- USER MANAGEMENT
-- ============================================

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'reviewer')),
  last_login TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Activities (audit trail)
CREATE TABLE IF NOT EXISTS user_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ANALYTICS & METRICS
-- ============================================

-- Email Metrics
CREATE TABLE IF NOT EXISTS email_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  mailerlite_campaign_id TEXT,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,
  unsubscribed_count INTEGER DEFAULT 0,
  open_rate NUMERIC,
  click_rate NUMERIC,
  bounce_rate NUMERIC,
  unsubscribe_rate NUMERIC,
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

-- Article Performance
CREATE TABLE IF NOT EXISTS article_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  click_count INTEGER DEFAULT 0,
  engagement_score NUMERIC,
  feedback_positive INTEGER DEFAULT 0,
  feedback_negative INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link Clicks (tracking)
CREATE TABLE IF NOT EXISTS link_clicks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_date DATE NOT NULL,
  campaign_id UUID REFERENCES newsletter_campaigns(id) ON DELETE SET NULL,
  subscriber_email TEXT NOT NULL,
  subscriber_id TEXT,
  link_url TEXT NOT NULL,
  link_section TEXT NOT NULL,
  clicked_at TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback Responses (section preference tracking)
CREATE TABLE IF NOT EXISTS feedback_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_date DATE NOT NULL,
  subscriber_email TEXT NOT NULL,
  section_choice TEXT NOT NULL,
  mailerlite_updated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_date, subscriber_email)
);

-- ============================================
-- NEWSLETTER SECTIONS & STRUCTURE
-- ============================================

-- Newsletter Sections (per-newsletter content structure)
CREATE TABLE IF NOT EXISTS newsletter_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  newsletter_id UUID REFERENCES publications(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GLOBAL APP SETTINGS
-- ============================================

-- App Settings (global system settings)
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  custom_default TEXT,
  description TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- System Logs
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error', 'debug')),
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  source TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- POLLS & ENGAGEMENT
-- ============================================

-- Polls
CREATE TABLE IF NOT EXISTS polls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  question TEXT NOT NULL,
  options TEXT[] NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Poll Responses
CREATE TABLE IF NOT EXISTS poll_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES newsletter_campaigns(id) ON DELETE SET NULL,
  subscriber_email TEXT NOT NULL,
  selected_option TEXT NOT NULL,
  responded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Campaign indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_date ON newsletter_campaigns(date);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON newsletter_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_newsletter ON newsletter_campaigns(newsletter_id);

-- RSS indexes
CREATE INDEX IF NOT EXISTS idx_rss_posts_campaign ON rss_posts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_rss_posts_feed ON rss_posts(feed_id);

-- Article indexes
CREATE INDEX IF NOT EXISTS idx_articles_campaign ON articles(campaign_id);
CREATE INDEX IF NOT EXISTS idx_articles_active ON articles(is_active);
CREATE INDEX IF NOT EXISTS idx_articles_post ON articles(post_id);

-- Rating indexes
CREATE INDEX IF NOT EXISTS idx_post_ratings_post ON post_ratings(post_id);

-- User activity indexes
CREATE INDEX IF NOT EXISTS idx_user_activities_campaign ON user_activities(campaign_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_user ON user_activities(user_id);

-- Link click indexes
CREATE INDEX IF NOT EXISTS idx_link_clicks_campaign_date ON link_clicks(campaign_date);
CREATE INDEX IF NOT EXISTS idx_link_clicks_email ON link_clicks(subscriber_email);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to relevant tables
CREATE TRIGGER update_newsletters_updated_at BEFORE UPDATE ON newsletters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_newsletter_settings_updated_at BEFORE UPDATE ON newsletter_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON newsletter_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_manual_articles_updated_at BEFORE UPDATE ON manual_articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_polls_updated_at BEFORE UPDATE ON polls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL DATA (Optional)
-- ============================================

-- Note: Newsletter sections will be created per-newsletter in the AI features schema
-- Each newsletter (accounting, legal, etc.) will have its own customized sections

-- ============================================
-- COMPLETION MESSAGE
-- ============================================
-- Schema created successfully!
-- Next steps:
-- 1. Run the AI features schema: database_ai_features_schema.sql
-- 2. Run the breaking news schema: database_breaking_news_schema.sql
-- 3. Run the RSS feeds migration: database_rss_feeds_migration.sql
-- ============================================
