-- Add welcome_section column to newsletter_campaigns table
-- This stores the AI-generated welcome text that appears at the top of each newsletter

-- Add welcome_section column
ALTER TABLE newsletter_campaigns
ADD COLUMN IF NOT EXISTS welcome_section TEXT;

-- Add comment for documentation
COMMENT ON COLUMN newsletter_campaigns.welcome_section IS 'AI-generated welcome text that summarizes the newsletter contents. Appears first in the email after the header. Generated from all active primary and secondary articles.';

-- Verification query
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'newsletter_campaigns'
  AND column_name = 'welcome_section';
