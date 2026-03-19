-- Migration: Move paid ad frequency tracking from advertisements to ad_module_advertisers (company level)
-- This ensures a company's sponsorship deal (e.g., weekly for 8 weeks) is tracked per-module,
-- not per-individual-ad-creative.

-- Add frequency/billing columns to the junction table
ALTER TABLE ad_module_advertisers
  ADD COLUMN IF NOT EXISTS frequency TEXT DEFAULT 'single' CHECK (frequency IN ('single', 'weekly', 'monthly')),
  ADD COLUMN IF NOT EXISTS times_paid INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_used_date DATE;

-- Data migration: Copy existing per-ad frequency data to junction rows
-- For each (ad_module_id, advertiser_id) pair where any ad is paid+weekly,
-- aggregate to the junction level.
UPDATE ad_module_advertisers j
SET
  frequency = sub.frequency,
  times_paid = sub.times_paid,
  paid = true,
  last_used_date = sub.last_used_date
FROM (
  SELECT
    ad_module_id,
    advertiser_id,
    -- Take frequency from the first paid ad (they should all match for a company in a module)
    (ARRAY_AGG(frequency ORDER BY created_at ASC))[1] AS frequency,
    -- Sum times_paid across all ads for this company in this module
    MAX(times_paid) AS times_paid,
    -- Use the most recent last_used_date
    MAX(last_used_date) AS last_used_date
  FROM advertisements
  WHERE paid = true
    AND frequency IN ('weekly', 'monthly')
    AND times_paid > 0
    AND advertiser_id IS NOT NULL
    AND ad_module_id IS NOT NULL
  GROUP BY ad_module_id, advertiser_id
) sub
WHERE j.ad_module_id = sub.ad_module_id
  AND j.advertiser_id = sub.advertiser_id;
