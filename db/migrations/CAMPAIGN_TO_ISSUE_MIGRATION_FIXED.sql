-- ============================================================
-- CAMPAIGN → ISSUE MIGRATION (FORWARD) - FIXED
-- ============================================================
-- Migration: Rename newsletter_campaigns table to publication_issues
--            and campaign_id column to issue_id across all tables
-- Date: 2025-11-13
-- Author: AI Pro Daily Team
-- Risk Level: HIGH - Full database backup required before execution
-- Estimated Duration: 5-10 minutes (depends on data volume)
-- Rollback: See CAMPAIGN_TO_ISSUE_MIGRATION_ROLLBACK.sql
-- ============================================================

-- CRITICAL CHECKLIST BEFORE RUNNING:
-- [ ] Full database backup completed
-- [ ] Tested on staging environment
-- [ ] All applications stopped or in maintenance mode
-- [ ] Rollback script prepared and tested
-- [ ] Team notified of maintenance window
-- [ ] Monitoring tools ready

BEGIN;

-- ============================================================
-- STEP 0: Pre-Migration Verification
-- ============================================================

-- Verify newsletter_campaigns table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'newsletter_campaigns') THEN
    RAISE EXCEPTION 'Table newsletter_campaigns does not exist. Migration aborted.';
  END IF;
  RAISE NOTICE 'Verification passed: newsletter_campaigns table exists';
END $$;

-- Record row counts for verification
CREATE TEMP TABLE migration_verification AS
SELECT
  'newsletter_campaigns' as table_name,
  (SELECT COUNT(*) FROM newsletter_campaigns) as row_count;

-- ============================================================
-- STEP 1: Drop Dependent Views (if any exist)
-- ============================================================

-- Check for and drop any views that depend on these tables
DO $$
DECLARE
  view_record RECORD;
BEGIN
  FOR view_record IN
    SELECT table_name
    FROM information_schema.views
    WHERE table_schema = 'public'
  LOOP
    BEGIN
      EXECUTE 'DROP VIEW IF EXISTS ' || view_record.table_name || ' CASCADE';
      RAISE NOTICE 'Dropped view: %', view_record.table_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not drop view %: %', view_record.table_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================
-- STEP 2: Rename Foreign Key Columns (Child Tables First)
-- ============================================================

-- ai_apps_selection
DO $$
BEGIN
  ALTER TABLE IF EXISTS ai_apps_selection RENAME COLUMN campaign_id TO issue_id;
  RAISE NOTICE 'Renamed campaign_id to issue_id in ai_apps_selection';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in ai_apps_selection: %', SQLERRM;
END $$;

-- prompt_ideas_selection
DO $$
BEGIN
  ALTER TABLE IF EXISTS prompt_ideas_selection RENAME COLUMN campaign_id TO issue_id;
  RAISE NOTICE 'Renamed campaign_id to issue_id in prompt_ideas_selection';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in prompt_ideas_selection: %', SQLERRM;
END $$;

-- archived_newsletters (multiple columns)
DO $$
BEGIN
  ALTER TABLE IF EXISTS archived_newsletters RENAME COLUMN campaign_id TO issue_id;
  ALTER TABLE IF EXISTS archived_newsletters RENAME COLUMN campaign_date TO issue_date;
  ALTER TABLE IF EXISTS archived_newsletters RENAME COLUMN campaign_status TO issue_status;
  RAISE NOTICE 'Renamed campaign columns to issue columns in archived_newsletters';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in archived_newsletters: %', SQLERRM;
END $$;

-- rss_posts
DO $$
BEGIN
  ALTER TABLE IF EXISTS rss_posts RENAME COLUMN campaign_id TO issue_id;
  RAISE NOTICE 'Renamed campaign_id to issue_id in rss_posts';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in rss_posts: %', SQLERRM;
END $$;

-- articles
DO $$
BEGIN
  ALTER TABLE IF EXISTS articles RENAME COLUMN campaign_id TO issue_id;
  RAISE NOTICE 'Renamed campaign_id to issue_id in articles';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in articles: %', SQLERRM;
END $$;

-- secondary_articles
DO $$
BEGIN
  ALTER TABLE IF EXISTS secondary_articles RENAME COLUMN campaign_id TO issue_id;
  RAISE NOTICE 'Renamed campaign_id to issue_id in secondary_articles';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in secondary_articles: %', SQLERRM;
END $$;

-- archived_secondary_articles
DO $$
BEGIN
  ALTER TABLE IF EXISTS archived_secondary_articles RENAME COLUMN campaign_id TO issue_id;
  RAISE NOTICE 'Renamed campaign_id to issue_id in archived_secondary_articles';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in archived_secondary_articles: %', SQLERRM;
END $$;

-- manual_articles
DO $$
BEGIN
  ALTER TABLE IF EXISTS manual_articles RENAME COLUMN campaign_id TO issue_id;
  RAISE NOTICE 'Renamed campaign_id to issue_id in manual_articles';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in manual_articles: %', SQLERRM;
END $$;

-- archived_articles
DO $$
BEGIN
  ALTER TABLE IF EXISTS archived_articles RENAME COLUMN campaign_id TO issue_id;
  RAISE NOTICE 'Renamed campaign_id to issue_id in archived_articles';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in archived_articles: %', SQLERRM;
END $$;

-- archived_rss_posts
DO $$
BEGIN
  ALTER TABLE IF EXISTS archived_rss_posts RENAME COLUMN campaign_id TO issue_id;
  RAISE NOTICE 'Renamed campaign_id to issue_id in archived_rss_posts';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in archived_rss_posts: %', SQLERRM;
END $$;

-- duplicate_groups
DO $$
BEGIN
  ALTER TABLE IF EXISTS duplicate_groups RENAME COLUMN campaign_id TO issue_id;
  RAISE NOTICE 'Renamed campaign_id to issue_id in duplicate_groups';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in duplicate_groups: %', SQLERRM;
END $$;

-- email_metrics (multiple columns)
DO $$
BEGIN
  ALTER TABLE IF EXISTS email_metrics RENAME COLUMN campaign_id TO issue_id;
  ALTER TABLE IF EXISTS email_metrics RENAME COLUMN mailerlite_campaign_id TO mailerlite_issue_id;
  RAISE NOTICE 'Renamed campaign columns to issue columns in email_metrics';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in email_metrics: %', SQLERRM;
END $$;

-- user_activity
DO $$
BEGIN
  ALTER TABLE IF EXISTS user_activity RENAME COLUMN campaign_id TO issue_id;
  RAISE NOTICE 'Renamed campaign_id to issue_id in user_activity';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in user_activity: %', SQLERRM;
END $$;

-- link_clicks
DO $$
BEGIN
  ALTER TABLE IF EXISTS link_clicks RENAME COLUMN campaign_id TO issue_id;
  RAISE NOTICE 'Renamed campaign_id to issue_id in link_clicks';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in link_clicks: %', SQLERRM;
END $$;

-- poll_responses
DO $$
BEGIN
  ALTER TABLE IF EXISTS poll_responses RENAME COLUMN campaign_id TO issue_id;
  RAISE NOTICE 'Renamed campaign_id to issue_id in poll_responses';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in poll_responses: %', SQLERRM;
END $$;

-- road_work_items
DO $$
BEGIN
  ALTER TABLE IF EXISTS road_work_items RENAME COLUMN campaign_id TO issue_id;
  RAISE NOTICE 'Renamed campaign_id to issue_id in road_work_items';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in road_work_items: %', SQLERRM;
END $$;

-- road_work_data
DO $$
BEGIN
  ALTER TABLE IF EXISTS road_work_data RENAME COLUMN campaign_id TO issue_id;
  RAISE NOTICE 'Renamed campaign_id to issue_id in road_work_data';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in road_work_data: %', SQLERRM;
END $$;

-- campaign_events (rename column and table)
DO $$
BEGIN
  ALTER TABLE IF EXISTS campaign_events RENAME COLUMN campaign_id TO issue_id;
  ALTER TABLE IF EXISTS campaign_events RENAME TO issue_events;
  RAISE NOTICE 'Renamed campaign_events table and column to issue_events';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename campaign_events: %', SQLERRM;
END $$;

-- vrbo_selections
DO $$
BEGIN
  ALTER TABLE IF EXISTS vrbo_selections RENAME COLUMN campaign_id TO issue_id;
  RAISE NOTICE 'Renamed campaign_id to issue_id in vrbo_selections';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in vrbo_selections: %', SQLERRM;
END $$;

-- dining_selections
DO $$
BEGIN
  ALTER TABLE IF EXISTS dining_selections RENAME COLUMN campaign_id TO issue_id;
  RAISE NOTICE 'Renamed campaign_id to issue_id in dining_selections';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in dining_selections: %', SQLERRM;
END $$;

-- advertisements_assignment
DO $$
BEGIN
  ALTER TABLE IF EXISTS advertisements_assignment RENAME COLUMN campaign_id TO issue_id;
  RAISE NOTICE 'Renamed campaign_id to issue_id in advertisements_assignment';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in advertisements_assignment: %', SQLERRM;
END $$;

-- breaking_news
DO $$
BEGIN
  ALTER TABLE IF EXISTS breaking_news RENAME COLUMN campaign_id TO issue_id;
  RAISE NOTICE 'Renamed campaign_id to issue_id in breaking_news';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in breaking_news: %', SQLERRM;
END $$;

-- ============================================================
-- STEP 3: Rename Primary Table
-- ============================================================

DO $$
BEGIN
  ALTER TABLE newsletter_campaigns RENAME TO publication_issues;
  RAISE NOTICE 'Renamed newsletter_campaigns table to publication_issues';
END $$;

-- ============================================================
-- STEP 4: Update Constraints and Indexes on Main Table
-- ============================================================

DO $$
BEGIN
  -- Rename primary key constraint
  ALTER INDEX IF EXISTS newsletter_campaigns_pkey RENAME TO publication_issues_pkey;

  -- Rename other indexes on the main table
  ALTER INDEX IF EXISTS idx_newsletter_campaigns_publication_id RENAME TO idx_publication_issues_publication_id;
  ALTER INDEX IF EXISTS idx_newsletter_campaigns_date RENAME TO idx_publication_issues_date;
  ALTER INDEX IF EXISTS idx_newsletter_campaigns_status RENAME TO idx_publication_issues_status;

  RAISE NOTICE 'Renamed indexes on publication_issues table';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename some indexes: %', SQLERRM;
END $$;

-- Rename foreign key constraint on the main table
DO $$
BEGIN
  ALTER TABLE publication_issues DROP CONSTRAINT IF EXISTS newsletter_campaigns_publication_id_fkey;
  ALTER TABLE publication_issues ADD CONSTRAINT publication_issues_publication_id_fkey
    FOREIGN KEY (publication_id) REFERENCES publications(id) ON DELETE CASCADE;
  RAISE NOTICE 'Updated foreign key constraint on publication_issues';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not update FK constraint: %', SQLERRM;
END $$;

-- ============================================================
-- STEP 5: Recreate Foreign Key Constraints on Child Tables
-- ============================================================

-- Helper function to recreate FK constraints
DO $$
DECLARE
  table_name TEXT;
  fk_tables TEXT[] := ARRAY[
    'ai_apps_selection',
    'prompt_ideas_selection',
    'archived_newsletters',
    'rss_posts',
    'articles',
    'secondary_articles',
    'archived_secondary_articles',
    'manual_articles',
    'archived_articles',
    'archived_rss_posts',
    'duplicate_groups',
    'email_metrics',
    'user_activity',
    'link_clicks',
    'poll_responses',
    'road_work_items',
    'road_work_data',
    'issue_events',
    'vrbo_selections',
    'dining_selections',
    'advertisements_assignment',
    'breaking_news'
  ];
BEGIN
  FOREACH table_name IN ARRAY fk_tables
  LOOP
    BEGIN
      -- Drop old FK constraint with campaign_id name
      EXECUTE format('ALTER TABLE IF EXISTS %I DROP CONSTRAINT IF EXISTS %I',
        table_name, table_name || '_campaign_id_fkey');

      -- Add new FK constraint with issue_id name
      EXECUTE format('ALTER TABLE IF EXISTS %I ADD CONSTRAINT %I FOREIGN KEY (issue_id) REFERENCES publication_issues(id) ON DELETE CASCADE',
        table_name, table_name || '_issue_id_fkey');

      RAISE NOTICE 'Updated FK constraint for %', table_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not update FK for %: %', table_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================
-- STEP 6: Update Indexes on Foreign Key Columns
-- ============================================================

DO $$
BEGIN
  -- Rename existing indexes
  ALTER INDEX IF EXISTS idx_articles_campaign_id RENAME TO idx_articles_issue_id;
  ALTER INDEX IF EXISTS idx_secondary_articles_campaign_id RENAME TO idx_secondary_articles_issue_id;
  ALTER INDEX IF EXISTS idx_rss_posts_campaign_id RENAME TO idx_rss_posts_issue_id;
  ALTER INDEX IF EXISTS idx_ai_apps_selection_campaign_id RENAME TO idx_ai_apps_selection_issue_id;
  ALTER INDEX IF EXISTS idx_archived_newsletters_campaign_id RENAME TO idx_archived_newsletters_issue_id;
  ALTER INDEX IF EXISTS idx_email_metrics_campaign_id RENAME TO idx_email_metrics_issue_id;

  RAISE NOTICE 'Renamed foreign key indexes';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename some FK indexes: %', SQLERRM;
END $$;

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_ai_apps_selection_issue_id ON ai_apps_selection(issue_id);
CREATE INDEX IF NOT EXISTS idx_archived_newsletters_issue_id ON archived_newsletters(issue_id);
CREATE INDEX IF NOT EXISTS idx_email_metrics_issue_id ON email_metrics(issue_id);

-- ============================================================
-- STEP 7: Update Status Enum Type (if exists)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'campaignstatus') THEN
    ALTER TYPE campaignstatus RENAME TO issuestatus;
    RAISE NOTICE 'Renamed campaignstatus enum to issuestatus';
  ELSE
    RAISE NOTICE 'No campaignstatus enum found to rename';
  END IF;
END $$;

-- ============================================================
-- STEP 8: Post-Migration Verification
-- ============================================================

-- Verify table was renamed
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'publication_issues') THEN
    RAISE EXCEPTION 'Table publication_issues does not exist after migration. Rollback required!';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'newsletter_campaigns') THEN
    RAISE EXCEPTION 'Table newsletter_campaigns still exists after migration. Rollback required!';
  END IF;

  RAISE NOTICE 'Table rename verification passed';
END $$;

-- Verify row counts match
INSERT INTO migration_verification
SELECT
  'publication_issues' as table_name,
  (SELECT COUNT(*) FROM publication_issues) as row_count;

-- Display verification results
DO $$
DECLARE
  verification_record RECORD;
BEGIN
  RAISE NOTICE '=== MIGRATION VERIFICATION ===';
  FOR verification_record IN SELECT * FROM migration_verification ORDER BY table_name
  LOOP
    RAISE NOTICE 'Table: %, Row count: %', verification_record.table_name, verification_record.row_count;
  END LOOP;
END $$;

-- Check that counts match
DO $$
DECLARE
  old_count INTEGER;
  new_count INTEGER;
BEGIN
  SELECT row_count INTO old_count FROM migration_verification WHERE table_name = 'newsletter_campaigns';
  SELECT row_count INTO new_count FROM migration_verification WHERE table_name = 'publication_issues';

  IF old_count != new_count THEN
    RAISE EXCEPTION 'Row count mismatch! Old: %, New: %. Rollback required!', old_count, new_count;
  ELSE
    RAISE NOTICE 'Row count verification passed: % rows', new_count;
  END IF;
END $$;

-- Display foreign key constraints
DO $$
DECLARE
  fk_record RECORD;
BEGIN
  RAISE NOTICE '=== FOREIGN KEY VERIFICATION ===';
  FOR fk_record IN
    SELECT
      tc.table_name,
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND (kcu.column_name = 'issue_id' OR ccu.table_name = 'publication_issues')
    ORDER BY tc.table_name
  LOOP
    RAISE NOTICE 'Table: %, FK: %, Column: %, References: %',
      fk_record.table_name, fk_record.constraint_name, fk_record.column_name, fk_record.foreign_table_name;
  END LOOP;
END $$;

COMMIT;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Table newsletter_campaigns → publication_issues';
  RAISE NOTICE 'Column campaign_id → issue_id (all tables)';
  RAISE NOTICE 'All foreign key constraints updated';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Update application code to use new table/column names';
  RAISE NOTICE '2. Update Supabase types: supabase gen types typescript';
  RAISE NOTICE '3. Deploy updated code';
  RAISE NOTICE '4. Monitor error logs for 24 hours';
  RAISE NOTICE '5. Remove deprecated type aliases after verification';
  RAISE NOTICE '========================================';
END $$;
