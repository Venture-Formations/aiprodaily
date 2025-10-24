-- Add newsletter_id column to archived_newsletters table for multi-tenant support
-- This column is required for proper data isolation between newsletters

-- Add the newsletter_id column
ALTER TABLE archived_newsletters
ADD COLUMN IF NOT EXISTS newsletter_id TEXT;

-- Set default value for existing records (hardcoded to 'accounting' for AI Accounting Daily)
UPDATE archived_newsletters
SET newsletter_id = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'
WHERE newsletter_id IS NULL;

-- Make the column NOT NULL after setting defaults
ALTER TABLE archived_newsletters
ALTER COLUMN newsletter_id SET NOT NULL;

-- Create an index for efficient queries
CREATE INDEX IF NOT EXISTS idx_archived_newsletters_newsletter_id
ON archived_newsletters(newsletter_id);

-- Add a comment explaining the column
COMMENT ON COLUMN archived_newsletters.newsletter_id IS 'Foreign key to newsletters table for multi-tenant isolation';
