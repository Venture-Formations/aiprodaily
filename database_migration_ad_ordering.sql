-- Advertisement Ordering System Migration
-- This migration adds ordering capabilities to the advertisements system

-- 1. Add order column to advertisements table
ALTER TABLE advertisements
ADD COLUMN IF NOT EXISTS display_order INTEGER;

-- 2. Add next_ad_position to app_settings to track which ad to use next
-- This will be stored as a JSON setting in the existing app_settings table
INSERT INTO app_settings (key, value, description, updated_at)
VALUES (
  'next_ad_position',
  '1',
  'The position number of the next advertisement to display in newsletters',
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- 3. Add ads_per_newsletter setting
INSERT INTO app_settings (key, value, description, updated_at)
VALUES (
  'ads_per_newsletter',
  '1',
  'Number of advertisements to include in each newsletter (affects article count: 5 total items)',
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- 4. Initialize display_order for existing active ads (in order of creation)
WITH ordered_ads AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as row_num
  FROM advertisements
  WHERE status = 'active'
)
UPDATE advertisements
SET display_order = ordered_ads.row_num
FROM ordered_ads
WHERE advertisements.id = ordered_ads.id
  AND advertisements.status = 'active';

-- 5. Set display_order to NULL for non-active ads
UPDATE advertisements
SET display_order = NULL
WHERE status != 'active';

-- 6. Create index for efficient ordering queries
CREATE INDEX IF NOT EXISTS idx_advertisements_display_order
ON advertisements(display_order)
WHERE status = 'active';

-- 7. Add comments for documentation
COMMENT ON COLUMN advertisements.display_order IS 'Order position for rotating advertisements in newsletters. Only active ads have a position number. Ads display in order: 1, 2, 3... then loop back to 1.';

-- Migration complete
-- Next steps:
-- 1. Remove frequency, times_paid, preferred_start_date from Add Advertisement form
-- 2. Create drag-and-drop ordering interface
-- 3. Update newsletter generation to use display_order
-- 4. Add highlighting for last used position
