-- ============================================================
-- CAMPAIGN → ISSUE MIGRATION (FORWARD)
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

-- Pattern: Work from child tables toward parent table
-- This ensures foreign key constraints can be properly updated

-- 2.1: Tables with campaign_id foreign keys
-- Note: Some columns may be nullable, handle appropriately

-- ai_apps_selection
ALTER TABLE IF EXISTS ai_apps_selection
  RENAME COLUMN campaign_id TO issue_id;
RAISE NOTICE 'Renamed campaign_id to issue_id in ai_apps_selection';

-- prompt_ideas_selection
ALTER TABLE IF EXISTS prompt_ideas_selection
  RENAME COLUMN campaign_id TO issue_id;
RAISE NOTICE 'Renamed campaign_id to issue_id in prompt_ideas_selection';

-- archived_newsletters
ALTER TABLE IF EXISTS archived_newsletters
  RENAME COLUMN campaign_id TO issue_id;
RAISE NOTICE 'Renamed campaign_id to issue_id in archived_newsletters';

-- Also rename campaign_date to issue_date for consistency
ALTER TABLE IF EXISTS archived_newsletters
  RENAME COLUMN campaign_date TO issue_date;
RAISE NOTICE 'Renamed campaign_date to issue_date in archived_newsletters';

-- Also rename campaign_status to issue_status for consistency
ALTER TABLE IF EXISTS archived_newsletters
  RENAME COLUMN campaign_status TO issue_status;
RAISE NOTICE 'Renamed campaign_status to issue_status in archived_newsletters';

-- rss_posts
ALTER TABLE IF EXISTS rss_posts
  RENAME COLUMN campaign_id TO issue_id;
RAISE NOTICE 'Renamed campaign_id to issue_id in rss_posts';

-- articles
ALTER TABLE IF EXISTS articles
  RENAME COLUMN campaign_id TO issue_id;
RAISE NOTICE 'Renamed campaign_id to issue_id in articles';

-- secondary_articles
ALTER TABLE IF EXISTS secondary_articles
  RENAME COLUMN campaign_id TO issue_id;
RAISE NOTICE 'Renamed campaign_id to issue_id in secondary_articles';

-- archived_secondary_articles
ALTER TABLE IF EXISTS archived_secondary_articles
  RENAME COLUMN campaign_id TO issue_id;
RAISE NOTICE 'Renamed campaign_id to issue_id in archived_secondary_articles';

-- manual_articles
ALTER TABLE IF EXISTS manual_articles
  RENAME COLUMN campaign_id TO issue_id;
RAISE NOTICE 'Renamed campaign_id to issue_id in manual_articles';

-- archived_articles
ALTER TABLE IF EXISTS archived_articles
  RENAME COLUMN campaign_id TO issue_id;
RAISE NOTICE 'Renamed campaign_id to issue_id in archived_articles';

-- archived_rss_posts
ALTER TABLE IF EXISTS archived_rss_posts
  RENAME COLUMN campaign_id TO issue_id;
RAISE NOTICE 'Renamed campaign_id to issue_id in archived_rss_posts';

-- duplicate_groups
ALTER TABLE IF EXISTS duplicate_groups
  RENAME COLUMN campaign_id TO issue_id;
RAISE NOTICE 'Renamed campaign_id to issue_id in duplicate_groups';

-- email_metrics
ALTER TABLE IF EXISTS email_metrics
  RENAME COLUMN campaign_id TO issue_id;
RAISE NOTICE 'Renamed campaign_id to issue_id in email_metrics';

-- Also rename mailerlite_campaign_id to mailerlite_issue_id for consistency
ALTER TABLE IF EXISTS email_metrics
  RENAME COLUMN mailerlite_campaign_id TO mailerlite_issue_id;
RAISE NOTICE 'Renamed mailerlite_campaign_id to mailerlite_issue_id in email_metrics';

-- user_activity
ALTER TABLE IF EXISTS user_activity
  RENAME COLUMN campaign_id TO issue_id;
RAISE NOTICE 'Renamed campaign_id to issue_id in user_activity';

-- link_clicks
ALTER TABLE IF EXISTS link_clicks
  RENAME COLUMN campaign_id TO issue_id;
RAISE NOTICE 'Renamed campaign_id to issue_id in link_clicks';

-- poll_responses
ALTER TABLE IF EXISTS poll_responses
  RENAME COLUMN campaign_id TO issue_id;
RAISE NOTICE 'Renamed campaign_id to issue_id in poll_responses';

-- road_work_items
ALTER TABLE IF EXISTS road_work_items
  RENAME COLUMN campaign_id TO issue_id;
RAISE NOTICE 'Renamed campaign_id to issue_id in road_work_items';

-- road_work_data
ALTER TABLE IF EXISTS road_work_data
  RENAME COLUMN campaign_id TO issue_id;
RAISE NOTICE 'Renamed campaign_id to issue_id in road_work_data';

-- campaign_events
ALTER TABLE IF EXISTS campaign_events
  RENAME COLUMN campaign_id TO issue_id;
RAISE NOTICE 'Renamed campaign_id to issue_id in campaign_events';

-- Also rename the table itself
ALTER TABLE IF EXISTS campaign_events
  RENAME TO issue_events;
RAISE NOTICE 'Renamed campaign_events table to issue_events';

-- vrbo_selections
ALTER TABLE IF EXISTS vrbo_selections
  RENAME COLUMN campaign_id TO issue_id;
RAISE NOTICE 'Renamed campaign_id to issue_id in vrbo_selections';

-- dining_selections
ALTER TABLE IF EXISTS dining_selections
  RENAME COLUMN campaign_id TO issue_id;
RAISE NOTICE 'Renamed campaign_id to issue_id in dining_selections';

-- advertisements_assignment
ALTER TABLE IF EXISTS advertisements_assignment
  RENAME COLUMN campaign_id TO issue_id;
RAISE NOTICE 'Renamed campaign_id to issue_id in advertisements_assignment';

-- breaking_news (if exists)
ALTER TABLE IF EXISTS breaking_news
  RENAME COLUMN campaign_id TO issue_id;
RAISE NOTICE 'Renamed campaign_id to issue_id in breaking_news';

-- ============================================================
-- STEP 3: Rename Primary Table
-- ============================================================

-- Rename the main table
ALTER TABLE newsletter_campaigns
  RENAME TO publication_issues;
RAISE NOTICE 'Renamed newsletter_campaigns table to publication_issues';

-- ============================================================
-- STEP 4: Update Constraints and Indexes
-- ============================================================

-- Rename primary key constraint
ALTER INDEX IF EXISTS newsletter_campaigns_pkey
  RENAME TO publication_issues_pkey;

-- Rename other indexes on the main table
ALTER INDEX IF EXISTS idx_newsletter_campaigns_publication_id
  RENAME TO idx_publication_issues_publication_id;

ALTER INDEX IF EXISTS idx_newsletter_campaigns_date
  RENAME TO idx_publication_issues_date;

ALTER INDEX IF EXISTS idx_newsletter_campaigns_status
  RENAME TO idx_publication_issues_status;

-- Rename foreign key constraint on the main table
ALTER TABLE publication_issues
  DROP CONSTRAINT IF EXISTS newsletter_campaigns_publication_id_fkey;

ALTER TABLE publication_issues
  ADD CONSTRAINT publication_issues_publication_id_fkey
  FOREIGN KEY (publication_id) REFERENCES publications(id) ON DELETE CASCADE;

-- ============================================================
-- STEP 5: Recreate Foreign Key Constraints on Child Tables
-- ============================================================

-- For each child table, drop old FK constraint and create new one
-- Pattern: tablename_campaign_id_fkey → tablename_issue_id_fkey

-- ai_apps_selection
ALTER TABLE IF EXISTS ai_apps_selection
  DROP CONSTRAINT IF EXISTS ai_apps_selection_campaign_id_fkey;
ALTER TABLE IF EXISTS ai_apps_selection
  ADD CONSTRAINT ai_apps_selection_issue_id_fkey
  FOREIGN KEY (issue_id) REFERENCES publication_issues(id) ON DELETE CASCADE;

-- prompt_ideas_selection
ALTER TABLE IF EXISTS prompt_ideas_selection
  DROP CONSTRAINT IF EXISTS prompt_ideas_selection_campaign_id_fkey;
ALTER TABLE IF EXISTS prompt_ideas_selection
  ADD CONSTRAINT prompt_ideas_selection_issue_id_fkey
  FOREIGN KEY (issue_id) REFERENCES publication_issues(id) ON DELETE CASCADE;

-- archived_newsletters
ALTER TABLE IF EXISTS archived_newsletters
  DROP CONSTRAINT IF EXISTS archived_newsletters_campaign_id_fkey;
ALTER TABLE IF EXISTS archived_newsletters
  ADD CONSTRAINT archived_newsletters_issue_id_fkey
  FOREIGN KEY (issue_id) REFERENCES publication_issues(id) ON DELETE CASCADE;

-- rss_posts
ALTER TABLE IF EXISTS rss_posts
  DROP CONSTRAINT IF EXISTS rss_posts_campaign_id_fkey;
ALTER TABLE IF EXISTS rss_posts
  ADD CONSTRAINT rss_posts_issue_id_fkey
  FOREIGN KEY (issue_id) REFERENCES publication_issues(id) ON DELETE CASCADE;

-- articles
ALTER TABLE IF EXISTS articles
  DROP CONSTRAINT IF EXISTS articles_campaign_id_fkey;
ALTER TABLE IF EXISTS articles
  ADD CONSTRAINT articles_issue_id_fkey
  FOREIGN KEY (issue_id) REFERENCES publication_issues(id) ON DELETE CASCADE;

-- secondary_articles
ALTER TABLE IF EXISTS secondary_articles
  DROP CONSTRAINT IF EXISTS secondary_articles_campaign_id_fkey;
ALTER TABLE IF EXISTS secondary_articles
  ADD CONSTRAINT secondary_articles_issue_id_fkey
  FOREIGN KEY (issue_id) REFERENCES publication_issues(id) ON DELETE CASCADE;

-- archived_secondary_articles
ALTER TABLE IF EXISTS archived_secondary_articles
  DROP CONSTRAINT IF EXISTS archived_secondary_articles_campaign_id_fkey;
ALTER TABLE IF EXISTS archived_secondary_articles
  ADD CONSTRAINT archived_secondary_articles_issue_id_fkey
  FOREIGN KEY (issue_id) REFERENCES publication_issues(id) ON DELETE CASCADE;

-- manual_articles
ALTER TABLE IF EXISTS manual_articles
  DROP CONSTRAINT IF EXISTS manual_articles_campaign_id_fkey;
ALTER TABLE IF EXISTS manual_articles
  ADD CONSTRAINT manual_articles_issue_id_fkey
  FOREIGN KEY (issue_id) REFERENCES publication_issues(id) ON DELETE CASCADE;

-- archived_articles
ALTER TABLE IF EXISTS archived_articles
  DROP CONSTRAINT IF EXISTS archived_articles_campaign_id_fkey;
ALTER TABLE IF EXISTS archived_articles
  ADD CONSTRAINT archived_articles_issue_id_fkey
  FOREIGN KEY (issue_id) REFERENCES publication_issues(id) ON DELETE CASCADE;

-- archived_rss_posts
ALTER TABLE IF EXISTS archived_rss_posts
  DROP CONSTRAINT IF EXISTS archived_rss_posts_campaign_id_fkey;
ALTER TABLE IF EXISTS archived_rss_posts
  ADD CONSTRAINT archived_rss_posts_issue_id_fkey
  FOREIGN KEY (issue_id) REFERENCES publication_issues(id) ON DELETE CASCADE;

-- duplicate_groups
ALTER TABLE IF EXISTS duplicate_groups
  DROP CONSTRAINT IF EXISTS duplicate_groups_campaign_id_fkey;
ALTER TABLE IF EXISTS duplicate_groups
  ADD CONSTRAINT duplicate_groups_issue_id_fkey
  FOREIGN KEY (issue_id) REFERENCES publication_issues(id) ON DELETE CASCADE;

-- email_metrics
ALTER TABLE IF EXISTS email_metrics
  DROP CONSTRAINT IF EXISTS email_metrics_campaign_id_fkey;
ALTER TABLE IF EXISTS email_metrics
  ADD CONSTRAINT email_metrics_issue_id_fkey
  FOREIGN KEY (issue_id) REFERENCES publication_issues(id) ON DELETE CASCADE;

-- user_activity
ALTER TABLE IF EXISTS user_activity
  DROP CONSTRAINT IF EXISTS user_activity_campaign_id_fkey;
ALTER TABLE IF EXISTS user_activity
  ADD CONSTRAINT user_activity_issue_id_fkey
  FOREIGN KEY (issue_id) REFERENCES publication_issues(id) ON DELETE CASCADE;

-- link_clicks
ALTER TABLE IF EXISTS link_clicks
  DROP CONSTRAINT IF EXISTS link_clicks_campaign_id_fkey;
ALTER TABLE IF EXISTS link_clicks
  ADD CONSTRAINT link_clicks_issue_id_fkey
  FOREIGN KEY (issue_id) REFERENCES publication_issues(id) ON DELETE CASCADE;

-- poll_responses
ALTER TABLE IF EXISTS poll_responses
  DROP CONSTRAINT IF EXISTS poll_responses_campaign_id_fkey;
ALTER TABLE IF EXISTS poll_responses
  ADD CONSTRAINT poll_responses_issue_id_fkey
  FOREIGN KEY (issue_id) REFERENCES publication_issues(id) ON DELETE CASCADE;

-- issue_events (formerly campaign_events)
ALTER TABLE IF EXISTS issue_events
  DROP CONSTRAINT IF EXISTS campaign_events_campaign_id_fkey;
ALTER TABLE IF EXISTS issue_events
  ADD CONSTRAINT issue_events_issue_id_fkey
  FOREIGN KEY (issue_id) REFERENCES publication_issues(id) ON DELETE CASCADE;

-- advertisements_assignment
ALTER TABLE IF EXISTS advertisements_assignment
  DROP CONSTRAINT IF EXISTS advertisements_assignment_campaign_id_fkey;
ALTER TABLE IF EXISTS advertisements_assignment
  ADD CONSTRAINT advertisements_assignment_issue_id_fkey
  FOREIGN KEY (issue_id) REFERENCES publication_issues(id) ON DELETE CASCADE;

-- vrbo_selections
ALTER TABLE IF EXISTS vrbo_selections
  DROP CONSTRAINT IF EXISTS vrbo_selections_campaign_id_fkey;
ALTER TABLE IF EXISTS vrbo_selections
  ADD CONSTRAINT vrbo_selections_issue_id_fkey
  FOREIGN KEY (issue_id) REFERENCES publication_issues(id) ON DELETE CASCADE;

-- dining_selections
ALTER TABLE IF EXISTS dining_selections
  DROP CONSTRAINT IF EXISTS dining_selections_campaign_id_fkey;
ALTER TABLE IF EXISTS dining_selections
  ADD CONSTRAINT dining_selections_issue_id_fkey
  FOREIGN KEY (issue_id) REFERENCES publication_issues(id) ON DELETE CASCADE;

-- breaking_news
ALTER TABLE IF EXISTS breaking_news
  DROP CONSTRAINT IF EXISTS breaking_news_campaign_id_fkey;
ALTER TABLE IF EXISTS breaking_news
  ADD CONSTRAINT breaking_news_issue_id_fkey
  FOREIGN KEY (issue_id) REFERENCES publication_issues(id) ON DELETE CASCADE;

-- road_work_items
ALTER TABLE IF EXISTS road_work_items
  DROP CONSTRAINT IF EXISTS road_work_items_campaign_id_fkey;
ALTER TABLE IF EXISTS road_work_items
  ADD CONSTRAINT road_work_items_issue_id_fkey
  FOREIGN KEY (issue_id) REFERENCES publication_issues(id) ON DELETE CASCADE;

-- road_work_data
ALTER TABLE IF EXISTS road_work_data
  DROP CONSTRAINT IF EXISTS road_work_data_campaign_id_fkey;
ALTER TABLE IF EXISTS road_work_data
  ADD CONSTRAINT road_work_data_issue_id_fkey
  FOREIGN KEY (issue_id) REFERENCES publication_issues(id) ON DELETE CASCADE;

-- ============================================================
-- STEP 6: Update Indexes on Foreign Key Columns
-- ============================================================

-- Rename indexes on issue_id columns for better naming
ALTER INDEX IF EXISTS idx_articles_campaign_id
  RENAME TO idx_articles_issue_id;

ALTER INDEX IF EXISTS idx_secondary_articles_campaign_id
  RENAME TO idx_secondary_articles_issue_id;

ALTER INDEX IF EXISTS idx_rss_posts_campaign_id
  RENAME TO idx_rss_posts_issue_id;

-- Add indexes if they don't exist (some tables might not have them)
CREATE INDEX IF NOT EXISTS idx_ai_apps_selection_issue_id
  ON ai_apps_selection(issue_id);

CREATE INDEX IF NOT EXISTS idx_archived_newsletters_issue_id
  ON archived_newsletters(issue_id);

CREATE INDEX IF NOT EXISTS idx_email_metrics_issue_id
  ON email_metrics(issue_id);

-- ============================================================
-- STEP 7: Update Status Enum Type (if exists)
-- ============================================================

-- Rename CampaignStatus enum type to IssueStatus if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'campaignstatus') THEN
    ALTER TYPE campaignstatus RENAME TO issuestatus;
    RAISE NOTICE 'Renamed campaignstatus enum to issuestatus';
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
END $$;

-- Verify row counts match
INSERT INTO migration_verification
SELECT
  'publication_issues' as table_name,
  (SELECT COUNT(*) FROM publication_issues) as row_count;

-- Display verification results
SELECT * FROM migration_verification;

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

-- Verify foreign key constraints exist
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
ORDER BY tc.table_name;

COMMIT;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

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
