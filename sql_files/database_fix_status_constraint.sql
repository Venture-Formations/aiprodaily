-- Fix Status Constraint Issues
-- Step 1: First, let's see what statuses currently exist

-- Check all current statuses in the database
SELECT status, COUNT(*) as count
FROM newsletter_campaigns
GROUP BY status
ORDER BY count DESC;

-- Step 2: Update any invalid statuses to valid ones
-- Map old/invalid statuses to valid ones:

-- Update 'approved' to 'changes_made' (if any exist)
UPDATE newsletter_campaigns
SET status = 'changes_made'
WHERE status = 'approved';

-- Update 'ready_to_send' to 'changes_made' (if any exist)
UPDATE newsletter_campaigns
SET status = 'changes_made'
WHERE status = 'ready_to_send';

-- Update any other unexpected statuses to 'draft'
UPDATE newsletter_campaigns
SET status = 'draft'
WHERE status NOT IN ('processing', 'draft', 'in_review', 'changes_made', 'sent', 'failed');

-- Step 3: Verify all rows now have valid statuses
SELECT status, COUNT(*) as count
FROM newsletter_campaigns
GROUP BY status
ORDER BY count DESC;

-- Step 4: Now safely drop and recreate the constraint
ALTER TABLE newsletter_campaigns
DROP CONSTRAINT IF EXISTS newsletter_campaigns_status_check;

ALTER TABLE newsletter_campaigns
ADD CONSTRAINT newsletter_campaigns_status_check
CHECK (status IN ('processing', 'draft', 'in_review', 'changes_made', 'sent', 'failed'));

-- Step 5: Final verification
SELECT 'Constraint updated successfully' as result;