-- Database Migration: Add Approval System Fields
-- Run this migration to add support for campaign approval tracking

-- 1. Add new columns to newsletter_campaigns table
ALTER TABLE newsletter_campaigns
ADD COLUMN IF NOT EXISTS last_action VARCHAR(20) CHECK (last_action IN ('changes_made', 'approved')),
ADD COLUMN IF NOT EXISTS last_action_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_action_by TEXT;

-- 2. Update the status check constraint to include 'ready_to_send'
ALTER TABLE newsletter_campaigns
DROP CONSTRAINT IF EXISTS newsletter_campaigns_status_check;

ALTER TABLE newsletter_campaigns
ADD CONSTRAINT newsletter_campaigns_status_check
CHECK (status IN ('draft', 'in_review', 'ready_to_send', 'sent', 'failed'));

-- 3. Create an index on last_action_at for performance
CREATE INDEX IF NOT EXISTS idx_newsletter_campaigns_last_action_at
ON newsletter_campaigns(last_action_at);

-- 4. Create an index on last_action_by for querying by user
CREATE INDEX IF NOT EXISTS idx_newsletter_campaigns_last_action_by
ON newsletter_campaigns(last_action_by);

-- 5. Add a comment to document the new workflow
COMMENT ON COLUMN newsletter_campaigns.last_action IS 'Tracks whether user marked campaign as having changes_made or approved';
COMMENT ON COLUMN newsletter_campaigns.last_action_at IS 'Timestamp when the last approval action was taken';
COMMENT ON COLUMN newsletter_campaigns.last_action_by IS 'Email/identifier of user who performed the last approval action';

-- Verification queries (run after migration)
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'newsletter_campaigns' ORDER BY ordinal_position;
-- SELECT constraint_name, check_clause FROM information_schema.check_constraints WHERE constraint_name LIKE '%newsletter_campaigns%';