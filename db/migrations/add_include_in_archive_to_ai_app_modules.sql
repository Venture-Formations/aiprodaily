-- Migration: Add include_in_archive to ai_app_modules
-- Controls whether the module appears in archived newsletter pages (/news, /website/newsletter/[date])

ALTER TABLE ai_app_modules
ADD COLUMN IF NOT EXISTS include_in_archive BOOLEAN DEFAULT true;

COMMENT ON COLUMN ai_app_modules.include_in_archive IS 'Whether this module appears in archived newsletter pages. Disable for modules with email-dependent links.';
