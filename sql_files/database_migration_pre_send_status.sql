-- Database Migration: Add Pre-Send Status Tracking
-- This adds a column to track the campaign status before final send
-- Useful for analytics and understanding the approval workflow

-- 1. Add the new column to track status before sending
ALTER TABLE newsletter_campaigns
ADD COLUMN IF NOT EXISTS status_before_send VARCHAR(20) CHECK (status_before_send IN ('draft', 'in_review', 'changes_made', 'processing'));

-- 2. Create an index for performance when querying by pre-send status
CREATE INDEX IF NOT EXISTS idx_newsletter_campaigns_status_before_send
ON newsletter_campaigns(status_before_send);

-- 3. Add a comment to document the purpose
COMMENT ON COLUMN newsletter_campaigns.status_before_send IS 'Records the campaign status immediately before it was sent (typically in_review or changes_made)';

-- 4. Optionally, backfill existing sent campaigns with a default value
-- This assumes most sent campaigns were likely in 'in_review' status before sending
-- UPDATE newsletter_campaigns
-- SET status_before_send = 'in_review'
-- WHERE status = 'sent' AND status_before_send IS NULL;

-- Verification queries (run after migration)
-- Check the new column exists:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'newsletter_campaigns' AND column_name = 'status_before_send';

-- Check constraint is properly applied:
-- SELECT constraint_name, check_clause
-- FROM information_schema.check_constraints
-- WHERE constraint_name LIKE '%status_before_send%';