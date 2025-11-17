-- Migration: Rename archived_newsletters columns to match issue terminology
-- Date: 2025-11-17
-- Description: Rename campaign_id to issue_id and campaign_date to issue_date

-- Step 1: Rename columns
ALTER TABLE archived_newsletters RENAME COLUMN campaign_id TO issue_id;
ALTER TABLE archived_newsletters RENAME COLUMN campaign_date TO issue_date;

-- Step 2: Update any indexes if they exist (optional - check if needed)
-- ALTER INDEX IF EXISTS idx_archived_newsletters_campaign_id RENAME TO idx_archived_newsletters_issue_id;
-- ALTER INDEX IF EXISTS idx_archived_newsletters_campaign_date RENAME TO idx_archived_newsletters_issue_date;

-- Verification query (run after migration):
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'archived_newsletters' ORDER BY ordinal_position;
