-- ============================================
-- Hybrid RSS Processing Migration
-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Make campaign_id nullable in rss_posts
-- This allows posts to be ingested without being assigned to a campaign
ALTER TABLE rss_posts
ALTER COLUMN campaign_id DROP NOT NULL;

-- 2. Check for existing duplicates before adding unique constraint
SELECT external_id, COUNT(*)
FROM rss_posts
GROUP BY external_id
HAVING COUNT(*) > 1;

-- 3. Clean up duplicates if they exist (keep oldest post for each external_id)
-- IMPORTANT: Review the output from step 2 first!
-- If duplicates exist, run this:
DELETE FROM rss_posts
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY external_id ORDER BY processed_at ASC) as row_num
    FROM rss_posts
  ) duplicates
  WHERE row_num > 1
);

-- 4. Add unique constraint on external_id to prevent duplicate ingestion during cron runs
ALTER TABLE rss_posts
ADD CONSTRAINT unique_external_id UNIQUE (external_id);

-- 5. Verify changes
SELECT
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_name = 'rss_posts'
AND column_name IN ('campaign_id', 'external_id');
-- Expected: campaign_id is_nullable = 'YES'

SELECT
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'rss_posts'
AND constraint_type = 'UNIQUE';
-- Expected: unique_external_id constraint exists

-- ============================================
-- Migration Complete!
-- Next steps:
-- 1. Deploy ingestion cron endpoint
-- 2. Update vercel.json with 15-minute schedule
-- 3. Test ingestion manually first
-- ============================================
