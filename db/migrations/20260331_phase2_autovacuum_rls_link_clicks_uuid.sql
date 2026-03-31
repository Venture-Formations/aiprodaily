-- Phase 2: Database Optimization (Medium Effort, High Value)
-- Deploy to staging first, then production.
--
-- Changes:
--   2a. Tune autovacuum on high-churn tables
--   2b. Enable RLS on 5 system config tables (service_role only)
--   2c. SKIPPED — audit found no actual duplicate policies to consolidate
--   2d. Convert link_clicks.issue_id from TEXT to UUID
--
-- NOTE: Section 2d rewrites the link_clicks table (~168K rows, ~94MB).
-- This takes a brief exclusive lock (a few seconds). Schedule during low traffic.

-- ============================================================
-- 2a. Tune Autovacuum on High-Churn Tables
-- ============================================================

-- mailerlite_field_updates: ~190K rows/week, needs aggressive vacuuming
ALTER TABLE mailerlite_field_updates SET (
  autovacuum_vacuum_scale_factor = 0.01,
  autovacuum_analyze_scale_factor = 0.01,
  autovacuum_vacuum_cost_delay = 2
);

-- subscriber_real_click_status: frequent updates, reduce page splits
ALTER TABLE subscriber_real_click_status SET (fillfactor = 80);

-- ============================================================
-- 2b. Enable RLS on 5 System Config Tables
-- ============================================================
-- These tables have no publication_id — they are system-level config.
-- Only service_role should have access.

-- combined_feed_sources
ALTER TABLE combined_feed_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on combined_feed_sources"
  ON combined_feed_sources FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- combined_feed_excluded_sources
ALTER TABLE combined_feed_excluded_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on combined_feed_excluded_sources"
  ON combined_feed_excluded_sources FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- combined_feed_settings
ALTER TABLE combined_feed_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on combined_feed_settings"
  ON combined_feed_settings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- congress_feed_articles
ALTER TABLE congress_feed_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on congress_feed_articles"
  ON congress_feed_articles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- congress_approved_sources
ALTER TABLE congress_approved_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on congress_approved_sources"
  ON congress_approved_sources FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 2d. Convert link_clicks.issue_id TEXT -> UUID
-- ============================================================
-- All 155K non-null values are valid UUIDs (verified).
-- This rewrites the table (~168K rows). Takes a few seconds.
-- NOTE: ALTER COLUMN TYPE drops dependent indexes — must recreate them after.
-- NOTE: Must drop FK to publication_issues.id (TEXT) first. FK will be
-- re-established when publication_issues.id is migrated to UUID.

ALTER TABLE link_clicks DROP CONSTRAINT IF EXISTS link_clicks_issue_id_fkey;

ALTER TABLE link_clicks
  ALTER COLUMN issue_id TYPE uuid USING issue_id::uuid;

-- Recreate indexes that were dropped by ALTER COLUMN TYPE
CREATE INDEX IF NOT EXISTS idx_link_clicks_issue
  ON link_clicks (issue_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_velocity
  ON link_clicks (ip_address, issue_id, clicked_at DESC)
  WHERE (ip_address IS NOT NULL);
