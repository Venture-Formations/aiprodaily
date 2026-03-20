-- Migration: Fix audit findings (indexes, RLS, search_path, triggers)
-- Date: 2026-03-20
-- Purpose: Address HIGH/MEDIUM/LOW issues found during database audit
--
-- Fixes:
--   1. Missing partial indexes on ticker columns (rss_posts, module_articles)
--   2. Missing index on congress_trades.name for get_distinct_congress_members RPC
--   3. Missing RLS + policy on article_images
--   4. Missing RLS + policies on congress_trades and related tables
--   5. Missing SET search_path on get_distinct_congress_members RPC
--   6. Missing updated_at trigger on article_images

-- ============================================================
-- 1. Missing partial indexes on ticker columns (HIGH)
-- ============================================================
-- rss_posts.ticker is queried for trade-based article matching
CREATE INDEX IF NOT EXISTS idx_rss_posts_ticker
  ON rss_posts(ticker)
  WHERE ticker IS NOT NULL;

-- module_articles.ticker is queried for dedup and display grouping
CREATE INDEX IF NOT EXISTS idx_module_articles_ticker
  ON module_articles(ticker)
  WHERE ticker IS NOT NULL;

-- ============================================================
-- 2. Missing index on congress_trades.name (HIGH)
-- ============================================================
-- get_distinct_congress_members() does DISTINCT ON (name) ORDER BY name
-- on 110K+ rows; this index eliminates a full sequential scan
CREATE INDEX IF NOT EXISTS idx_congress_trades_name
  ON congress_trades(name);

-- ============================================================
-- 3. Missing RLS on article_images (HIGH)
-- ============================================================
-- Table was created after the 20260311 blanket RLS migration
ALTER TABLE public.article_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS article_images_service_role ON article_images;
CREATE POLICY article_images_service_role ON article_images
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 4. Missing RLS on congress_trades and related tables (MEDIUM)
-- ============================================================
-- Tables created in 20260314 after the 20260311 blanket RLS migration

ALTER TABLE public.congress_trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS congress_trades_service_role ON congress_trades;
CREATE POLICY congress_trades_service_role ON congress_trades
  FOR ALL
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.ticker_company_names ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ticker_company_names_service_role ON ticker_company_names;
CREATE POLICY ticker_company_names_service_role ON ticker_company_names
  FOR ALL
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.combined_feed_excluded_keywords ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS combined_feed_excluded_keywords_service_role ON combined_feed_excluded_keywords;
CREATE POLICY combined_feed_excluded_keywords_service_role ON combined_feed_excluded_keywords
  FOR ALL
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.combined_feed_excluded_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS combined_feed_excluded_companies_service_role ON combined_feed_excluded_companies;
CREATE POLICY combined_feed_excluded_companies_service_role ON combined_feed_excluded_companies
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 5. Fix search_path on get_distinct_congress_members RPC (MEDIUM)
-- ============================================================
-- Recreate with SET search_path = public to satisfy Supabase security linter
CREATE OR REPLACE FUNCTION get_distinct_congress_members()
RETURNS TABLE(name TEXT, party TEXT, state TEXT, chamber TEXT)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT DISTINCT ON (ct.name)
    ct.name, ct.party, ct.state, ct.chamber
  FROM congress_trades ct
  WHERE ct.name IS NOT NULL
  ORDER BY ct.name;
$$;

-- ============================================================
-- 6. Missing updated_at trigger on article_images (LOW)
-- ============================================================
-- Follow the pattern from create_article_modules_system.sql
CREATE OR REPLACE FUNCTION update_article_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION public.update_article_images_updated_at() SET search_path = public;

DROP TRIGGER IF EXISTS set_article_images_updated_at ON article_images;
CREATE TRIGGER set_article_images_updated_at
  BEFORE UPDATE ON article_images
  FOR EACH ROW
  EXECUTE FUNCTION update_article_images_updated_at();

-- ============================================================
-- 7. FK reference note: article_images.publication_id -> newsletters(id)
-- ============================================================
-- The article_images table was created with REFERENCES newsletters(id).
-- The newsletters table was later renamed to publications via
-- rename_newsletters_to_publications.sql. PostgreSQL FK constraints
-- track by OID, so the FK remains valid after the rename. No action needed.

-- ============================================================
-- Summary
-- ============================================================
-- Indexes added:
--   - idx_rss_posts_ticker (partial, WHERE ticker IS NOT NULL)
--   - idx_module_articles_ticker (partial, WHERE ticker IS NOT NULL)
--   - idx_congress_trades_name
-- RLS enabled + service-role policies added:
--   - article_images
--   - congress_trades
--   - ticker_company_names
--   - combined_feed_excluded_keywords
--   - combined_feed_excluded_companies
-- Function updated:
--   - get_distinct_congress_members() — added SET search_path = public
-- Trigger added:
--   - set_article_images_updated_at on article_images
