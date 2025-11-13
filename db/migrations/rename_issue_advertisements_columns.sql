-- Rename columns in issue_advertisements table
-- Part of the campaign → issue terminology migration

-- Rename campaign_date to issue_date
ALTER TABLE issue_advertisements
RENAME COLUMN campaign_date TO issue_date;

-- Rename campaign_id to issue_id (if not already renamed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'issue_advertisements'
    AND column_name = 'campaign_id'
  ) THEN
    ALTER TABLE issue_advertisements
    RENAME COLUMN campaign_id TO issue_id;
  END IF;
END $$;

-- Verify the changes
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'issue_advertisements'
ORDER BY ordinal_position;
