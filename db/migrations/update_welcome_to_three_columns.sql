-- Update welcome section to use 3 separate columns for better formatting control
-- This replaces the single welcome_section column with intro, tagline, and summary

-- Remove old single column
ALTER TABLE newsletter_campaigns
DROP COLUMN IF EXISTS welcome_section;

-- Add 3 new columns for structured welcome content
ALTER TABLE newsletter_campaigns
ADD COLUMN IF NOT EXISTS welcome_intro TEXT,
ADD COLUMN IF NOT EXISTS welcome_tagline TEXT,
ADD COLUMN IF NOT EXISTS welcome_summary TEXT;

-- Add comments for documentation
COMMENT ON COLUMN newsletter_campaigns.welcome_intro IS 'Welcome intro text (e.g., "Hey, AI Enthusiast!") - displayed in regular text';
COMMENT ON COLUMN newsletter_campaigns.welcome_tagline IS 'Welcome tagline (e.g., "Welcome back to...") - displayed in bold text';
COMMENT ON COLUMN newsletter_campaigns.welcome_summary IS 'Summary of newsletter articles - displayed in regular text';

-- Verification query
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'newsletter_campaigns'
  AND column_name IN ('welcome_intro', 'welcome_tagline', 'welcome_summary')
ORDER BY column_name;
