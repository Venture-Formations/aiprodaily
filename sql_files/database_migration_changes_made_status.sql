-- Database Migration: Update Status Constraint for 'changes_made'
-- Run this migration to replace 'ready_to_send' with 'changes_made' status
-- This aligns the database constraint with the current codebase expectations

-- 1. Update the status check constraint to use 'changes_made' instead of 'ready_to_send'
ALTER TABLE newsletter_campaigns
DROP CONSTRAINT IF EXISTS newsletter_campaigns_status_check;

ALTER TABLE newsletter_campaigns
ADD CONSTRAINT newsletter_campaigns_status_check
CHECK (status IN ('processing', 'draft', 'in_review', 'changes_made', 'sent', 'failed'));

-- 2. Update any existing campaigns with 'ready_to_send' status to 'changes_made'
UPDATE newsletter_campaigns
SET status = 'changes_made'
WHERE status = 'ready_to_send';

-- 3. Add 'processing' status to support RSS processing workflow
-- This status is used during RSS feed processing operations

-- Verification queries (run after migration)
-- Check the updated constraint:
-- SELECT constraint_name, check_clause FROM information_schema.check_constraints WHERE constraint_name LIKE '%newsletter_campaigns%';

-- Check for any campaigns that might have old statuses:
-- SELECT status, COUNT(*) FROM newsletter_campaigns GROUP BY status;

-- Test that the constraint allows the expected statuses:
-- SELECT 'processing'::text = ANY(ARRAY['processing', 'draft', 'in_review', 'changes_made', 'sent', 'failed']) AS processing_allowed;
-- SELECT 'changes_made'::text = ANY(ARRAY['processing', 'draft', 'in_review', 'changes_made', 'sent', 'failed']) AS changes_made_allowed;