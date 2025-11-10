-- Add 'pending_phase2' and 'processing' statuses to newsletter_campaigns
-- This supports the two-phase RSS processing workflow

-- Drop the existing constraint
ALTER TABLE newsletter_campaigns
DROP CONSTRAINT IF EXISTS newsletter_campaigns_status_check;

-- Add new constraint with additional statuses
ALTER TABLE newsletter_campaigns
ADD CONSTRAINT newsletter_campaigns_status_check
CHECK (status IN ('draft', 'processing', 'pending_phase2', 'in_review', 'changes_made', 'ready_to_send', 'sent', 'failed'));

-- Status flow:
-- 1. 'processing' - Phase 1 is running (archive, fetch, score)
-- 2. 'pending_phase2' - Phase 1 complete, waiting for Phase 2 to start
-- 3. 'draft' - Phase 2 complete, ready for review
-- 4. 'in_review' - Under manual review
-- 5. 'ready_to_send' or 'sent' - Final states
-- 6. 'failed' - Error state
