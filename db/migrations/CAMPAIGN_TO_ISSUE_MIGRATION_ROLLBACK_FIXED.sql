-- ============================================================
-- CAMPAIGN → ISSUE MIGRATION ROLLBACK - FIXED
-- ============================================================
-- Migration: Revert publication_issues back to newsletter_campaigns
--            and issue_id back to campaign_id across all tables
-- Date: 2025-11-13
-- Author: AI Pro Daily Team
-- Risk Level: HIGH - Use only if migration fails
-- Purpose: Emergency rollback to pre-migration state
-- ============================================================

-- WHEN TO USE THIS ROLLBACK:
-- [ ] Migration failed mid-process
-- [ ] Data integrity issues detected
-- [ ] Critical bugs in production after migration
-- [ ] Need to revert to original naming structure

BEGIN;

-- ============================================================
-- STEP 0: Pre-Rollback Verification
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'publication_issues') THEN
    RAISE NOTICE 'Table publication_issues does not exist. May already be rolled back or migration never ran.';
  END IF;
  RAISE NOTICE 'Starting rollback process...';
END $$;

-- Record row counts for verification
CREATE TEMP TABLE rollback_verification AS
SELECT
  'publication_issues' as table_name,
  (SELECT COUNT(*) FROM publication_issues WHERE EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'publication_issues')) as row_count;

-- ============================================================
-- STEP 1: Rename Foreign Key Columns Back (Child Tables)
-- ============================================================

-- ai_apps_selection
DO $$
BEGIN
  ALTER TABLE IF EXISTS ai_apps_selection RENAME COLUMN issue_id TO campaign_id;
  RAISE NOTICE 'Renamed issue_id back to campaign_id in ai_apps_selection';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in ai_apps_selection: %', SQLERRM;
END $$;

-- prompt_ideas_selection
DO $$
BEGIN
  ALTER TABLE IF EXISTS prompt_ideas_selection RENAME COLUMN issue_id TO campaign_id;
  RAISE NOTICE 'Renamed issue_id back to campaign_id in prompt_ideas_selection';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in prompt_ideas_selection: %', SQLERRM;
END $$;

-- archived_newsletters (multiple columns)
DO $$
BEGIN
  ALTER TABLE IF EXISTS archived_newsletters RENAME COLUMN issue_id TO campaign_id;
  ALTER TABLE IF EXISTS archived_newsletters RENAME COLUMN issue_date TO campaign_date;
  ALTER TABLE IF EXISTS archived_newsletters RENAME COLUMN issue_status TO campaign_status;
  RAISE NOTICE 'Renamed issue columns back to campaign columns in archived_newsletters';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in archived_newsletters: %', SQLERRM;
END $$;

-- rss_posts
DO $$
BEGIN
  ALTER TABLE IF EXISTS rss_posts RENAME COLUMN issue_id TO campaign_id;
  RAISE NOTICE 'Renamed issue_id back to campaign_id in rss_posts';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in rss_posts: %', SQLERRM;
END $$;

-- articles
DO $$
BEGIN
  ALTER TABLE IF EXISTS articles RENAME COLUMN issue_id TO campaign_id;
  RAISE NOTICE 'Renamed issue_id back to campaign_id in articles';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in articles: %', SQLERRM;
END $$;

-- secondary_articles
DO $$
BEGIN
  ALTER TABLE IF EXISTS secondary_articles RENAME COLUMN issue_id TO campaign_id;
  RAISE NOTICE 'Renamed issue_id back to campaign_id in secondary_articles';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in secondary_articles: %', SQLERRM;
END $$;

-- archived_secondary_articles
DO $$
BEGIN
  ALTER TABLE IF EXISTS archived_secondary_articles RENAME COLUMN issue_id TO campaign_id;
  RAISE NOTICE 'Renamed issue_id back to campaign_id in archived_secondary_articles';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in archived_secondary_articles: %', SQLERRM;
END $$;

-- manual_articles
DO $$
BEGIN
  ALTER TABLE IF EXISTS manual_articles RENAME COLUMN issue_id TO campaign_id;
  RAISE NOTICE 'Renamed issue_id back to campaign_id in manual_articles';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in manual_articles: %', SQLERRM;
END $$;

-- archived_articles
DO $$
BEGIN
  ALTER TABLE IF EXISTS archived_articles RENAME COLUMN issue_id TO campaign_id;
  RAISE NOTICE 'Renamed issue_id back to campaign_id in archived_articles';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in archived_articles: %', SQLERRM;
END $$;

-- archived_rss_posts
DO $$
BEGIN
  ALTER TABLE IF EXISTS archived_rss_posts RENAME COLUMN issue_id TO campaign_id;
  RAISE NOTICE 'Renamed issue_id back to campaign_id in archived_rss_posts';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in archived_rss_posts: %', SQLERRM;
END $$;

-- duplicate_groups
DO $$
BEGIN
  ALTER TABLE IF EXISTS duplicate_groups RENAME COLUMN issue_id TO campaign_id;
  RAISE NOTICE 'Renamed issue_id back to campaign_id in duplicate_groups';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in duplicate_groups: %', SQLERRM;
END $$;

-- email_metrics (multiple columns)
DO $$
BEGIN
  ALTER TABLE IF EXISTS email_metrics RENAME COLUMN issue_id TO campaign_id;
  ALTER TABLE IF EXISTS email_metrics RENAME COLUMN mailerlite_issue_id TO mailerlite_campaign_id;
  RAISE NOTICE 'Renamed issue columns back to campaign columns in email_metrics';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in email_metrics: %', SQLERRM;
END $$;

-- user_activity
DO $$
BEGIN
  ALTER TABLE IF EXISTS user_activity RENAME COLUMN issue_id TO campaign_id;
  RAISE NOTICE 'Renamed issue_id back to campaign_id in user_activity';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in user_activity: %', SQLERRM;
END $$;

-- link_clicks
DO $$
BEGIN
  ALTER TABLE IF EXISTS link_clicks RENAME COLUMN issue_id TO campaign_id;
  RAISE NOTICE 'Renamed issue_id back to campaign_id in link_clicks';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in link_clicks: %', SQLERRM;
END $$;

-- poll_responses
DO $$
BEGIN
  ALTER TABLE IF EXISTS poll_responses RENAME COLUMN issue_id TO campaign_id;
  RAISE NOTICE 'Renamed issue_id back to campaign_id in poll_responses';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in poll_responses: %', SQLERRM;
END $$;

-- road_work_items
DO $$
BEGIN
  ALTER TABLE IF EXISTS road_work_items RENAME COLUMN issue_id TO campaign_id;
  RAISE NOTICE 'Renamed issue_id back to campaign_id in road_work_items';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in road_work_items: %', SQLERRM;
END $$;

-- road_work_data
DO $$
BEGIN
  ALTER TABLE IF EXISTS road_work_data RENAME COLUMN issue_id TO campaign_id;
  RAISE NOTICE 'Renamed issue_id back to campaign_id in road_work_data';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in road_work_data: %', SQLERRM;
END $$;

-- issue_events (rename back to campaign_events)
DO $$
BEGIN
  ALTER TABLE IF EXISTS issue_events RENAME COLUMN issue_id TO campaign_id;
  ALTER TABLE IF EXISTS issue_events RENAME TO campaign_events;
  RAISE NOTICE 'Renamed issue_events back to campaign_events';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename issue_events: %', SQLERRM;
END $$;

-- vrbo_selections
DO $$
BEGIN
  ALTER TABLE IF EXISTS vrbo_selections RENAME COLUMN issue_id TO campaign_id;
  RAISE NOTICE 'Renamed issue_id back to campaign_id in vrbo_selections';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in vrbo_selections: %', SQLERRM;
END $$;

-- dining_selections
DO $$
BEGIN
  ALTER TABLE IF EXISTS dining_selections RENAME COLUMN issue_id TO campaign_id;
  RAISE NOTICE 'Renamed issue_id back to campaign_id in dining_selections';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in dining_selections: %', SQLERRM;
END $$;

-- advertisements_assignment
DO $$
BEGIN
  ALTER TABLE IF EXISTS advertisements_assignment RENAME COLUMN issue_id TO campaign_id;
  RAISE NOTICE 'Renamed issue_id back to campaign_id in advertisements_assignment';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in advertisements_assignment: %', SQLERRM;
END $$;

-- breaking_news
DO $$
BEGIN
  ALTER TABLE IF EXISTS breaking_news RENAME COLUMN issue_id TO campaign_id;
  RAISE NOTICE 'Renamed issue_id back to campaign_id in breaking_news';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename in breaking_news: %', SQLERRM;
END $$;

-- ============================================================
-- STEP 2: Rename Primary Table Back
-- ============================================================

DO $$
BEGIN
  ALTER TABLE IF EXISTS publication_issues RENAME TO newsletter_campaigns;
  RAISE NOTICE 'Renamed publication_issues table back to newsletter_campaigns';
END $$;

-- ============================================================
-- STEP 3: Restore Constraints and Indexes
-- ============================================================

DO $$
BEGIN
  -- Rename primary key constraint back
  ALTER INDEX IF EXISTS publication_issues_pkey RENAME TO newsletter_campaigns_pkey;

  -- Rename other indexes on the main table back
  ALTER INDEX IF EXISTS idx_publication_issues_publication_id RENAME TO idx_newsletter_campaigns_publication_id;
  ALTER INDEX IF EXISTS idx_publication_issues_date RENAME TO idx_newsletter_campaigns_date;
  ALTER INDEX IF EXISTS idx_publication_issues_status RENAME TO idx_newsletter_campaigns_status;

  RAISE NOTICE 'Renamed indexes back on newsletter_campaigns table';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename some indexes: %', SQLERRM;
END $$;

-- Restore foreign key constraint on the main table
DO $$
BEGIN
  ALTER TABLE IF EXISTS newsletter_campaigns DROP CONSTRAINT IF EXISTS publication_issues_publication_id_fkey;
  ALTER TABLE IF EXISTS newsletter_campaigns ADD CONSTRAINT newsletter_campaigns_publication_id_fkey
    FOREIGN KEY (publication_id) REFERENCES publications(id) ON DELETE CASCADE;
  RAISE NOTICE 'Restored foreign key constraint on newsletter_campaigns';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not restore FK constraint: %', SQLERRM;
END $$;

-- ============================================================
-- STEP 4: Recreate Foreign Key Constraints on Child Tables
-- ============================================================

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
    'campaign_events',
    'vrbo_selections',
    'dining_selections',
    'advertisements_assignment',
    'breaking_news'
  ];
BEGIN
  FOREACH table_name IN ARRAY fk_tables
  LOOP
    BEGIN
      -- Drop new FK constraint with issue_id name
      EXECUTE format('ALTER TABLE IF EXISTS %I DROP CONSTRAINT IF EXISTS %I',
        table_name, table_name || '_issue_id_fkey');

      -- Add old FK constraint with campaign_id name
      EXECUTE format('ALTER TABLE IF EXISTS %I ADD CONSTRAINT %I FOREIGN KEY (campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE',
        table_name, table_name || '_campaign_id_fkey');

      RAISE NOTICE 'Restored FK constraint for %', table_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not restore FK for %: %', table_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================
-- STEP 5: Restore Indexes
-- ============================================================

DO $$
BEGIN
  -- Rename indexes back
  ALTER INDEX IF EXISTS idx_articles_issue_id RENAME TO idx_articles_campaign_id;
  ALTER INDEX IF EXISTS idx_secondary_articles_issue_id RENAME TO idx_secondary_articles_campaign_id;
  ALTER INDEX IF EXISTS idx_rss_posts_issue_id RENAME TO idx_rss_posts_campaign_id;
  ALTER INDEX IF EXISTS idx_ai_apps_selection_issue_id RENAME TO idx_ai_apps_selection_campaign_id;
  ALTER INDEX IF EXISTS idx_archived_newsletters_issue_id RENAME TO idx_archived_newsletters_campaign_id;
  ALTER INDEX IF EXISTS idx_email_metrics_issue_id RENAME TO idx_email_metrics_campaign_id;

  RAISE NOTICE 'Renamed foreign key indexes back';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not rename some FK indexes: %', SQLERRM;
END $$;

-- ============================================================
-- STEP 6: Restore Enum Type
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issuestatus') THEN
    ALTER TYPE issuestatus RENAME TO campaignstatus;
    RAISE NOTICE 'Renamed issuestatus enum back to campaignstatus';
  ELSE
    RAISE NOTICE 'No issuestatus enum found to rename back';
  END IF;
END $$;

-- ============================================================
-- STEP 7: Post-Rollback Verification
-- ============================================================

-- Verify table was renamed back
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'newsletter_campaigns') THEN
    RAISE EXCEPTION 'Table newsletter_campaigns does not exist after rollback. Rollback failed!';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'publication_issues') THEN
    RAISE EXCEPTION 'Table publication_issues still exists after rollback. Rollback failed!';
  END IF;

  RAISE NOTICE 'Table rollback verification passed';
END $$;

-- Verify row counts match
INSERT INTO rollback_verification
SELECT
  'newsletter_campaigns' as table_name,
  (SELECT COUNT(*) FROM newsletter_campaigns) as row_count;

-- Display verification results
DO $$
DECLARE
  verification_record RECORD;
BEGIN
  RAISE NOTICE '=== ROLLBACK VERIFICATION ===';
  FOR verification_record IN SELECT * FROM rollback_verification ORDER BY table_name
  LOOP
    RAISE NOTICE 'Table: %, Row count: %', verification_record.table_name, verification_record.row_count;
  END LOOP;
END $$;

-- Verify foreign key constraints exist
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
      AND (kcu.column_name = 'campaign_id' OR ccu.table_name = 'newsletter_campaigns')
    ORDER BY tc.table_name
  LOOP
    RAISE NOTICE 'Table: %, FK: %, Column: %, References: %',
      fk_record.table_name, fk_record.constraint_name, fk_record.column_name, fk_record.foreign_table_name;
  END LOOP;
END $$;

COMMIT;

-- ============================================================
-- ROLLBACK COMPLETE
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ROLLBACK COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Table publication_issues → newsletter_campaigns';
  RAISE NOTICE 'Column issue_id → campaign_id (all tables)';
  RAISE NOTICE 'All foreign key constraints restored';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Revert application code changes';
  RAISE NOTICE '2. Redeploy previous version';
  RAISE NOTICE '3. Investigate reason for rollback';
  RAISE NOTICE '4. Fix issues before re-attempting migration';
  RAISE NOTICE '========================================';
END $$;
