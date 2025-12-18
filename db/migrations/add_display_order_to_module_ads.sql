-- Add display_order to module_ads for sequential rotation ordering
-- This allows admins to set the exact order ads appear in sequential mode

ALTER TABLE module_ads
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Create index for efficient ordering queries
CREATE INDEX IF NOT EXISTS idx_module_ads_display_order
ON module_ads(ad_module_id, display_order);

-- Comment explaining usage
COMMENT ON COLUMN module_ads.display_order IS 'Order for sequential rotation. Lower numbers appear first. Set via drag-drop on ads page.';
