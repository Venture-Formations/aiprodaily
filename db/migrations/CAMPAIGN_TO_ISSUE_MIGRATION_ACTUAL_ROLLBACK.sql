-- ============================================================
-- CAMPAIGN → ISSUE MIGRATION ROLLBACK (ACTUAL DATABASE)
-- ============================================================
-- Purpose: Revert publication_issues back to newsletter_campaigns
-- Risk Level: HIGH - Use only if critical issues found
-- Based on: Actual database schema (18 tables with issue_id)
-- ============================================================

-- WHEN TO USE:
-- [ ] Critical production bugs after migration
-- [ ] Data integrity issues discovered
-- [ ] Need to revert to original state

BEGIN;

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '⚠️  STARTING ROLLBACK PROCESS';
  RAISE NOTICE '========================================';
END $$;

-- Record row counts
CREATE TEMP TABLE rollback_verification (
  table_name TEXT,
  row_count BIGINT
);

INSERT INTO rollback_verification VALUES
  ('publication_issues', (SELECT COUNT(*) FROM publication_issues));

-- ============================================================
-- STEP 1: Rename Columns Back (Child Tables)
-- ============================================================

-- archived_articles
DO $$
BEGIN
  ALTER TABLE archived_articles RENAME COLUMN issue_id TO campaign_id;
  ALTER TABLE archived_articles RENAME COLUMN issue_date TO campaign_date;
  RAISE NOTICE '✓ Reverted columns in archived_articles';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not revert archived_articles: %', SQLERRM;
END $$;

-- archived_newsletters
DO $$
BEGIN
  ALTER TABLE archived_newsletters RENAME COLUMN issue_id TO campaign_id;
  ALTER TABLE archived_newsletters RENAME COLUMN issue_date TO campaign_date;
  ALTER TABLE archived_newsletters RENAME COLUMN issue_status TO campaign_status;
  RAISE NOTICE '✓ Reverted columns in archived_newsletters';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not revert archived_newsletters: %', SQLERRM;
END $$;

-- archived_rss_posts
DO $$
BEGIN
  ALTER TABLE archived_rss_posts RENAME COLUMN issue_id TO campaign_id;
  RAISE NOTICE '✓ Reverted issue_id in archived_rss_posts';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not revert archived_rss_posts: %', SQLERRM;
END $$;

-- archived_secondary_articles
DO $$
BEGIN
  ALTER TABLE archived_secondary_articles RENAME COLUMN issue_id TO campaign_id;
  RAISE NOTICE '✓ Reverted issue_id in archived_secondary_articles';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not revert archived_secondary_articles: %', SQLERRM;
END $$;

-- articles
DO $$
BEGIN
  ALTER TABLE articles RENAME COLUMN issue_id TO campaign_id;
  RAISE NOTICE '✓ Reverted issue_id in articles';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not revert articles: %', SQLERRM;
END $$;

-- issue_advertisements → campaign_advertisements
DO $$
BEGIN
  ALTER TABLE issue_advertisements RENAME COLUMN issue_id TO campaign_id;
  ALTER TABLE issue_advertisements RENAME TO campaign_advertisements;
  RAISE NOTICE '✓ Reverted issue_advertisements to campaign_advertisements';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not revert issue_advertisements: %', SQLERRM;
END $$;

-- issue_ai_app_selections → campaign_ai_app_selections
DO $$
BEGIN
  ALTER TABLE issue_ai_app_selections RENAME COLUMN issue_id TO campaign_id;
  ALTER TABLE issue_ai_app_selections RENAME TO campaign_ai_app_selections;
  RAISE NOTICE '✓ Reverted issue_ai_app_selections to campaign_ai_app_selections';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not revert issue_ai_app_selections: %', SQLERRM;
END $$;

-- issue_breaking_news → campaign_breaking_news
DO $$
BEGIN
  ALTER TABLE issue_breaking_news RENAME COLUMN issue_id TO campaign_id;
  ALTER TABLE issue_breaking_news RENAME TO campaign_breaking_news;
  RAISE NOTICE '✓ Reverted issue_breaking_news to campaign_breaking_news';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not revert issue_breaking_news: %', SQLERRM;
END $$;

-- issue_events → campaign_events
DO $$
BEGIN
  ALTER TABLE issue_events RENAME COLUMN issue_id TO campaign_id;
  ALTER TABLE issue_events RENAME TO campaign_events;
  RAISE NOTICE '✓ Reverted issue_events to campaign_events';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not revert issue_events: %', SQLERRM;
END $$;

-- issue_prompt_selections → campaign_prompt_selections
DO $$
BEGIN
  ALTER TABLE issue_prompt_selections RENAME COLUMN issue_id TO campaign_id;
  ALTER TABLE issue_prompt_selections RENAME TO campaign_prompt_selections;
  RAISE NOTICE '✓ Reverted issue_prompt_selections to campaign_prompt_selections';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not revert issue_prompt_selections: %', SQLERRM;
END $$;

-- duplicate_groups
DO $$
BEGIN
  ALTER TABLE duplicate_groups RENAME COLUMN issue_id TO campaign_id;
  RAISE NOTICE '✓ Reverted issue_id in duplicate_groups';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not revert duplicate_groups: %', SQLERRM;
END $$;

-- email_metrics
DO $$
BEGIN
  ALTER TABLE email_metrics RENAME COLUMN issue_id TO campaign_id;
  ALTER TABLE email_metrics RENAME COLUMN mailerlite_issue_id TO mailerlite_campaign_id;
  RAISE NOTICE '✓ Reverted columns in email_metrics';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not revert email_metrics: %', SQLERRM;
END $$;

-- link_clicks
DO $$
BEGIN
  ALTER TABLE link_clicks RENAME COLUMN issue_id TO campaign_id;
  ALTER TABLE link_clicks RENAME COLUMN issue_date TO campaign_date;
  RAISE NOTICE '✓ Reverted columns in link_clicks';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not revert link_clicks: %', SQLERRM;
END $$;

-- manual_articles
DO $$
BEGIN
  ALTER TABLE manual_articles RENAME COLUMN issue_id TO campaign_id;
  RAISE NOTICE '✓ Reverted issue_id in manual_articles';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not revert manual_articles: %', SQLERRM;
END $$;

-- rss_posts
DO $$
BEGIN
  ALTER TABLE rss_posts RENAME COLUMN issue_id TO campaign_id;
  RAISE NOTICE '✓ Reverted issue_id in rss_posts';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not revert rss_posts: %', SQLERRM;
END $$;

-- secondary_articles
DO $$
BEGIN
  ALTER TABLE secondary_articles RENAME COLUMN issue_id TO campaign_id;
  RAISE NOTICE '✓ Reverted issue_id in secondary_articles';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not revert secondary_articles: %', SQLERRM;
END $$;

-- user_activities
DO $$
BEGIN
  ALTER TABLE user_activities RENAME COLUMN issue_id TO campaign_id;
  RAISE NOTICE '✓ Reverted issue_id in user_activities';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not revert user_activities: %', SQLERRM;
END $$;

-- ============================================================
-- STEP 2: Rename Primary Table Back
-- ============================================================

DO $$
BEGIN
  ALTER TABLE publication_issues RENAME TO newsletter_campaigns;
  RAISE NOTICE '✓ Reverted publication_issues to newsletter_campaigns';
END $$;

-- ============================================================
-- STEP 3: Restore Indexes on Main Table
-- ============================================================

DO $$
BEGIN
  ALTER INDEX IF EXISTS publication_issues_pkey RENAME TO newsletter_campaigns_pkey;
  ALTER INDEX IF EXISTS idx_issues_date RENAME TO idx_campaigns_date;
  ALTER INDEX IF EXISTS idx_issues_publication RENAME TO idx_campaigns_publication;
  ALTER INDEX IF EXISTS idx_issues_status RENAME TO idx_campaigns_status;
  ALTER INDEX IF EXISTS idx_issues_workflow_state RENAME TO idx_campaigns_workflow_state;
  ALTER INDEX IF EXISTS idx_issues_failed_unalerted RENAME TO idx_campaigns_failed_unalerted;

  RAISE NOTICE '✓ Reverted indexes on newsletter_campaigns';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not revert some main table indexes: %', SQLERRM;
END $$;

-- ============================================================
-- STEP 4: Restore Foreign Key Constraints
-- ============================================================

DO $$
BEGIN
  ALTER TABLE newsletter_campaigns DROP CONSTRAINT IF EXISTS publication_issues_publication_id_fkey;
  ALTER TABLE newsletter_campaigns ADD CONSTRAINT newsletter_campaigns_publication_id_fkey
    FOREIGN KEY (publication_id) REFERENCES publications(id) ON DELETE CASCADE;
  RAISE NOTICE '✓ Restored FK on newsletter_campaigns';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not restore FK on newsletter_campaigns: %', SQLERRM;
END $$;

-- Restore FK constraints on all child tables
DO $$
DECLARE
  table_names TEXT[] := ARRAY[
    'articles', 'secondary_articles', 'rss_posts', 'manual_articles',
    'archived_articles', 'archived_newsletters', 'archived_rss_posts',
    'archived_secondary_articles', 'duplicate_groups', 'email_metrics',
    'link_clicks', 'user_activities', 'campaign_advertisements',
    'campaign_ai_app_selections', 'campaign_breaking_news',
    'campaign_events', 'campaign_prompt_selections'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY table_names
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',
        tbl, tbl || '_issue_id_fkey');
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE',
        tbl, tbl || '_campaign_id_fkey');
      RAISE NOTICE '✓ Restored FK for %', tbl;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not restore FK for %: %', tbl, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================
-- STEP 5: Restore Indexes on Child Tables
-- ============================================================

DO $$
BEGIN
  -- Main indexes
  ALTER INDEX IF EXISTS idx_archived_articles_issue RENAME TO idx_archived_articles_campaign;
  ALTER INDEX IF EXISTS idx_archived_articles_issue_date RENAME TO idx_archived_articles_date;
  ALTER INDEX IF EXISTS idx_archived_newsletters_issue_date RENAME TO idx_archived_newsletters_date;
  ALTER INDEX IF EXISTS idx_archived_rss_posts_issue RENAME TO idx_archived_rss_posts_campaign;
  ALTER INDEX IF EXISTS idx_archived_secondary_articles_issue RENAME TO idx_archived_secondary_articles_campaign;
  ALTER INDEX IF EXISTS idx_articles_issue RENAME TO idx_articles_campaign;
  ALTER INDEX IF EXISTS idx_issue_ads_issue RENAME TO idx_campaign_ads_campaign;
  ALTER INDEX IF EXISTS idx_issue_apps_issue RENAME TO idx_campaign_apps_campaign;
  ALTER INDEX IF EXISTS idx_issue_breaking_news_issue RENAME TO idx_campaign_breaking_news_campaign;
  ALTER INDEX IF EXISTS idx_issue_breaking_news_section RENAME TO idx_campaign_breaking_news_section;
  ALTER INDEX IF EXISTS idx_issue_events_issue RENAME TO idx_campaign_events_campaign;
  ALTER INDEX IF EXISTS idx_issue_events_event RENAME TO idx_campaign_events_event;
  ALTER INDEX IF EXISTS idx_issue_prompts_issue RENAME TO idx_campaign_prompts_campaign;
  ALTER INDEX IF EXISTS idx_duplicate_groups_issue_id RENAME TO idx_duplicate_groups_campaign_id;
  ALTER INDEX IF EXISTS idx_email_metrics_issue RENAME TO idx_email_metrics_campaign;
  ALTER INDEX IF EXISTS idx_link_clicks_issue RENAME TO idx_link_clicks_campaign;
  ALTER INDEX IF EXISTS idx_link_clicks_issue_date RENAME TO idx_link_clicks_date;
  ALTER INDEX IF EXISTS idx_manual_articles_issue RENAME TO idx_manual_articles_campaign;
  ALTER INDEX IF EXISTS idx_rss_posts_issue RENAME TO idx_rss_posts_campaign;
  ALTER INDEX IF EXISTS idx_rss_posts_issue_priority RENAME TO idx_rss_posts_campaign_priority;
  ALTER INDEX IF EXISTS idx_secondary_articles_issue RENAME TO idx_secondary_articles_campaign;
  ALTER INDEX IF EXISTS idx_user_activities_issue RENAME TO idx_user_activities_campaign;

  -- Primary keys and unique constraints
  ALTER INDEX IF EXISTS issue_advertisements_pkey RENAME TO campaign_advertisements_pkey;
  ALTER INDEX IF EXISTS issue_ai_app_selections_pkey RENAME TO campaign_ai_app_selections_pkey;
  ALTER INDEX IF EXISTS issue_ai_app_selections_issue_id_app_id_key RENAME TO campaign_ai_app_selections_campaign_id_app_id_key;
  ALTER INDEX IF EXISTS issue_ai_app_selections_issue_id_selection_order_key RENAME TO campaign_ai_app_selections_campaign_id_selection_order_key;
  ALTER INDEX IF EXISTS issue_breaking_news_pkey RENAME TO campaign_breaking_news_pkey;
  ALTER INDEX IF EXISTS issue_breaking_news_issue_id_post_id_key RENAME TO campaign_breaking_news_campaign_id_post_id_key;
  ALTER INDEX IF EXISTS issue_events_pkey RENAME TO campaign_events_pkey;
  ALTER INDEX IF EXISTS issue_prompt_selections_pkey RENAME TO campaign_prompt_selections_pkey;
  ALTER INDEX IF EXISTS issue_prompt_selections_issue_id_prompt_id_key RENAME TO campaign_prompt_selections_campaign_id_prompt_id_key;
  ALTER INDEX IF EXISTS issue_prompt_selections_issue_id_selection_order_key RENAME TO campaign_prompt_selections_campaign_id_selection_order_key;
  ALTER INDEX IF EXISTS archived_newsletters_issue_id_key RENAME TO archived_newsletters_campaign_id_key;
  ALTER INDEX IF EXISTS archived_newsletters_publication_id_issue_date_key RENAME TO archived_newsletters_publication_id_campaign_date_key;

  RAISE NOTICE '✓ Reverted all child table indexes';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not revert some child table indexes: %', SQLERRM;
END $$;

-- ============================================================
-- STEP 6: Verification
-- ============================================================

INSERT INTO rollback_verification VALUES
  ('newsletter_campaigns', (SELECT COUNT(*) FROM newsletter_campaigns));

DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '=== ROLLBACK VERIFICATION ===';
  FOR rec IN SELECT * FROM rollback_verification ORDER BY table_name
  LOOP
    RAISE NOTICE 'Table: % | Rows: %', rec.table_name, rec.row_count;
  END LOOP;
  RAISE NOTICE '========================================';
END $$;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ ROLLBACK COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'All tables and columns reverted to campaign naming';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Revert code changes';
  RAISE NOTICE '2. Redeploy previous version';
  RAISE NOTICE '3. Investigate root cause';
  RAISE NOTICE '========================================';
END $$;
