-- Add show_name column to feedback_modules
-- This allows hiding the section header in newsletters (like text_box_modules)

ALTER TABLE feedback_modules
ADD COLUMN IF NOT EXISTS show_name BOOLEAN DEFAULT true;

COMMENT ON COLUMN feedback_modules.show_name IS 'Whether to show the section name header in the newsletter';
