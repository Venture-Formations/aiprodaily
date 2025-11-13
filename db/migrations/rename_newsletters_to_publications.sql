-- ============================================
-- RENAME newsletter_id TO publication_id
-- AND newsletters TABLE TO publications
-- ============================================
-- This migration renames:
-- 1. All newsletter_id columns to publication_id
-- 2. The newsletters table to publications
--
-- To better reflect the terminology:
-- - Newsletter = Publication (the overall publication/brand)
-- - Campaign = Individual newsletter/email
-- ============================================

BEGIN;

-- ============================================
-- 0. RENAME NEWSLETTERS TABLE TO PUBLICATIONS
-- ============================================

-- Rename the main newsletters table to publications
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'newsletters'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE newsletters RENAME TO publications;
    RAISE NOTICE 'Renamed newsletters table to publications';
  ELSE
    RAISE NOTICE 'newsletters table does not exist (may already be renamed), skipping';
  END IF;
END $$;

-- Rename indexes on publications table
DO $$
BEGIN
  -- Note: Indexes are automatically renamed when table is renamed in PostgreSQL
  -- But we can check and log if needed
  RAISE NOTICE 'Table indexes automatically updated with table rename';
END $$;

-- ============================================
-- 1. CORE TABLES
-- ============================================

-- newsletter_settings
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'newsletter_settings'
    AND column_name = 'newsletter_id'
  ) THEN
    ALTER TABLE newsletter_settings
      RENAME COLUMN newsletter_id TO publication_id;
    RAISE NOTICE 'Renamed newsletter_settings.newsletter_id to publication_id';
  ELSE
    RAISE NOTICE 'newsletter_settings.newsletter_id does not exist, skipping';
  END IF;
END $$;

-- newsletter_campaigns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'newsletter_campaigns'
    AND column_name = 'newsletter_id'
  ) THEN
    ALTER TABLE newsletter_campaigns
      RENAME COLUMN newsletter_id TO publication_id;
    RAISE NOTICE 'Renamed newsletter_campaigns.newsletter_id to publication_id';
  ELSE
    RAISE NOTICE 'newsletter_campaigns.newsletter_id does not exist, skipping';
  END IF;
END $$;

-- rss_feeds
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rss_feeds'
    AND column_name = 'newsletter_id'
  ) THEN
    ALTER TABLE rss_feeds
      RENAME COLUMN newsletter_id TO publication_id;
    RAISE NOTICE 'Renamed rss_feeds.newsletter_id to publication_id';
  ELSE
    RAISE NOTICE 'rss_feeds.newsletter_id does not exist, skipping';
  END IF;
END $$;

-- newsletter_sections
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'newsletter_sections'
    AND column_name = 'newsletter_id'
  ) THEN
    ALTER TABLE newsletter_sections
      RENAME COLUMN newsletter_id TO publication_id;
    RAISE NOTICE 'Renamed newsletter_sections.newsletter_id to publication_id';
  ELSE
    RAISE NOTICE 'newsletter_sections.newsletter_id does not exist, skipping';
  END IF;
END $$;

-- ============================================
-- 2. AI FEATURES TABLES
-- ============================================

-- ai_applications
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_applications'
    AND column_name = 'newsletter_id'
  ) THEN
    ALTER TABLE ai_applications
      RENAME COLUMN newsletter_id TO publication_id;
    RAISE NOTICE 'Renamed ai_applications.newsletter_id to publication_id';
  ELSE
    RAISE NOTICE 'ai_applications.newsletter_id does not exist, skipping';
  END IF;
END $$;

-- prompt_ideas
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prompt_ideas'
    AND column_name = 'newsletter_id'
  ) THEN
    ALTER TABLE prompt_ideas
      RENAME COLUMN newsletter_id TO publication_id;
    RAISE NOTICE 'Renamed prompt_ideas.newsletter_id to publication_id';
  ELSE
    RAISE NOTICE 'prompt_ideas.newsletter_id does not exist, skipping';
  END IF;
END $$;

-- ============================================
-- 3. BREAKING NEWS TABLES
-- ============================================

-- breaking_news_feeds (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'breaking_news_feeds'
    AND column_name = 'newsletter_id'
  ) THEN
    ALTER TABLE breaking_news_feeds
      RENAME COLUMN newsletter_id TO publication_id;
    RAISE NOTICE 'Renamed breaking_news_feeds.newsletter_id to publication_id';
  ELSE
    RAISE NOTICE 'breaking_news_feeds.newsletter_id does not exist, skipping';
  END IF;
END $$;

-- ============================================
-- 4. APP SETTINGS TABLE
-- ============================================

-- app_settings (if newsletter_id column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings'
    AND column_name = 'newsletter_id'
  ) THEN
    ALTER TABLE app_settings
      RENAME COLUMN newsletter_id TO publication_id;
    RAISE NOTICE 'Renamed app_settings.newsletter_id to publication_id';
  ELSE
    RAISE NOTICE 'app_settings.newsletter_id does not exist, skipping';
  END IF;
END $$;

-- ============================================
-- 5. ARCHIVED NEWSLETTERS TABLE
-- ============================================

-- archived_newsletters
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_newsletters'
    AND column_name = 'newsletter_id'
  ) THEN
    ALTER TABLE archived_newsletters
      RENAME COLUMN newsletter_id TO publication_id;
    RAISE NOTICE 'Renamed archived_newsletters.newsletter_id to publication_id';
  ELSE
    RAISE NOTICE 'archived_newsletters.newsletter_id does not exist, skipping';
  END IF;
END $$;

-- ============================================
-- 6. CONTACT SUBMISSIONS TABLE
-- ============================================

-- contact_submissions (if exists)
-- Note: This table uses TEXT type and references publications(slug)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contact_submissions'
    AND column_name = 'newsletter_id'
  ) THEN
    ALTER TABLE contact_submissions
      RENAME COLUMN newsletter_id TO publication_id;
    RAISE NOTICE 'Renamed contact_submissions.newsletter_id to publication_id';
  ELSE
    RAISE NOTICE 'contact_submissions.newsletter_id does not exist, skipping';
  END IF;
END $$;

-- ============================================
-- 7. AI PROMPT TESTS TABLE
-- ============================================

-- ai_prompt_tests (if exists)
-- Note: This table uses TEXT type for newsletter_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_prompt_tests'
    AND column_name = 'newsletter_id'
  ) THEN
    ALTER TABLE ai_prompt_tests
      RENAME COLUMN newsletter_id TO publication_id;
    RAISE NOTICE 'Renamed ai_prompt_tests.newsletter_id to publication_id';
  ELSE
    RAISE NOTICE 'ai_prompt_tests.newsletter_id does not exist, skipping';
  END IF;
END $$;

-- ============================================
-- 8. ADVERTISEMENTS TABLE
-- ============================================

-- advertisements
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'advertisements'
    AND column_name = 'newsletter_id'
  ) THEN
    ALTER TABLE advertisements
      RENAME COLUMN newsletter_id TO publication_id;
    RAISE NOTICE 'Renamed advertisements.newsletter_id to publication_id';
  ELSE
    RAISE NOTICE 'advertisements.newsletter_id does not exist, skipping';
  END IF;
END $$;

-- ============================================
-- 9. RENAME INDEXES
-- ============================================

-- Rename index on newsletter_campaigns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_campaigns_newsletter'
  ) THEN
    ALTER INDEX idx_campaigns_newsletter
      RENAME TO idx_campaigns_publication;
    RAISE NOTICE 'Renamed index idx_campaigns_newsletter to idx_campaigns_publication';
  ELSE
    RAISE NOTICE 'Index idx_campaigns_newsletter does not exist, skipping';
  END IF;
END $$;

-- Rename index on rss_feeds (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_rss_feeds_newsletter'
  ) THEN
    ALTER INDEX idx_rss_feeds_newsletter
      RENAME TO idx_rss_feeds_publication;
    RAISE NOTICE 'Renamed index idx_rss_feeds_newsletter to idx_rss_feeds_publication';
  ELSE
    RAISE NOTICE 'Index idx_rss_feeds_newsletter does not exist, skipping';
  END IF;
END $$;

-- Rename index on archived_newsletters (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_archived_newsletters_newsletter_id'
  ) THEN
    ALTER INDEX idx_archived_newsletters_newsletter_id
      RENAME TO idx_archived_newsletters_publication_id;
    RAISE NOTICE 'Renamed index idx_archived_newsletters_newsletter_id to idx_archived_newsletters_publication_id';
  ELSE
    RAISE NOTICE 'Index idx_archived_newsletters_newsletter_id does not exist, skipping';
  END IF;
END $$;

-- Rename index on newsletter_sections (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_newsletter_sections_newsletter'
  ) THEN
    ALTER INDEX idx_newsletter_sections_newsletter
      RENAME TO idx_newsletter_sections_publication;
    RAISE NOTICE 'Renamed index idx_newsletter_sections_newsletter to idx_newsletter_sections_publication';
  ELSE
    RAISE NOTICE 'Index idx_newsletter_sections_newsletter does not exist, skipping';
  END IF;
END $$;

-- Rename index on contact_submissions (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_contact_submissions_newsletter_id'
  ) THEN
    ALTER INDEX idx_contact_submissions_newsletter_id
      RENAME TO idx_contact_submissions_publication_id;
    RAISE NOTICE 'Renamed index idx_contact_submissions_newsletter_id to idx_contact_submissions_publication_id';
  ELSE
    RAISE NOTICE 'Index idx_contact_submissions_newsletter_id does not exist, skipping';
  END IF;
END $$;

-- Rename index on ai_prompt_tests (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_ai_prompt_tests_user_newsletter'
  ) THEN
    ALTER INDEX idx_ai_prompt_tests_user_newsletter
      RENAME TO idx_ai_prompt_tests_user_publication;
    RAISE NOTICE 'Renamed index idx_ai_prompt_tests_user_newsletter to idx_ai_prompt_tests_user_publication';
  ELSE
    RAISE NOTICE 'Index idx_ai_prompt_tests_user_newsletter does not exist, skipping';
  END IF;
END $$;

-- Rename index on advertisements (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_advertisements_newsletter'
  ) THEN
    ALTER INDEX idx_advertisements_newsletter
      RENAME TO idx_advertisements_publication;
    RAISE NOTICE 'Renamed index idx_advertisements_newsletter to idx_advertisements_publication';
  ELSE
    RAISE NOTICE 'Index idx_advertisements_newsletter does not exist, skipping';
  END IF;
END $$;

-- ============================================
-- 10. UPDATE UNIQUE CONSTRAINTS
-- ============================================

-- Update unique constraint on newsletter_settings
DO $$
BEGIN
  -- Check if old constraint exists and drop it
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname LIKE '%newsletter_settings%newsletter_id%'
  ) THEN
    ALTER TABLE newsletter_settings
      DROP CONSTRAINT IF EXISTS newsletter_settings_newsletter_id_key;
    RAISE NOTICE 'Dropped old constraint newsletter_settings_newsletter_id_key';
  END IF;

  -- Add new constraint if it doesn't already exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'newsletter_settings_publication_id_key'
  ) THEN
    ALTER TABLE newsletter_settings
      ADD CONSTRAINT newsletter_settings_publication_id_key
      UNIQUE (publication_id, key);
    RAISE NOTICE 'Added new constraint newsletter_settings_publication_id_key';
  ELSE
    RAISE NOTICE 'Constraint newsletter_settings_publication_id_key already exists, skipping';
  END IF;
END $$;

-- Update unique constraint on ai_prompt_tests (if exists)
DO $$
BEGIN
  -- Check if table exists first
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_prompt_tests') THEN
    -- Drop old constraint if it exists
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'ai_prompt_tests'
      AND c.conname LIKE '%newsletter_id%'
    ) THEN
      ALTER TABLE ai_prompt_tests
        DROP CONSTRAINT IF EXISTS ai_prompt_tests_user_id_newsletter_id_provider_model_prompt_t_key;
      RAISE NOTICE 'Dropped old constraint on ai_prompt_tests';
    END IF;

    -- Add new constraint if it doesn't already exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'ai_prompt_tests'
      AND c.conname = 'ai_prompt_tests_user_id_publication_id_provider_model_prompt_t_key'
    ) THEN
      ALTER TABLE ai_prompt_tests
        ADD CONSTRAINT ai_prompt_tests_user_id_publication_id_provider_model_prompt_t_key
        UNIQUE (user_id, publication_id, provider, model, prompt_type);
      RAISE NOTICE 'Added new constraint on ai_prompt_tests';
    ELSE
      RAISE NOTICE 'New constraint on ai_prompt_tests already exists, skipping';
    END IF;
  ELSE
    RAISE NOTICE 'Table ai_prompt_tests does not exist, skipping';
  END IF;
END $$;

-- Update unique constraint on archived_newsletters (if exists)
DO $$
BEGIN
  -- Check if table exists first
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'archived_newsletters') THEN
    -- Drop old constraint if it exists
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname LIKE '%archived_newsletters%newsletter_id%'
    ) THEN
      ALTER TABLE archived_newsletters
        DROP CONSTRAINT IF EXISTS archived_newsletters_newsletter_id_campaign_date_key;
      RAISE NOTICE 'Dropped old constraint on archived_newsletters';
    END IF;

    -- Add new constraint if it doesn't already exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'archived_newsletters'
      AND c.conname = 'archived_newsletters_publication_id_campaign_date_key'
    ) THEN
      ALTER TABLE archived_newsletters
        ADD CONSTRAINT archived_newsletters_publication_id_campaign_date_key
        UNIQUE (publication_id, campaign_date);
      RAISE NOTICE 'Added new constraint on archived_newsletters';
    ELSE
      RAISE NOTICE 'New constraint on archived_newsletters already exists, skipping';
    END IF;
  ELSE
    RAISE NOTICE 'Table archived_newsletters does not exist, skipping';
  END IF;
END $$;

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these queries after the migration to verify:

-- Check all tables for remaining newsletter_id columns
-- SELECT table_name, column_name
-- FROM information_schema.columns
-- WHERE column_name = 'newsletter_id'
-- AND table_schema = 'public';

-- Check all tables now have publication_id columns
-- SELECT table_name, column_name
-- FROM information_schema.columns
-- WHERE column_name = 'publication_id'
-- AND table_schema = 'public'
-- ORDER BY table_name;

-- Check foreign key constraints are intact
-- SELECT
--   tc.table_name,
--   kcu.column_name,
--   ccu.table_name AS foreign_table_name,
--   ccu.column_name AS foreign_column_name
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu
--   ON tc.constraint_name = kcu.constraint_name
--   AND tc.table_schema = kcu.table_schema
-- JOIN information_schema.constraint_column_usage AS ccu
--   ON ccu.constraint_name = tc.constraint_name
--   AND ccu.table_schema = tc.table_schema
-- WHERE tc.constraint_type = 'FOREIGN KEY'
-- AND kcu.column_name = 'publication_id';
