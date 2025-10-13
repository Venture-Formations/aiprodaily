-- Migration: Add 'processing' status to campaign workflow
-- Run this in Supabase SQL Editor to update the database schema

-- Update the status check constraint to include 'processing'
ALTER TABLE newsletter_campaigns
DROP CONSTRAINT IF EXISTS newsletter_campaigns_status_check;

ALTER TABLE newsletter_campaigns
ADD CONSTRAINT newsletter_campaigns_status_check
CHECK (status IN ('processing', 'draft', 'in_review', 'ready_to_send', 'sent', 'failed'));

-- Check current campaigns
SELECT
    id,
    date,
    status,
    created_at,
    updated_at
FROM newsletter_campaigns
ORDER BY created_at DESC
LIMIT 10;

-- Verify the new constraint is in place
SELECT conname, consrc
FROM pg_constraint
WHERE conrelid = 'newsletter_campaigns'::regclass
AND contype = 'c';