-- Add custom_default column to app_settings table
-- This allows users to save their customized prompts as personal defaults
-- When "Reset to Default" is clicked, it will restore to custom_default if exists,
-- otherwise it falls back to the original code default

-- Add custom_default column to app_settings
ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS custom_default TEXT;

-- Add comment for documentation
COMMENT ON COLUMN app_settings.custom_default IS 'User-defined default value. When set, "Reset to Default" restores to this value instead of code default.';

-- Verification query
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'app_settings'
  AND column_name = 'custom_default';
