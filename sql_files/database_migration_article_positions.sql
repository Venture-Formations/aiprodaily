-- Database migration to add position tracking columns for articles
-- Run this in Supabase SQL Editor

-- Add position tracking columns to articles table
ALTER TABLE articles
ADD COLUMN review_position INTEGER DEFAULT NULL,
ADD COLUMN final_position INTEGER DEFAULT NULL;

-- Add position tracking columns to manual_articles table
ALTER TABLE manual_articles
ADD COLUMN review_position INTEGER DEFAULT NULL,
ADD COLUMN final_position INTEGER DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN articles.review_position IS 'Position (1-5) of article when sent for review';
COMMENT ON COLUMN articles.final_position IS 'Position (1-5) of article when final newsletter was sent';
COMMENT ON COLUMN manual_articles.review_position IS 'Position (1-5) of manual article when sent for review';
COMMENT ON COLUMN manual_articles.final_position IS 'Position (1-5) of manual article when final newsletter was sent';

-- Verify the columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'articles'
  AND column_name IN ('review_position', 'final_position')
ORDER BY column_name;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'manual_articles'
  AND column_name IN ('review_position', 'final_position')
ORDER BY column_name;