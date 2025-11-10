-- Add secondary_articles column to archived_newsletters table
-- This column stores secondary articles data for archived campaigns

-- Add the secondary_articles column (JSONB array)
ALTER TABLE archived_newsletters
ADD COLUMN IF NOT EXISTS secondary_articles JSONB DEFAULT '[]'::jsonb;

-- Add comment explaining the column
COMMENT ON COLUMN archived_newsletters.secondary_articles IS 'JSONB array of secondary article data with full content';
