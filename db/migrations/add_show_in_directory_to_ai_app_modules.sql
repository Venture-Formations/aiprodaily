-- Migration: Add show_in_directory to ai_app_modules
-- This allows controlling which modules' apps appear in the public /tools directory

-- Add the column with default true for backwards compatibility
ALTER TABLE ai_app_modules
ADD COLUMN IF NOT EXISTS show_in_directory BOOLEAN DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN ai_app_modules.show_in_directory IS 'Whether apps in this module appear in the public /tools directory';
