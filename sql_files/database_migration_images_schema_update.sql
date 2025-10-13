-- Database Migration: Update Images Table Schema
-- Date: 2025-01-20
-- Description: Add new columns and rename location to city

-- First, add the new columns
ALTER TABLE images ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE images ADD COLUMN IF NOT EXISTS original_file_name TEXT;
ALTER TABLE images ADD COLUMN IF NOT EXISTS city TEXT;

-- Copy existing location data to city column (if location column exists)
UPDATE images SET city = location WHERE location IS NOT NULL AND city IS NULL;

-- Note: We keep the location column for now to maintain backwards compatibility
-- In production, you may want to drop it after confirming everything works:
-- ALTER TABLE images DROP COLUMN IF EXISTS location;

-- Add indexes for better query performance on new columns
CREATE INDEX IF NOT EXISTS idx_images_city ON images(city);
CREATE INDEX IF NOT EXISTS idx_images_source ON images(source);
CREATE INDEX IF NOT EXISTS idx_images_original_file_name ON images(original_file_name);

-- Verify the schema changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'images'
AND column_name IN ('city', 'source', 'original_file_name', 'location')
ORDER BY column_name;