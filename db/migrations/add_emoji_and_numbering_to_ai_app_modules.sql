-- Migration: Add show_emoji and show_numbers settings to ai_app_modules
-- This allows controlling whether products display emoji icons and numbering in the newsletter

-- Add show_emoji column (default true for backwards compatibility with existing AI Applications module)
ALTER TABLE ai_app_modules
ADD COLUMN IF NOT EXISTS show_emoji BOOLEAN DEFAULT true;

-- Add show_numbers column (default true for backwards compatibility)
ALTER TABLE ai_app_modules
ADD COLUMN IF NOT EXISTS show_numbers BOOLEAN DEFAULT true;

-- Add comments for documentation
COMMENT ON COLUMN ai_app_modules.show_emoji IS 'Whether to display category-based emoji icons next to product titles';
COMMENT ON COLUMN ai_app_modules.show_numbers IS 'Whether to display numbered list (1. 2. 3.) next to product titles';
