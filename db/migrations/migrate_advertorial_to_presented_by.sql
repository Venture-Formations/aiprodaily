-- Migration: Migrate Legacy Advertorial to "Presented By" Ad Module
-- Description: Creates "Presented By" ad module and links existing ads
-- Date: 2024-12-19

-- ============================================
-- 1. Create "Presented By" ad module for each publication that has ads
-- ============================================
INSERT INTO ad_modules (publication_id, name, display_order, is_active, selection_mode, block_order, config)
SELECT DISTINCT
  a.publication_id,
  'Presented By',
  0,  -- First position
  true,
  'sequential',
  '["title", "image", "body", "button"]'::jsonb,
  '{}'::jsonb
FROM advertisements a
WHERE a.publication_id IS NOT NULL
  AND a.ad_module_id IS NULL  -- Only for publications with legacy ads
  AND NOT EXISTS (
    -- Don't create if "Presented By" already exists
    SELECT 1 FROM ad_modules am
    WHERE am.publication_id = a.publication_id
    AND am.name = 'Presented By'
  );

-- ============================================
-- 2. Create advertisers from unique company names if they don't exist
-- ============================================
INSERT INTO advertisers (publication_id, company_name, is_active, created_at)
SELECT DISTINCT
  a.publication_id,
  COALESCE(a.company_name, 'Unknown Advertiser'),
  true,
  NOW()
FROM advertisements a
WHERE a.publication_id IS NOT NULL
  AND a.advertiser_id IS NULL
  AND a.company_name IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM advertisers adv
    WHERE adv.publication_id = a.publication_id
    AND adv.company_name = a.company_name
  )
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. Link legacy ads to the "Presented By" module
-- ============================================
UPDATE advertisements
SET ad_module_id = (
  SELECT id FROM ad_modules
  WHERE publication_id = advertisements.publication_id
  AND name = 'Presented By'
  LIMIT 1
)
WHERE ad_module_id IS NULL
AND publication_id IS NOT NULL;

-- ============================================
-- 4. Link ads to their advertisers
-- ============================================
UPDATE advertisements
SET advertiser_id = (
  SELECT id FROM advertisers
  WHERE publication_id = advertisements.publication_id
  AND company_name = advertisements.company_name
  LIMIT 1
)
WHERE advertiser_id IS NULL
AND company_name IS NOT NULL
AND publication_id IS NOT NULL;

-- ============================================
-- 5. Verify migration
-- ============================================
-- This will show the counts after migration
-- SELECT
--   (SELECT COUNT(*) FROM ad_modules WHERE name = 'Presented By') as presented_by_modules,
--   (SELECT COUNT(*) FROM advertisements WHERE ad_module_id IS NOT NULL) as linked_ads,
--   (SELECT COUNT(*) FROM advertisements WHERE ad_module_id IS NULL) as unlinked_ads,
--   (SELECT COUNT(*) FROM advertisers) as advertisers;
