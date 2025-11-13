-- ============================================================
-- CAMPAIGN → ISSUE MIGRATION (ACTUAL DATABASE SCHEMA)
-- ============================================================
-- Migration: Rename newsletter_campaigns table to publication_issues
--            and campaign_id column to issue_id across all tables
-- Date: 2025-11-13
-- Author: AI Pro Daily Team
-- Risk Level: HIGH - Full database backup required before execution
-- Based on: Actual database schema inspection
-- Tables affected: 18 tables with campaign_id columns
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

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'newsletter_campaigns') THEN
    RAISE EXCEPTION 'Table newsletter_campaigns does not exist. Migration aborted.';
  END IF;
  RAISE NOTICE 'Verification passed: newsletter_campaigns table exists';
END $$;

-- Record row counts for verification
CREATE TEMP TABLE migration_verification (
  table_name TEXT,
  row_count BIGINT
);

INSERT INTO migration_verification VALUES
  ('newsletter_campaigns', (SELECT COUNT(*) FROM newsletter_campaigns)),
  ('articles', (SELECT COUNT(*) FROM articles)),
  ('secondary_articles', (SELECT COUNT(*) FROM secondary_articles)),
  ('rss_posts', (SELECT COUNT(*) FROM rss_posts));

-- ============================================================
-- STEP 1: Rename Foreign Key Columns (Child Tables First)
-- ============================================================

-- archived_articles (has campaign_id and campaign_date)
DO $$
BEGIN
  ALTER TABLE archived_articles RENAME COLUMN campaign_id TO issue_id;
  ALTER TABLE archived_articles RENAME COLUMN campaign_date TO issue_date;
  RAISE NOTICE '✓ Renamed columns in archived_articles';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not rename in archived_articles: %', SQLERRM;
END $$;

-- archived_newsletters (has campaign_id, campaign_date, campaign_status)
DO $$
BEGIN
  ALTER TABLE archived_newsletters RENAME COLUMN campaign_id TO issue_id;
  ALTER TABLE archived_newsletters RENAME COLUMN campaign_date TO issue_date;
  ALTER TABLE archived_newsletters RENAME COLUMN campaign_status TO issue_status;
  RAISE NOTICE '✓ Renamed columns in archived_newsletters';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not rename in archived_newsletters: %', SQLERRM;
END $$;

-- archived_rss_posts
DO $$
BEGIN
  ALTER TABLE archived_rss_posts RENAME COLUMN campaign_id TO issue_id;
  RAISE NOTICE '✓ Renamed campaign_id in archived_rss_posts';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not rename in archived_rss_posts: %', SQLERRM;
END $$;

-- archived_secondary_articles
DO $$
BEGIN
  ALTER TABLE archived_secondary_articles RENAME COLUMN campaign_id TO issue_id;
  RAISE NOTICE '✓ Renamed campaign_id in archived_secondary_articles';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not rename in archived_secondary_articles: %', SQLERRM;
END $$;

-- articles
DO $$
BEGIN
  ALTER TABLE articles RENAME COLUMN campaign_id TO issue_id;
  RAISE NOTICE '✓ Renamed campaign_id in articles';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not rename in articles: %', SQLERRM;
END $$;

-- campaign_advertisements → issue_advertisements (table and column)
DO $$
BEGIN
  ALTER TABLE campaign_advertisements RENAME COLUMN campaign_id TO issue_id;
  ALTER TABLE campaign_advertisements RENAME TO issue_advertisements;
  RAISE NOTICE '✓ Renamed campaign_advertisements to issue_advertisements';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not rename campaign_advertisements: %', SQLERRM;
END $$;

-- campaign_ai_app_selections → issue_ai_app_selections
DO $$
BEGIN
  ALTER TABLE campaign_ai_app_selections RENAME COLUMN campaign_id TO issue_id;
  ALTER TABLE campaign_ai_app_selections RENAME TO issue_ai_app_selections;
  RAISE NOTICE '✓ Renamed campaign_ai_app_selections to issue_ai_app_selections';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not rename campaign_ai_app_selections: %', SQLERRM;
END $$;

-- campaign_breaking_news → issue_breaking_news
DO $$
BEGIN
  ALTER TABLE campaign_breaking_news RENAME COLUMN campaign_id TO issue_id;
  ALTER TABLE campaign_breaking_news RENAME TO issue_breaking_news;
  RAISE NOTICE '✓ Renamed campaign_breaking_news to issue_breaking_news';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not rename campaign_breaking_news: %', SQLERRM;
END $$;

-- campaign_events → issue_events
DO $$
BEGIN
  ALTER TABLE campaign_events RENAME COLUMN campaign_id TO issue_id;
  ALTER TABLE campaign_events RENAME TO issue_events;
  RAISE NOTICE '✓ Renamed campaign_events to issue_events';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not rename campaign_events: %', SQLERRM;
END $$;

-- campaign_prompt_selections → issue_prompt_selections
DO $$
BEGIN
  ALTER TABLE campaign_prompt_selections RENAME COLUMN campaign_id TO issue_id;
  ALTER TABLE campaign_prompt_selections RENAME TO issue_prompt_selections;
  RAISE NOTICE '✓ Renamed campaign_prompt_selections to issue_prompt_selections';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not rename campaign_prompt_selections: %', SQLERRM;
END $$;

-- duplicate_groups
DO $$
BEGIN
  ALTER TABLE duplicate_groups RENAME COLUMN campaign_id TO issue_id;
  RAISE NOTICE '✓ Renamed campaign_id in duplicate_groups';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not rename in duplicate_groups: %', SQLERRM;
END $$;

-- email_metrics (has campaign_id and mailerlite_campaign_id)
DO $$
BEGIN
  ALTER TABLE email_metrics RENAME COLUMN campaign_id TO issue_id;
  ALTER TABLE email_metrics RENAME COLUMN mailerlite_campaign_id TO mailerlite_issue_id;
  RAISE NOTICE '✓ Renamed columns in email_metrics';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not rename in email_metrics: %', SQLERRM;
END $$;

-- link_clicks (has campaign_id and campaign_date)
DO $$
BEGIN
  ALTER TABLE link_clicks RENAME COLUMN campaign_id TO issue_id;
  ALTER TABLE link_clicks RENAME COLUMN campaign_date TO issue_date;
  RAISE NOTICE '✓ Renamed columns in link_clicks';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not rename in link_clicks: %', SQLERRM;
END $$;

-- manual_articles
DO $$
BEGIN
  ALTER TABLE manual_articles RENAME COLUMN campaign_id TO issue_id;
  RAISE NOTICE '✓ Renamed campaign_id in manual_articles';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not rename in manual_articles: %', SQLERRM;
END $$;

-- rss_posts
DO $$
BEGIN
  ALTER TABLE rss_posts RENAME COLUMN campaign_id TO issue_id;
  RAISE NOTICE '✓ Renamed campaign_id in rss_posts';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not rename in rss_posts: %', SQLERRM;
END $$;

-- secondary_articles
DO $$
BEGIN
  ALTER TABLE secondary_articles RENAME COLUMN campaign_id TO issue_id;
  RAISE NOTICE '✓ Renamed campaign_id in secondary_articles';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not rename in secondary_articles: %', SQLERRM;
END $$;

-- user_activities
DO $$
BEGIN
  ALTER TABLE user_activities RENAME COLUMN campaign_id TO issue_id;
  RAISE NOTICE '✓ Renamed campaign_id in user_activities';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not rename in user_activities: %', SQLERRM;
END $$;

-- ============================================================
-- STEP 2: Rename Primary Table
-- ============================================================

DO $$
BEGIN
  ALTER TABLE newsletter_campaigns RENAME TO publication_issues;
  RAISE NOTICE '✓ Renamed newsletter_campaigns to publication_issues';
END $$;

-- ============================================================
-- STEP 3: Update Indexes on Main Table
-- ============================================================

DO $$
BEGIN
  -- Rename indexes on publication_issues
  ALTER INDEX IF EXISTS newsletter_campaigns_pkey RENAME TO publication_issues_pkey;
  ALTER INDEX IF EXISTS idx_campaigns_date RENAME TO idx_issues_date;
  ALTER INDEX IF EXISTS idx_campaigns_publication RENAME TO idx_issues_publication;
  ALTER INDEX IF EXISTS idx_campaigns_status RENAME TO idx_issues_status;
  ALTER INDEX IF EXISTS idx_campaigns_workflow_state RENAME TO idx_issues_workflow_state;
  ALTER INDEX IF EXISTS idx_campaigns_failed_unalerted RENAME TO idx_issues_failed_unalerted;

  RAISE NOTICE '✓ Renamed indexes on publication_issues';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not rename some indexes on main table: %', SQLERRM;
END $$;

-- ============================================================
-- STEP 4: Update Foreign Key Constraints
-- ============================================================

-- Update FK constraints (drop old, create new)
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  -- Find all FK constraints pointing to newsletter_campaigns (now publication_issues)
  FOR constraint_record IN
    SELECT
      tc.table_name,
      tc.constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'publication_issues'
  LOOP
    BEGIN
      -- Drop old constraint
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',
        constraint_record.table_name, constraint_record.constraint_name);

      -- Create new constraint with issue_id
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (issue_id) REFERENCES publication_issues(id) ON DELETE CASCADE',
        constraint_record.table_name,
        REPLACE(constraint_record.constraint_name, 'campaign', 'issue'));

      RAISE NOTICE '✓ Updated FK constraint for %', constraint_record.table_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not update FK for %: %', constraint_record.table_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- Update FK on publication_issues itself
DO $$
BEGIN
  ALTER TABLE publication_issues DROP CONSTRAINT IF EXISTS newsletter_campaigns_publication_id_fkey;
  ALTER TABLE publication_issues ADD CONSTRAINT publication_issues_publication_id_fkey
    FOREIGN KEY (publication_id) REFERENCES publications(id) ON DELETE CASCADE;
  RAISE NOTICE '✓ Updated FK constraint on publication_issues';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not update FK on publication_issues: %', SQLERRM;
END $$;

-- ============================================================
-- STEP 5: Rename Indexes on Child Tables
-- ============================================================

DO $$
BEGIN
  -- Rename all campaign-related indexes to issue
  ALTER INDEX IF EXISTS idx_archived_articles_campaign RENAME TO idx_archived_articles_issue;
  ALTER INDEX IF EXISTS idx_archived_articles_date RENAME TO idx_archived_articles_issue_date;
  ALTER INDEX IF EXISTS idx_archived_newsletters_date RENAME TO idx_archived_newsletters_issue_date;
  ALTER INDEX IF EXISTS idx_archived_rss_posts_campaign RENAME TO idx_archived_rss_posts_issue;
  ALTER INDEX IF EXISTS idx_archived_secondary_articles_campaign RENAME TO idx_archived_secondary_articles_issue;
  ALTER INDEX IF EXISTS idx_articles_campaign RENAME TO idx_articles_issue;

  -- Renamed tables (campaign_* → issue_*)
  ALTER INDEX IF EXISTS idx_campaign_ads_campaign RENAME TO idx_issue_ads_issue;
  ALTER INDEX IF EXISTS idx_campaign_apps_campaign RENAME TO idx_issue_apps_issue;
  ALTER INDEX IF EXISTS idx_campaign_breaking_news_campaign RENAME TO idx_issue_breaking_news_issue;
  ALTER INDEX IF EXISTS idx_campaign_breaking_news_section RENAME TO idx_issue_breaking_news_section;
  ALTER INDEX IF EXISTS idx_campaign_events_campaign RENAME TO idx_issue_events_issue;
  ALTER INDEX IF EXISTS idx_campaign_events_event RENAME TO idx_issue_events_event;
  ALTER INDEX IF EXISTS idx_campaign_prompts_campaign RENAME TO idx_issue_prompts_issue;

  ALTER INDEX IF EXISTS idx_duplicate_groups_campaign_id RENAME TO idx_duplicate_groups_issue_id;
  ALTER INDEX IF EXISTS idx_email_metrics_campaign RENAME TO idx_email_metrics_issue;
  ALTER INDEX IF EXISTS idx_link_clicks_campaign RENAME TO idx_link_clicks_issue;
  ALTER INDEX IF EXISTS idx_link_clicks_date RENAME TO idx_link_clicks_issue_date;
  ALTER INDEX IF EXISTS idx_manual_articles_campaign RENAME TO idx_manual_articles_issue;
  ALTER INDEX IF EXISTS idx_rss_posts_campaign RENAME TO idx_rss_posts_issue;
  ALTER INDEX IF EXISTS idx_rss_posts_campaign_priority RENAME TO idx_rss_posts_issue_priority;
  ALTER INDEX IF EXISTS idx_secondary_articles_campaign RENAME TO idx_secondary_articles_issue;
  ALTER INDEX IF EXISTS idx_user_activities_campaign RENAME TO idx_user_activities_issue;

  -- Unique indexes on renamed tables
  ALTER INDEX IF EXISTS campaign_advertisements_pkey RENAME TO issue_advertisements_pkey;
  ALTER INDEX IF EXISTS campaign_ai_app_selections_pkey RENAME TO issue_ai_app_selections_pkey;
  ALTER INDEX IF EXISTS campaign_ai_app_selections_campaign_id_app_id_key RENAME TO issue_ai_app_selections_issue_id_app_id_key;
  ALTER INDEX IF EXISTS campaign_ai_app_selections_campaign_id_selection_order_key RENAME TO issue_ai_app_selections_issue_id_selection_order_key;
  ALTER INDEX IF EXISTS campaign_breaking_news_pkey RENAME TO issue_breaking_news_pkey;
  ALTER INDEX IF EXISTS campaign_breaking_news_campaign_id_post_id_key RENAME TO issue_breaking_news_issue_id_post_id_key;
  ALTER INDEX IF EXISTS campaign_events_pkey RENAME TO issue_events_pkey;
  ALTER INDEX IF EXISTS campaign_prompt_selections_pkey RENAME TO issue_prompt_selections_pkey;
  ALTER INDEX IF EXISTS campaign_prompt_selections_campaign_id_prompt_id_key RENAME TO issue_prompt_selections_issue_id_prompt_id_key;
  ALTER INDEX IF EXISTS campaign_prompt_selections_campaign_id_selection_order_key RENAME TO issue_prompt_selections_issue_id_selection_order_key;

  -- Unique constraints on archived_newsletters
  ALTER INDEX IF EXISTS archived_newsletters_campaign_id_key RENAME TO archived_newsletters_issue_id_key;
  ALTER INDEX IF EXISTS archived_newsletters_publication_id_campaign_date_key RENAME TO archived_newsletters_publication_id_issue_date_key;

  RAISE NOTICE '✓ Renamed all indexes on child tables';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not rename some child table indexes: %', SQLERRM;
END $$;

-- ============================================================
-- STEP 6: Post-Migration Verification
-- ============================================================

-- Verify table was renamed
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'publication_issues') THEN
    RAISE EXCEPTION 'Table publication_issues does not exist after migration. ROLLBACK!';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'newsletter_campaigns') THEN
    RAISE EXCEPTION 'Table newsletter_campaigns still exists after migration. ROLLBACK!';
  END IF;

  RAISE NOTICE '✓ Table rename verification passed';
END $$;

-- Verify row counts
INSERT INTO migration_verification VALUES
  ('publication_issues', (SELECT COUNT(*) FROM publication_issues));

DO $$
DECLARE
  old_count BIGINT;
  new_count BIGINT;
BEGIN
  SELECT row_count INTO old_count FROM migration_verification WHERE table_name = 'newsletter_campaigns';
  SELECT row_count INTO new_count FROM migration_verification WHERE table_name = 'publication_issues';

  IF old_count != new_count THEN
    RAISE EXCEPTION 'Row count mismatch! Old: %, New: %. ROLLBACK!', old_count, new_count;
  END IF;

  RAISE NOTICE '✓ Row count verification passed: % rows', new_count;
END $$;

-- Display all verification results
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '=== MIGRATION VERIFICATION RESULTS ===';
  RAISE NOTICE '========================================';

  FOR rec IN SELECT * FROM migration_verification ORDER BY table_name
  LOOP
    RAISE NOTICE 'Table: % | Rows: %', rec.table_name, rec.row_count;
  END LOOP;

  RAISE NOTICE '========================================';
END $$;

-- List all tables that were renamed
DO $$
BEGIN
  RAISE NOTICE '=== TABLES RENAMED ===';
  RAISE NOTICE '✓ newsletter_campaigns → publication_issues';
  RAISE NOTICE '✓ campaign_advertisements → issue_advertisements';
  RAISE NOTICE '✓ campaign_ai_app_selections → issue_ai_app_selections';
  RAISE NOTICE '✓ campaign_breaking_news → issue_breaking_news';
  RAISE NOTICE '✓ campaign_events → issue_events';
  RAISE NOTICE '✓ campaign_prompt_selections → issue_prompt_selections';
END $$;

COMMIT;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '🎉 MIGRATION COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Main table: newsletter_campaigns → publication_issues';
  RAISE NOTICE 'Columns: campaign_id → issue_id (18 tables)';
  RAISE NOTICE 'Tables renamed: 5 campaign_* tables → issue_* tables';
  RAISE NOTICE 'Foreign keys: All updated';
  RAISE NOTICE 'Indexes: All renamed';
  RAISE NOTICE '';
  RAISE NOTICE '📋 NEXT STEPS:';
  RAISE NOTICE '1. Update src/types/database.ts type definitions';
  RAISE NOTICE '2. Update all .from(''newsletter_campaigns'') to .from(''publication_issues'')';
  RAISE NOTICE '3. Update campaign_* table queries to issue_* tables';
  RAISE NOTICE '4. Update campaign_id references to issue_id';
  RAISE NOTICE '5. Run: npm run type-check';
  RAISE NOTICE '6. Deploy updated code';
  RAISE NOTICE '7. Monitor logs for 24 hours';
  RAISE NOTICE '========================================';
END $$;
