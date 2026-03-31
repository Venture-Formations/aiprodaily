-- Phase 3, Q1: Drop Unused Indexes — Batch 1 (15 indexes)
-- All indexes have 0 scans over 6 months (since 2025-10-10).
-- Validated against codebase query patterns.
--
-- Criteria for this batch:
--   - Wrong column combination (code queries different columns)
--   - Legacy/archived tables with no code references
--   - Write-only tables (no SELECT queries)
--   - No FK cascade dependencies
--
-- Total savings: ~888KB index storage + reduced write overhead
-- Deploy to staging first, then production.

-- ============================================================
-- Wrong column combination (queries don't match index columns)
-- ============================================================

-- afteroffers_click_mappings: code queries (publication_id, click_id), not (publication_id, email) — 368KB
DROP INDEX IF EXISTS afteroffers_click_mappings_pub_email_idx;

-- afteroffers_events: similar mismatch — 40KB
DROP INDEX IF EXISTS afteroffers_events_publication_email_idx;

-- ============================================================
-- sendgrid_field_updates: all 4 indexes unused (160+56+56+48=320KB)
-- Planner always seq-scans this table
-- ============================================================

DROP INDEX IF EXISTS idx_sendgrid_updates_click;
DROP INDEX IF EXISTS idx_sendgrid_updates_status;
DROP INDEX IF EXISTS idx_sendgrid_updates_publication;
DROP INDEX IF EXISTS idx_sendgrid_updates_issue;

-- ============================================================
-- Legacy tables (articles table being replaced by module_articles)
-- ============================================================

-- articles.rank — legacy table, non-FK column — 16KB
DROP INDEX IF EXISTS idx_articles_rank;

-- articles.breaking_news_score — legacy table, non-FK column — 16KB
DROP INDEX IF EXISTS idx_articles_breaking_score;

-- ============================================================
-- No code references found
-- ============================================================

-- directory_categories.slug — no queries filter by slug — 16KB
DROP INDEX IF EXISTS idx_directory_categories_slug;

-- combined_feed_sources (is_active, is_excluded) — no code queries — 8KB
DROP INDEX IF EXISTS idx_combined_feed_sources_active;

-- archived_secondary_articles.issue_id — no code references — 8KB
DROP INDEX IF EXISTS idx_archived_secondary_articles_issue;

-- events.active — 0 scans, tiny table — 8KB
DROP INDEX IF EXISTS idx_events_active;

-- ============================================================
-- Write-only table (inserts only, no SELECT queries)
-- ============================================================

-- contact_submissions: only INSERT, never queried — 16KB each
DROP INDEX IF EXISTS idx_contact_submissions_created_at;
DROP INDEX IF EXISTS idx_contact_submissions_status;

-- sparkloop_module_clicks.clicked_at — non-FK, 0 scans — 64KB
DROP INDEX IF EXISTS idx_sparkloop_module_clicks_date;
