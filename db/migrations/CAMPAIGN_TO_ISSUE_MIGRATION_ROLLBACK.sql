-- ============================================================
-- CAMPAIGN → ISSUE MIGRATION ROLLBACK
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

-- Verify publication_issues table exists (if not, migration may not have run)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'publication_issues') THEN
    RAISE NOTICE 'Table publication_issues does not exist. May already be rolled back or migration never ran.';
  END IF;
END $$;

-- Record row counts for verification
CREATE TEMP TABLE rollback_verification AS
SELECT
  'publication_issues' as table_name,
  (SELECT COUNT(*) FROM publication_issues WHERE EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'publication_issues')) as row_count;

-- ============================================================
-- STEP 1: Rename Foreign Key Columns Back (Child Tables)
-- ============================================================

-- Rename issue_id back to campaign_id in all child tables

-- ai_apps_selection
ALTER TABLE IF EXISTS ai_apps_selection
  RENAME COLUMN issue_id TO campaign_id;
RAISE NOTICE 'Renamed issue_id back to campaign_id in ai_apps_selection';

-- prompt_ideas_selection
ALTER TABLE IF EXISTS prompt_ideas_selection
  RENAME COLUMN issue_id TO campaign_id;
RAISE NOTICE 'Renamed issue_id back to campaign_id in prompt_ideas_selection';

-- archived_newsletters
ALTER TABLE IF EXISTS archived_newsletters
  RENAME COLUMN issue_id TO campaign_id;
ALTER TABLE IF EXISTS archived_newsletters
  RENAME COLUMN issue_date TO campaign_date;
ALTER TABLE IF EXISTS archived_newsletters
  RENAME COLUMN issue_status TO campaign_status;
RAISE NOTICE 'Renamed issue columns back to campaign columns in archived_newsletters';

-- rss_posts
ALTER TABLE IF EXISTS rss_posts
  RENAME COLUMN issue_id TO campaign_id;
RAISE NOTICE 'Renamed issue_id back to campaign_id in rss_posts';

-- articles
ALTER TABLE IF EXISTS articles
  RENAME COLUMN issue_id TO campaign_id;
RAISE NOTICE 'Renamed issue_id back to campaign_id in articles';

-- secondary_articles
ALTER TABLE IF EXISTS secondary_articles
  RENAME COLUMN issue_id TO campaign_id;
RAISE NOTICE 'Renamed issue_id back to campaign_id in secondary_articles';

-- archived_secondary_articles
ALTER TABLE IF EXISTS archived_secondary_articles
  RENAME COLUMN issue_id TO campaign_id;
RAISE NOTICE 'Renamed issue_id back to campaign_id in archived_secondary_articles';

-- manual_articles
ALTER TABLE IF EXISTS manual_articles
  RENAME COLUMN issue_id TO campaign_id;
RAISE NOTICE 'Renamed issue_id back to campaign_id in manual_articles';

-- archived_articles
ALTER TABLE IF EXISTS archived_articles
  RENAME COLUMN issue_id TO campaign_id;
RAISE NOTICE 'Renamed issue_id back to campaign_id in archived_articles';

-- archived_rss_posts
ALTER TABLE IF EXISTS archived_rss_posts
  RENAME COLUMN issue_id TO campaign_id;
RAISE NOTICE 'Renamed issue_id back to campaign_id in archived_rss_posts';

-- duplicate_groups
ALTER TABLE IF EXISTS duplicate_groups
  RENAME COLUMN issue_id TO campaign_id;
RAISE NOTICE 'Renamed issue_id back to campaign_id in duplicate_groups';

-- email_metrics
ALTER TABLE IF EXISTS email_metrics
  RENAME COLUMN issue_id TO campaign_id;
ALTER TABLE IF EXISTS email_metrics
  RENAME COLUMN mailerlite_issue_id TO mailerlite_campaign_id;
RAISE NOTICE 'Renamed issue columns back to campaign columns in email_metrics';

-- user_activity
ALTER TABLE IF EXISTS user_activity
  RENAME COLUMN issue_id TO campaign_id;
RAISE NOTICE 'Renamed issue_id back to campaign_id in user_activity';

-- link_clicks
ALTER TABLE IF EXISTS link_clicks
  RENAME COLUMN issue_id TO campaign_id;
RAISE NOTICE 'Renamed issue_id back to campaign_id in link_clicks';

-- poll_responses
ALTER TABLE IF EXISTS poll_responses
  RENAME COLUMN issue_id TO campaign_id;
RAISE NOTICE 'Renamed issue_id back to campaign_id in poll_responses';

-- road_work_items
ALTER TABLE IF EXISTS road_work_items
  RENAME COLUMN issue_id TO campaign_id;
RAISE NOTICE 'Renamed issue_id back to campaign_id in road_work_items';

-- road_work_data
ALTER TABLE IF EXISTS road_work_data
  RENAME COLUMN issue_id TO campaign_id;
RAISE NOTICE 'Renamed issue_id back to campaign_id in road_work_data';

-- issue_events (rename back to campaign_events)
ALTER TABLE IF EXISTS issue_events
  RENAME COLUMN issue_id TO campaign_id;
ALTER TABLE IF EXISTS issue_events
  RENAME TO campaign_events;
RAISE NOTICE 'Renamed issue_events back to campaign_events';

-- vrbo_selections
ALTER TABLE IF EXISTS vrbo_selections
  RENAME COLUMN issue_id TO campaign_id;
RAISE NOTICE 'Renamed issue_id back to campaign_id in vrbo_selections';

-- dining_selections
ALTER TABLE IF EXISTS dining_selections
  RENAME COLUMN issue_id TO campaign_id;
RAISE NOTICE 'Renamed issue_id back to campaign_id in dining_selections';

-- advertisements_assignment
ALTER TABLE IF EXISTS advertisements_assignment
  RENAME COLUMN issue_id TO campaign_id;
RAISE NOTICE 'Renamed issue_id back to campaign_id in advertisements_assignment';

-- breaking_news
ALTER TABLE IF EXISTS breaking_news
  RENAME COLUMN issue_id TO campaign_id;
RAISE NOTICE 'Renamed issue_id back to campaign_id in breaking_news';

-- ============================================================
-- STEP 2: Rename Primary Table Back
-- ============================================================

-- Rename the main table back
ALTER TABLE IF EXISTS publication_issues
  RENAME TO newsletter_campaigns;
RAISE NOTICE 'Renamed publication_issues table back to newsletter_campaigns';

-- ============================================================
-- STEP 3: Restore Constraints and Indexes
-- ============================================================

-- Rename primary key constraint back
ALTER INDEX IF EXISTS publication_issues_pkey
  RENAME TO newsletter_campaigns_pkey;

-- Rename other indexes on the main table back
ALTER INDEX IF EXISTS idx_publication_issues_publication_id
  RENAME TO idx_newsletter_campaigns_publication_id;

ALTER INDEX IF EXISTS idx_publication_issues_date
  RENAME TO idx_newsletter_campaigns_date;

ALTER INDEX IF EXISTS idx_publication_issues_status
  RENAME TO idx_newsletter_campaigns_status;

-- Restore foreign key constraint on the main table
ALTER TABLE IF EXISTS newsletter_campaigns
  DROP CONSTRAINT IF EXISTS publication_issues_publication_id_fkey;

ALTER TABLE IF EXISTS newsletter_campaigns
  ADD CONSTRAINT newsletter_campaigns_publication_id_fkey
  FOREIGN KEY (publication_id) REFERENCES publications(id) ON DELETE CASCADE;

-- ============================================================
-- STEP 4: Recreate Foreign Key Constraints on Child Tables
-- ============================================================

-- ai_apps_selection
ALTER TABLE IF EXISTS ai_apps_selection
  DROP CONSTRAINT IF EXISTS ai_apps_selection_issue_id_fkey;
ALTER TABLE IF EXISTS ai_apps_selection
  ADD CONSTRAINT ai_apps_selection_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE;

-- prompt_ideas_selection
ALTER TABLE IF EXISTS prompt_ideas_selection
  DROP CONSTRAINT IF EXISTS prompt_ideas_selection_issue_id_fkey;
ALTER TABLE IF EXISTS prompt_ideas_selection
  ADD CONSTRAINT prompt_ideas_selection_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE;

-- archived_newsletters
ALTER TABLE IF EXISTS archived_newsletters
  DROP CONSTRAINT IF EXISTS archived_newsletters_issue_id_fkey;
ALTER TABLE IF EXISTS archived_newsletters
  ADD CONSTRAINT archived_newsletters_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE;

-- rss_posts
ALTER TABLE IF EXISTS rss_posts
  DROP CONSTRAINT IF EXISTS rss_posts_issue_id_fkey;
ALTER TABLE IF EXISTS rss_posts
  ADD CONSTRAINT rss_posts_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE;

-- articles
ALTER TABLE IF EXISTS articles
  DROP CONSTRAINT IF EXISTS articles_issue_id_fkey;
ALTER TABLE IF EXISTS articles
  ADD CONSTRAINT articles_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE;

-- secondary_articles
ALTER TABLE IF EXISTS secondary_articles
  DROP CONSTRAINT IF EXISTS secondary_articles_issue_id_fkey;
ALTER TABLE IF EXISTS secondary_articles
  ADD CONSTRAINT secondary_articles_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE;

-- archived_secondary_articles
ALTER TABLE IF EXISTS archived_secondary_articles
  DROP CONSTRAINT IF EXISTS archived_secondary_articles_issue_id_fkey;
ALTER TABLE IF EXISTS archived_secondary_articles
  ADD CONSTRAINT archived_secondary_articles_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE;

-- manual_articles
ALTER TABLE IF EXISTS manual_articles
  DROP CONSTRAINT IF EXISTS manual_articles_issue_id_fkey;
ALTER TABLE IF EXISTS manual_articles
  ADD CONSTRAINT manual_articles_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE;

-- archived_articles
ALTER TABLE IF EXISTS archived_articles
  DROP CONSTRAINT IF EXISTS archived_articles_issue_id_fkey;
ALTER TABLE IF EXISTS archived_articles
  ADD CONSTRAINT archived_articles_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE;

-- archived_rss_posts
ALTER TABLE IF EXISTS archived_rss_posts
  DROP CONSTRAINT IF EXISTS archived_rss_posts_issue_id_fkey;
ALTER TABLE IF EXISTS archived_rss_posts
  ADD CONSTRAINT archived_rss_posts_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE;

-- duplicate_groups
ALTER TABLE IF EXISTS duplicate_groups
  DROP CONSTRAINT IF EXISTS duplicate_groups_issue_id_fkey;
ALTER TABLE IF EXISTS duplicate_groups
  ADD CONSTRAINT duplicate_groups_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE;

-- email_metrics
ALTER TABLE IF EXISTS email_metrics
  DROP CONSTRAINT IF EXISTS email_metrics_issue_id_fkey;
ALTER TABLE IF EXISTS email_metrics
  ADD CONSTRAINT email_metrics_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE;

-- user_activity
ALTER TABLE IF EXISTS user_activity
  DROP CONSTRAINT IF EXISTS user_activity_issue_id_fkey;
ALTER TABLE IF EXISTS user_activity
  ADD CONSTRAINT user_activity_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE;

-- link_clicks
ALTER TABLE IF EXISTS link_clicks
  DROP CONSTRAINT IF EXISTS link_clicks_issue_id_fkey;
ALTER TABLE IF EXISTS link_clicks
  ADD CONSTRAINT link_clicks_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE;

-- poll_responses
ALTER TABLE IF EXISTS poll_responses
  DROP CONSTRAINT IF EXISTS poll_responses_issue_id_fkey;
ALTER TABLE IF EXISTS poll_responses
  ADD CONSTRAINT poll_responses_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE;

-- campaign_events
ALTER TABLE IF EXISTS campaign_events
  DROP CONSTRAINT IF EXISTS issue_events_issue_id_fkey;
ALTER TABLE IF EXISTS campaign_events
  ADD CONSTRAINT campaign_events_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE;

-- advertisements_assignment
ALTER TABLE IF EXISTS advertisements_assignment
  DROP CONSTRAINT IF EXISTS advertisements_assignment_issue_id_fkey;
ALTER TABLE IF EXISTS advertisements_assignment
  ADD CONSTRAINT advertisements_assignment_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE;

-- vrbo_selections
ALTER TABLE IF EXISTS vrbo_selections
  DROP CONSTRAINT IF EXISTS vrbo_selections_issue_id_fkey;
ALTER TABLE IF EXISTS vrbo_selections
  ADD CONSTRAINT vrbo_selections_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE;

-- dining_selections
ALTER TABLE IF EXISTS dining_selections
  DROP CONSTRAINT IF EXISTS dining_selections_issue_id_fkey;
ALTER TABLE IF EXISTS dining_selections
  ADD CONSTRAINT dining_selections_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE;

-- breaking_news
ALTER TABLE IF EXISTS breaking_news
  DROP CONSTRAINT IF EXISTS breaking_news_issue_id_fkey;
ALTER TABLE IF EXISTS breaking_news
  ADD CONSTRAINT breaking_news_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE;

-- road_work_items
ALTER TABLE IF EXISTS road_work_items
  DROP CONSTRAINT IF EXISTS road_work_items_issue_id_fkey;
ALTER TABLE IF EXISTS road_work_items
  ADD CONSTRAINT road_work_items_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE;

-- road_work_data
ALTER TABLE IF EXISTS road_work_data
  DROP CONSTRAINT IF EXISTS road_work_data_issue_id_fkey;
ALTER TABLE IF EXISTS road_work_data
  ADD CONSTRAINT road_work_data_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE;

-- ============================================================
-- STEP 5: Restore Indexes
-- ============================================================

-- Rename indexes back
ALTER INDEX IF EXISTS idx_articles_issue_id
  RENAME TO idx_articles_campaign_id;

ALTER INDEX IF EXISTS idx_secondary_articles_issue_id
  RENAME TO idx_secondary_articles_campaign_id;

ALTER INDEX IF EXISTS idx_rss_posts_issue_id
  RENAME TO idx_rss_posts_campaign_id;

ALTER INDEX IF EXISTS idx_ai_apps_selection_issue_id
  RENAME TO idx_ai_apps_selection_campaign_id;

ALTER INDEX IF EXISTS idx_archived_newsletters_issue_id
  RENAME TO idx_archived_newsletters_campaign_id;

ALTER INDEX IF EXISTS idx_email_metrics_issue_id
  RENAME TO idx_email_metrics_campaign_id;

-- ============================================================
-- STEP 6: Restore Enum Type
-- ============================================================

-- Rename IssueStatus enum type back to CampaignStatus if it was renamed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issuestatus') THEN
    ALTER TYPE issuestatus RENAME TO campaignstatus;
    RAISE NOTICE 'Renamed issuestatus enum back to campaignstatus';
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
END $$;

-- Verify row counts match
INSERT INTO rollback_verification
SELECT
  'newsletter_campaigns' as table_name,
  (SELECT COUNT(*) FROM newsletter_campaigns) as row_count;

-- Display verification results
SELECT * FROM rollback_verification;

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
  AND (kcu.column_name = 'campaign_id' OR ccu.table_name = 'newsletter_campaigns')
ORDER BY tc.table_name;

COMMIT;

-- ============================================================
-- ROLLBACK COMPLETE
-- ============================================================

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
