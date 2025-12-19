-- Add next_position field to ad_modules for sequential rotation tracking
-- This tracks which position (display_order) should be selected next

ALTER TABLE ad_modules
ADD COLUMN IF NOT EXISTS next_position INTEGER DEFAULT 1;

-- Add comment explaining the field
COMMENT ON COLUMN ad_modules.next_position IS 'Tracks the next display_order position to select for sequential mode. Loops back to 1 after reaching the last ad.';
