-- Update duplicate_posts constraint to include 'historical_match'
-- Run this AFTER create_deduplication_tables.sql if tables already exist

-- Drop the old constraint
ALTER TABLE duplicate_posts
  DROP CONSTRAINT IF EXISTS check_detection_method;

-- Add updated constraint with 'historical_match'
ALTER TABLE duplicate_posts
  ADD CONSTRAINT check_detection_method
  CHECK (detection_method IN ('historical_match', 'content_hash', 'title_similarity', 'ai_semantic'));
