-- ============================================
-- AI PROFESSIONAL NEWSLETTER PLATFORM
-- Complete Database Schema
-- ============================================
-- Created: 2025-10-13
-- Purpose: Initialize new Supabase database for multi-tenant AI newsletter platform
--
-- This schema includes:
-- 1. Base St. Cloud Scoop tables (campaigns, RSS, articles, etc.)
-- 2. Multi-tenant support (newsletters, newsletter_settings)
-- 3. AI Professional Newsletter features (ai_applications, prompt_ideas)
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SECTION 1: MULTI-TENANT CORE TABLES
-- ============================================

-- Newsletters registry
CREATE TABLE newsletters (
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

-- Newsletter-specific settings
CREATE TABLE newsletter_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  newsletter_id UUID NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  custom_default TEXT,
  description TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(newsletter_id, key)
);

CREATE INDEX idx_newsletter_settings_newsletter ON newsletter_settings(newsletter_id);
CREATE INDEX idx_newsletter_settings_key ON newsletter_settings(key);

-- ============================================
-- SECTION 2: CAMPAIGN MANAGEMENT
-- ============================================

-- Newsletter campaigns
CREATE TABLE newsletter_campaigns (
  id TEXT PRIMARY KEY,
  newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  subject_line TEXT,
  review_sent_at TIMESTAMPTZ,
  final_sent_at TIMESTAMPTZ,
  last_action TEXT,
  last_action_at TIMESTAMPTZ,
  last_action_by TEXT,
  status_before_send TEXT,
  metrics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaigns_newsletter ON newsletter_campaigns(newsletter_id);
CREATE INDEX idx_campaigns_date ON newsletter_campaigns(date);
CREATE INDEX idx_campaigns_status ON newsletter_campaigns(status);

-- ============================================
-- SECTION 3: RSS & CONTENT MANAGEMENT
-- ============================================

-- RSS Feeds
CREATE TABLE rss_feeds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  last_processed TIMESTAMPTZ,
  processing_errors INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rss_feeds_newsletter ON rss_feeds(newsletter_id);
CREATE INDEX idx_rss_feeds_active ON rss_feeds(active);

-- RSS Posts
CREATE TABLE rss_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feed_id UUID REFERENCES rss_feeds(id) ON DELETE CASCADE,
  campaign_id TEXT REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  author TEXT,
  publication_date TIMESTAMPTZ,
  source_url TEXT,
  image_url TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rss_posts_campaign ON rss_posts(campaign_id);
CREATE INDEX idx_rss_posts_feed ON rss_posts(feed_id);
CREATE INDEX idx_rss_posts_external ON rss_posts(external_id);

-- Post Ratings (AI scoring)
CREATE TABLE post_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES rss_posts(id) ON DELETE CASCADE,
  interest_level INT NOT NULL,
  local_relevance INT NOT NULL,
  community_impact INT NOT NULL,
  total_score INT NOT NULL,
  ai_reasoning TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_post_ratings_post ON post_ratings(post_id);
CREATE INDEX idx_post_ratings_score ON post_ratings(total_score);

-- Articles (processed content for newsletter)
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES rss_posts(id) ON DELETE CASCADE,
  campaign_id TEXT REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  headline TEXT NOT NULL,
  content TEXT NOT NULL,
  rank INT,
  is_active BOOLEAN DEFAULT false,
  skipped BOOLEAN DEFAULT false,
  fact_check_score DECIMAL,
  fact_check_details TEXT,
  word_count INT,
  review_position INT,
  final_position INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_articles_campaign ON articles(campaign_id);
CREATE INDEX idx_articles_post ON articles(post_id);
CREATE INDEX idx_articles_active ON articles(is_active);
CREATE INDEX idx_articles_rank ON articles(rank);

-- Manual Articles
CREATE TABLE manual_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id TEXT REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  source_url TEXT,
  rank INT,
  is_active BOOLEAN DEFAULT false,
  review_position INT,
  final_position INT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_manual_articles_campaign ON manual_articles(campaign_id);

-- ============================================
-- SECTION 4: AI APPLICATIONS (NEW)
-- ============================================

CREATE TABLE ai_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  newsletter_id UUID NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,

  -- Application Details
  app_name TEXT NOT NULL,
  tagline TEXT,
  description TEXT NOT NULL,
  category TEXT,

  -- Links & Images
  app_url TEXT NOT NULL,
  tracked_link TEXT,
  logo_url TEXT,
  screenshot_url TEXT,

  -- Metadata
  pricing TEXT,
  is_featured BOOLEAN DEFAULT false,
  is_paid_placement BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  -- Display & Rotation
  display_order INT,
  last_used_date DATE,
  times_used INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_apps_newsletter ON ai_applications(newsletter_id);
CREATE INDEX idx_ai_apps_active ON ai_applications(is_active);
CREATE INDEX idx_ai_apps_category ON ai_applications(category);

-- Campaign AI App Selections
CREATE TABLE campaign_ai_app_selections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id TEXT NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES ai_applications(id) ON DELETE CASCADE,
  selection_order INT NOT NULL,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(campaign_id, app_id),
  UNIQUE(campaign_id, selection_order)
);

CREATE INDEX idx_campaign_apps_campaign ON campaign_ai_app_selections(campaign_id);

-- ============================================
-- SECTION 5: PROMPT IDEAS (NEW)
-- ============================================

CREATE TABLE prompt_ideas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  newsletter_id UUID NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,

  -- Prompt Details
  title TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  category TEXT,
  use_case TEXT,

  -- AI Model Suggestions
  suggested_model TEXT,

  -- Metadata
  difficulty_level TEXT,
  estimated_time TEXT,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  -- Display & Rotation
  display_order INT,
  last_used_date DATE,
  times_used INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prompt_ideas_newsletter ON prompt_ideas(newsletter_id);
CREATE INDEX idx_prompt_ideas_active ON prompt_ideas(is_active);
CREATE INDEX idx_prompt_ideas_category ON prompt_ideas(category);

-- Campaign Prompt Selections
CREATE TABLE campaign_prompt_selections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id TEXT NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES prompt_ideas(id) ON DELETE CASCADE,
  selection_order INT NOT NULL,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(campaign_id, prompt_id),
  UNIQUE(campaign_id, selection_order)
);

CREATE INDEX idx_campaign_prompts_campaign ON campaign_prompt_selections(campaign_id);

-- ============================================
-- SECTION 6: ADVERTISEMENTS
-- ============================================

CREATE TABLE advertisements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  word_count INT,
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  business_address TEXT,
  business_website TEXT,
  image_url TEXT,
  frequency TEXT NOT NULL,
  times_paid INT DEFAULT 0,
  times_used INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_payment',
  display_order INT,
  paid BOOLEAN DEFAULT false,
  preferred_start_date DATE,
  actual_start_date DATE,
  last_used_date DATE,
  payment_intent_id TEXT,
  payment_amount DECIMAL,
  payment_status TEXT,
  submission_date TIMESTAMPTZ DEFAULT NOW(),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_advertisements_newsletter ON advertisements(newsletter_id);
CREATE INDEX idx_advertisements_status ON advertisements(status);

-- Campaign Advertisement Usage
CREATE TABLE campaign_advertisements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id TEXT REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  advertisement_id UUID REFERENCES advertisements(id) ON DELETE CASCADE,
  campaign_date DATE NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaign_ads_campaign ON campaign_advertisements(campaign_id);

-- Advertisement Pricing Tiers
CREATE TABLE ad_pricing_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  frequency TEXT NOT NULL,
  min_quantity INT NOT NULL,
  max_quantity INT,
  price_per_unit DECIMAL NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SECTION 7: EVENTS MANAGEMENT
-- ============================================

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_summary TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  venue TEXT,
  address TEXT,
  url TEXT,
  website TEXT,
  image_url TEXT,
  original_image_url TEXT,
  cropped_image_url TEXT,
  featured BOOLEAN DEFAULT false,
  paid_placement BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  submission_status TEXT DEFAULT 'approved',
  payment_status TEXT,
  payment_intent_id TEXT,
  payment_amount DECIMAL,
  submitter_name TEXT,
  submitter_email TEXT,
  submitter_phone TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_newsletter ON events(newsletter_id);
CREATE INDEX idx_events_start_date ON events(start_date);
CREATE INDEX idx_events_active ON events(active);

-- Campaign Event Selections
CREATE TABLE campaign_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id TEXT REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  is_selected BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  display_order INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaign_events_campaign ON campaign_events(campaign_id);
CREATE INDEX idx_campaign_events_event ON campaign_events(event_id);

-- Pending Event Submissions (for payment processing)
CREATE TABLE pending_event_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_session_id TEXT NOT NULL,
  events_data JSONB NOT NULL,
  submitter_email TEXT NOT NULL,
  submitter_name TEXT NOT NULL,
  total_amount DECIMAL NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ
);

-- Event Venues (for autocomplete)
CREATE TABLE event_venues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SECTION 8: NEWSLETTER SECTIONS
-- ============================================

CREATE TABLE newsletter_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_newsletter_sections_newsletter ON newsletter_sections(newsletter_id);
CREATE INDEX idx_newsletter_sections_order ON newsletter_sections(display_order);

-- ============================================
-- SECTION 9: USERS & AUTHENTICATION
-- ============================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'admin',
  last_login TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- SECTION 10: SYSTEM & LOGGING
-- ============================================

CREATE TABLE system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  source TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_system_logs_level ON system_logs(level);
CREATE INDEX idx_system_logs_timestamp ON system_logs(timestamp);

CREATE TABLE user_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  campaign_id TEXT REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_activities_campaign ON user_activities(campaign_id);
CREATE INDEX idx_user_activities_timestamp ON user_activities(timestamp);

-- ============================================
-- SECTION 11: GLOBAL APP SETTINGS
-- ============================================

CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_app_settings_key ON app_settings(key);

-- ============================================
-- SECTION 12: ANALYTICS & TRACKING
-- ============================================

CREATE TABLE email_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id TEXT REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  mailerlite_campaign_id TEXT,
  sent_count INT DEFAULT 0,
  delivered_count INT DEFAULT 0,
  opened_count INT DEFAULT 0,
  clicked_count INT DEFAULT 0,
  bounced_count INT DEFAULT 0,
  unsubscribed_count INT DEFAULT 0,
  open_rate DECIMAL,
  click_rate DECIMAL,
  bounce_rate DECIMAL,
  unsubscribe_rate DECIMAL,
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_metrics_campaign ON email_metrics(campaign_id);

CREATE TABLE link_clicks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_date DATE NOT NULL,
  campaign_id TEXT REFERENCES newsletter_campaigns(id) ON DELETE SET NULL,
  subscriber_email TEXT NOT NULL,
  subscriber_id TEXT,
  link_url TEXT NOT NULL,
  link_section TEXT NOT NULL,
  clicked_at TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_link_clicks_campaign ON link_clicks(campaign_id);
CREATE INDEX idx_link_clicks_date ON link_clicks(campaign_date);

-- ============================================
-- SECTION 13: ARCHIVED DATA
-- ============================================

CREATE TABLE archived_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_article_id UUID NOT NULL,
  post_id UUID,
  campaign_id TEXT,
  headline TEXT NOT NULL,
  content TEXT NOT NULL,
  rank INT,
  is_active BOOLEAN,
  skipped BOOLEAN,
  fact_check_score DECIMAL,
  fact_check_details TEXT,
  word_count INT,
  review_position INT,
  final_position INT,
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  archive_reason TEXT NOT NULL,
  campaign_date DATE,
  campaign_status TEXT,
  original_created_at TIMESTAMPTZ,
  original_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_archived_articles_campaign ON archived_articles(campaign_id);
CREATE INDEX idx_archived_articles_date ON archived_articles(campaign_date);

CREATE TABLE archived_rss_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_post_id UUID NOT NULL,
  feed_id UUID,
  campaign_id TEXT,
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
  archive_reason TEXT NOT NULL,
  campaign_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_archived_rss_posts_campaign ON archived_rss_posts(campaign_id);

-- ============================================
-- SECTION 14: SAMPLE DATA FOR TESTING
-- ============================================

-- Insert first newsletter: Accounting AI
INSERT INTO newsletters (slug, name, subdomain, description, primary_color) VALUES
('accounting', 'Accounting AI Daily', 'accounting', 'AI applications and prompts for accounting professionals', '#10B981');

-- Insert newsletter sections for Accounting
INSERT INTO newsletter_sections (newsletter_id, name, display_order, is_active)
SELECT id, 'Welcome', 1, true FROM newsletters WHERE slug = 'accounting'
UNION ALL
SELECT id, 'Advertisement', 2, true FROM newsletters WHERE slug = 'accounting'
UNION ALL
SELECT id, 'Top Articles', 3, true FROM newsletters WHERE slug = 'accounting'
UNION ALL
SELECT id, 'AI Applications', 4, true FROM newsletters WHERE slug = 'accounting'
UNION ALL
SELECT id, 'Bottom Articles', 5, true FROM newsletters WHERE slug = 'accounting'
UNION ALL
SELECT id, 'Prompt Ideas', 6, true FROM newsletters WHERE slug = 'accounting';

-- Insert sample AI applications for Accounting
INSERT INTO ai_applications (newsletter_id, app_name, tagline, description, category, app_url, pricing, is_active)
SELECT
  id,
  'QuickBooks AI Assistant',
  'Automate your bookkeeping with AI',
  'AI-powered accounting assistant that categorizes transactions, detects anomalies, and generates financial reports automatically.',
  'Automation',
  'https://quickbooks.intuit.com',
  'Freemium',
  true
FROM newsletters WHERE slug = 'accounting'
UNION ALL
SELECT
  id,
  'Dext Prepare',
  'Smart receipt and invoice capture',
  'Automatically extract data from receipts and invoices using AI OCR technology. Integrates with major accounting software.',
  'Data Entry',
  'https://dext.com/prepare',
  'Paid',
  true
FROM newsletters WHERE slug = 'accounting'
UNION ALL
SELECT
  id,
  'Xero Practice Manager',
  'AI-enhanced practice management',
  'Streamline client workflows with AI-powered task automation, time tracking, and client communication tools.',
  'Practice Management',
  'https://www.xero.com/us/accounting-software/practice-manager/',
  'Paid',
  true
FROM newsletters WHERE slug = 'accounting';

-- Insert sample prompt ideas for Accounting
INSERT INTO prompt_ideas (newsletter_id, title, prompt_text, category, use_case, suggested_model, difficulty_level)
SELECT
  id,
  'Analyze Monthly Cash Flow',
  'Review the following cash flow data from [Month]: [paste data]. Identify trends, potential issues, and provide 3 actionable recommendations to improve cash flow in the next quarter.',
  'Financial Analysis',
  'Use this when reviewing monthly financials with clients to quickly identify key insights.',
  'ChatGPT',
  'Beginner'
FROM newsletters WHERE slug = 'accounting'
UNION ALL
SELECT
  id,
  'Draft Tax Deadline Reminder Email',
  'Write a professional email to clients reminding them of the [Tax Deadline Date] deadline. Include: 1) Required documents, 2) Consequences of missing deadline, 3) How to schedule appointment. Tone: Professional but friendly.',
  'Client Communication',
  'Save time during tax season by generating personalized reminder emails.',
  'Claude',
  'Beginner'
FROM newsletters WHERE slug = 'accounting'
UNION ALL
SELECT
  id,
  'Explain Complex Tax Concept',
  'Explain [Tax Concept] in simple terms that a small business owner with no accounting background can understand. Use an analogy and provide a real-world example.',
  'Education',
  'Help clients understand complex tax concepts during consultations.',
  'ChatGPT',
  'Intermediate'
FROM newsletters WHERE slug = 'accounting';

-- ============================================
-- SECTION 15: HELPER FUNCTIONS
-- ============================================

-- Function to get newsletter by subdomain
CREATE OR REPLACE FUNCTION get_newsletter_by_subdomain(subdomain_input TEXT)
RETURNS newsletters AS $$
BEGIN
  RETURN (SELECT * FROM newsletters WHERE subdomain = subdomain_input AND is_active = true);
END;
$$ LANGUAGE plpgsql;

-- Function to get newsletter settings
CREATE OR REPLACE FUNCTION get_newsletter_setting(
  newsletter_id_input UUID,
  key_input TEXT
)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT value
    FROM newsletter_settings
    WHERE newsletter_id = newsletter_id_input
    AND key = key_input
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SCHEMA CREATION COMPLETE
-- ============================================
--
-- Next steps:
-- 1. Run this script in Supabase SQL Editor
-- 2. Verify all tables created successfully
-- 3. Check sample data inserted correctly
-- 4. Configure newsletter-specific settings via app
-- ============================================
