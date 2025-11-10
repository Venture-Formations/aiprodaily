-- Update ai_prompt_tests to support primary/secondary prompt types
-- Run this migration to add primary-title, primary-body, secondary-title, secondary-body

-- STEP 1: Drop the old constraint FIRST (must be done before updating data)
ALTER TABLE ai_prompt_tests
  DROP CONSTRAINT IF EXISTS ai_prompt_tests_prompt_type_check;

-- STEP 2: Migrate existing data to new naming convention
UPDATE ai_prompt_tests
  SET prompt_type = 'primary-title'
  WHERE prompt_type = 'article-title';

UPDATE ai_prompt_tests
  SET prompt_type = 'primary-body'
  WHERE prompt_type = 'article-body';

-- STEP 3: Add the new constraint with primary/secondary types
ALTER TABLE ai_prompt_tests
  ADD CONSTRAINT ai_prompt_tests_prompt_type_check
  CHECK (prompt_type IN (
    'primary-title',
    'primary-body',
    'secondary-title',
    'secondary-body',
    'post-scorer',
    'subject-line',
    'custom'
  ));

-- STEP 4: Add comment
COMMENT ON CONSTRAINT ai_prompt_tests_prompt_type_check ON ai_prompt_tests
  IS 'Updated to support separate primary and secondary article generation prompts';

-- Verify the migration
SELECT 'Migration completed successfully!' as status;
SELECT prompt_type, COUNT(*) FROM ai_prompt_tests GROUP BY prompt_type ORDER BY prompt_type;
