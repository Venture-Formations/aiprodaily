-- ============================================
-- Unify advertisements table with ad modules system
-- This allows existing ads to be assigned to dynamic ad sections
-- ============================================

-- 1. Add ad_module_id to advertisements table
-- NULL means legacy advertorial (existing behavior)
-- A value links the ad to a specific ad module/section
ALTER TABLE advertisements
ADD COLUMN IF NOT EXISTS ad_module_id UUID REFERENCES ad_modules(id) ON DELETE SET NULL;

-- 2. Add advertiser_id for company-level cooldown tracking (optional)
ALTER TABLE advertisements
ADD COLUMN IF NOT EXISTS advertiser_id UUID REFERENCES advertisers(id) ON DELETE SET NULL;

-- 3. Add priority for priority-based selection mode (higher = shown first)
ALTER TABLE advertisements
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

-- 4. Create index for efficient module queries
CREATE INDEX IF NOT EXISTS idx_advertisements_ad_module_id
ON advertisements(ad_module_id) WHERE ad_module_id IS NOT NULL;

-- 4. Update issue_module_ads to reference advertisements instead of module_ads
-- First drop the old foreign key if it exists
ALTER TABLE issue_module_ads
DROP CONSTRAINT IF EXISTS issue_module_ads_selected_ad_id_fkey;

-- Rename selected_ad_id to advertisement_id for clarity
ALTER TABLE issue_module_ads
RENAME COLUMN selected_ad_id TO advertisement_id;

-- Add new foreign key to advertisements table
ALTER TABLE issue_module_ads
ADD CONSTRAINT issue_module_ads_advertisement_id_fkey
FOREIGN KEY (advertisement_id) REFERENCES advertisements(id) ON DELETE SET NULL;

-- 5. Comments for documentation
COMMENT ON COLUMN advertisements.ad_module_id IS 'Links ad to a specific ad module/section. NULL = legacy advertorial section.';
COMMENT ON COLUMN advertisements.advertiser_id IS 'Links ad to an advertiser for company-level cooldown tracking.';
COMMENT ON COLUMN issue_module_ads.advertisement_id IS 'The advertisement selected for this module in this issue.';

-- ============================================
-- Note: module_ads table is now deprecated
-- Existing data can be migrated or table dropped later
-- ============================================
