-- Update ai_prompt_tests table to split article-generator into article-title and article-body
-- Run this AFTER create_ai_prompt_tests_table.sql if you've already created the table

-- STEP 1: Migrate existing data FIRST (before changing constraint)
-- Update any existing 'article-generator' records to 'article-title'
UPDATE ai_prompt_tests
  SET prompt_type = 'article-title'
  WHERE prompt_type = 'article-generator';

-- STEP 2: Drop the old constraint
ALTER TABLE ai_prompt_tests
  DROP CONSTRAINT IF EXISTS ai_prompt_tests_prompt_type_check;

-- STEP 3: Add the new constraint with updated types
ALTER TABLE ai_prompt_tests
  ADD CONSTRAINT ai_prompt_tests_prompt_type_check
  CHECK (prompt_type IN ('article-title', 'article-body', 'post-scorer', 'subject-line', 'custom'));

-- Add comment
COMMENT ON CONSTRAINT ai_prompt_tests_prompt_type_check ON ai_prompt_tests
  IS 'Updated to split article generation into title and body prompts';
