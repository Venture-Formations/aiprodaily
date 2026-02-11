-- Migration: Company-Based Ad Rotation
-- Creates ad_module_advertisers junction table to track per-module company ordering
-- and internal ad rotation. Changes rotation from individual ads to companies.

-- 1. Create the junction table
CREATE TABLE IF NOT EXISTS ad_module_advertisers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_module_id UUID NOT NULL REFERENCES ad_modules(id) ON DELETE CASCADE,
  advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 1,       -- Company position in module rotation
  next_ad_position INTEGER NOT NULL DEFAULT 1,    -- Which ad is next within this company
  times_used INTEGER NOT NULL DEFAULT 0,          -- For random/priority cycle tracking
  priority INTEGER NOT NULL DEFAULT 0,            -- For priority selection mode
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ad_module_id, advertiser_id)
);

-- 2. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_ad_module_advertisers_module
  ON ad_module_advertisers(ad_module_id);
CREATE INDEX IF NOT EXISTS idx_ad_module_advertisers_advertiser
  ON ad_module_advertisers(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_ad_module_advertisers_module_order
  ON ad_module_advertisers(ad_module_id, display_order);

-- 3. Populate from existing active advertisements
-- Create one junction entry per unique (ad_module_id, advertiser_id) pair
INSERT INTO ad_module_advertisers (ad_module_id, advertiser_id, display_order, times_used)
SELECT
  ad_module_id,
  advertiser_id,
  ROW_NUMBER() OVER (PARTITION BY ad_module_id ORDER BY MIN(display_order) NULLS LAST, MIN(created_at)) AS display_order,
  COALESCE(MAX(a2.times_used), 0) AS times_used
FROM advertisements a2
WHERE ad_module_id IS NOT NULL
  AND advertiser_id IS NOT NULL
  AND status = 'active'
GROUP BY ad_module_id, advertiser_id
ON CONFLICT (ad_module_id, advertiser_id) DO NOTHING;

-- 4. Renumber advertisement display_orders to be sequential per company within each module
-- Each company's ads get sequential ordering starting from 1
WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY ad_module_id, advertiser_id
      ORDER BY display_order NULLS LAST, created_at
    ) AS new_order
  FROM advertisements
  WHERE ad_module_id IS NOT NULL
    AND advertiser_id IS NOT NULL
    AND status = 'active'
)
UPDATE advertisements
SET display_order = numbered.new_order
FROM numbered
WHERE advertisements.id = numbered.id;

-- 5. Reset ad_modules.next_position to 1 for all modules
-- (now tracks company position, not ad position)
UPDATE ad_modules SET next_position = 1;
