-- Update ai_prompt_tests table to split article-generator into article-title and article-body
-- Run this AFTER create_ai_prompt_tests_table.sql if you've already created the table

-- Drop the old constraint
ALTER TABLE ai_prompt_tests
  DROP CONSTRAINT IF EXISTS ai_prompt_tests_prompt_type_check;

-- Add the new constraint with updated types
ALTER TABLE ai_prompt_tests
  ADD CONSTRAINT ai_prompt_tests_prompt_type_check
  CHECK (prompt_type IN ('article-title', 'article-body', 'post-scorer', 'subject-line', 'custom'));

-- Optional: Update any existing 'article-generator' records to 'article-title'
-- (You can run this if you have existing data that needs migration)
-- UPDATE ai_prompt_tests
--   SET prompt_type = 'article-title'
--   WHERE prompt_type = 'article-generator';

-- Add comment
COMMENT ON CONSTRAINT ai_prompt_tests_prompt_type_check ON ai_prompt_tests
  IS 'Updated to split article generation into title and body prompts';
