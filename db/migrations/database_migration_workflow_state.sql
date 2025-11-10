-- Add workflow state tracking to newsletter_campaigns table
-- This enables state machine pattern for RSS processing workflow

-- Add workflow state column
ALTER TABLE newsletter_campaigns
ADD COLUMN IF NOT EXISTS workflow_state TEXT DEFAULT 'pending_archive';

-- Add timestamp for when current state started (for timeout detection)
ALTER TABLE newsletter_campaigns
ADD COLUMN IF NOT EXISTS workflow_state_started_at TIMESTAMPTZ;

-- Add error message column for failed workflows
ALTER TABLE newsletter_campaigns
ADD COLUMN IF NOT EXISTS workflow_error TEXT;

-- Create index for efficient state queries by coordinator cron
CREATE INDEX IF NOT EXISTS idx_campaigns_workflow_state
ON newsletter_campaigns(workflow_state)
WHERE workflow_state NOT IN ('complete', 'failed');

-- Update existing campaigns to have workflow_state
UPDATE newsletter_campaigns
SET workflow_state = 'complete'
WHERE status = 'sent';

UPDATE newsletter_campaigns
SET workflow_state = 'pending_archive'
WHERE status = 'draft' AND workflow_state IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN newsletter_campaigns.workflow_state IS 'Current step in RSS processing workflow state machine';
COMMENT ON COLUMN newsletter_campaigns.workflow_state_started_at IS 'When current workflow state began, used for timeout detection';
COMMENT ON COLUMN newsletter_campaigns.workflow_error IS 'Error message if workflow failed';
