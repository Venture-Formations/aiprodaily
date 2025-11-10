-- Comprehensive fix for ai_prompt_tests prompt_type constraint
-- This script will work regardless of the current state of the database

-- STEP 1: Drop ALL existing check constraints on prompt_type (handles any variation)
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT con.conname
    FROM pg_constraint con
    INNER JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'ai_prompt_tests'
      AND con.contype = 'c'
      AND con.conname LIKE '%prompt_type%'
  LOOP
    EXECUTE format('ALTER TABLE ai_prompt_tests DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
    RAISE NOTICE 'Dropped constraint: %', constraint_record.conname;
  END LOOP;
END $$;

-- STEP 2: Migrate any existing data with old 'article-generator' value
UPDATE ai_prompt_tests
  SET prompt_type = 'article-title'
  WHERE prompt_type = 'article-generator';

-- STEP 3: Add the new constraint with updated types
ALTER TABLE ai_prompt_tests
  ADD CONSTRAINT ai_prompt_tests_prompt_type_check
  CHECK (prompt_type IN ('article-title', 'article-body', 'post-scorer', 'subject-line', 'custom'));

-- STEP 4: Add comment
COMMENT ON CONSTRAINT ai_prompt_tests_prompt_type_check ON ai_prompt_tests
  IS 'Updated to split article generation into title and body prompts';

-- Verify the fix
SELECT 'Constraint updated successfully!' as status;
SELECT prompt_type, COUNT(*) FROM ai_prompt_tests GROUP BY prompt_type;
