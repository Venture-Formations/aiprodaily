-- Add poll tracking to publication_issues
-- Migration: add_poll_id_to_issues.sql
-- Date: 2025-11-17
-- Description: Tracks which poll was used in each sent issue

-- Add poll_id column to track which poll was included in the issue
ALTER TABLE publication_issues
ADD COLUMN poll_id UUID REFERENCES polls(id) ON DELETE SET NULL;

-- Add poll snapshot columns to preserve poll data even if original poll is modified/deleted
ALTER TABLE publication_issues
ADD COLUMN poll_snapshot JSONB;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_publication_issues_poll ON publication_issues(poll_id);

-- Add comment for documentation
COMMENT ON COLUMN publication_issues.poll_id IS 'Reference to the poll that was included when issue was sent';
COMMENT ON COLUMN publication_issues.poll_snapshot IS 'Snapshot of poll data (title, question, options) at time of send, preserved for historical accuracy';

-- Example poll_snapshot structure:
-- {
--   "id": "uuid",
--   "title": "Help Us Improve",
--   "question": "How satisfied are you with the newsletter?",
--   "options": ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied"]
-- }
