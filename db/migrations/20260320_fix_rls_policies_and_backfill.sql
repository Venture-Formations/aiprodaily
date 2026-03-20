-- Migration: Fix RLS policies to restrict to service_role, backfill single-frequency paid sponsors
-- Date: 2026-03-20

-- ============================================================
-- 1. Fix RLS policies: add TO service_role restriction
-- ============================================================
-- Current policies use USING (true) without TO clause, granting access to all roles.
-- Restrict to service_role only since all app queries use supabaseAdmin.

DROP POLICY IF EXISTS article_images_service_role ON article_images;
CREATE POLICY article_images_service_role ON article_images
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS congress_trades_service_role ON congress_trades;
CREATE POLICY congress_trades_service_role ON congress_trades
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ticker_company_names_service_role ON ticker_company_names;
CREATE POLICY ticker_company_names_service_role ON ticker_company_names
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS combined_feed_excluded_keywords_service_role ON combined_feed_excluded_keywords;
CREATE POLICY combined_feed_excluded_keywords_service_role ON combined_feed_excluded_keywords
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS combined_feed_excluded_companies_service_role ON combined_feed_excluded_companies;
CREATE POLICY combined_feed_excluded_companies_service_role ON combined_feed_excluded_companies
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- 2. Backfill single-frequency paid sponsors into junction table
-- ============================================================
-- The original 20260319 migration only backfilled weekly/monthly sponsors.
-- This catches paid single-frequency (one-off) sponsors so they get paid-first priority.

UPDATE ad_module_advertisers j
SET
  paid = true,
  times_paid = sub.times_paid
FROM (
  SELECT
    ad_module_id,
    advertiser_id,
    MAX(times_paid) AS times_paid
  FROM advertisements
  WHERE paid = true
    AND (frequency = 'single' OR frequency IS NULL)
    AND times_paid > 0
    AND advertiser_id IS NOT NULL
    AND ad_module_id IS NOT NULL
  GROUP BY ad_module_id, advertiser_id
) sub
WHERE j.ad_module_id = sub.ad_module_id
  AND j.advertiser_id = sub.advertiser_id
  AND j.paid = false;
