-- ============================================
-- DATABASE CLEANUP SCRIPT
-- ============================================
-- Use this to remove existing tables with incorrect types
-- Run this BEFORE running database_complete_schema.sql
-- ============================================

-- WARNING: This will delete all existing data!
-- Only run this if you're starting fresh.

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS campaign_prompt_selections CASCADE;
DROP TABLE IF EXISTS campaign_ai_app_selections CASCADE;
DROP TABLE IF EXISTS prompt_ideas CASCADE;
DROP TABLE IF EXISTS ai_applications CASCADE;

DROP TABLE IF EXISTS poll_responses CASCADE;
DROP TABLE IF EXISTS polls CASCADE;

DROP TABLE IF EXISTS system_logs CASCADE;
DROP TABLE IF EXISTS app_settings CASCADE;

DROP TABLE IF EXISTS newsletter_sections CASCADE;

DROP TABLE IF EXISTS link_clicks CASCADE;
DROP TABLE IF EXISTS article_performance CASCADE;
DROP TABLE IF EXISTS email_metrics CASCADE;

DROP TABLE IF EXISTS user_activities CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TABLE IF EXISTS duplicate_posts CASCADE;
DROP TABLE IF EXISTS duplicate_groups CASCADE;

DROP TABLE IF EXISTS archived_post_ratings CASCADE;
DROP TABLE IF EXISTS archived_rss_posts CASCADE;
DROP TABLE IF EXISTS archived_articles CASCADE;

DROP TABLE IF EXISTS manual_articles CASCADE;
DROP TABLE IF EXISTS articles CASCADE;
DROP TABLE IF EXISTS post_ratings CASCADE;
DROP TABLE IF EXISTS rss_posts CASCADE;
DROP TABLE IF EXISTS rss_feeds CASCADE;

DROP TABLE IF EXISTS newsletter_campaigns CASCADE;
DROP TABLE IF EXISTS newsletter_settings CASCADE;
DROP TABLE IF EXISTS newsletters CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- ============================================
-- CLEANUP COMPLETE
-- ============================================
-- Now run database_complete_schema.sql to recreate all tables
-- ============================================
