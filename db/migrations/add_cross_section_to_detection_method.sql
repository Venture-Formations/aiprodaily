-- Add 'ai_cross_section' to duplicate_posts detection_method constraint
-- This is needed for Stage 4 cross-section deduplication

-- Drop the old constraint
ALTER TABLE duplicate_posts
  DROP CONSTRAINT IF EXISTS check_detection_method;

-- Add updated constraint with 'ai_cross_section'
ALTER TABLE duplicate_posts
  ADD CONSTRAINT check_detection_method
  CHECK (detection_method IN ('historical_match', 'content_hash', 'title_similarity', 'ai_semantic', 'ai_cross_section'));
