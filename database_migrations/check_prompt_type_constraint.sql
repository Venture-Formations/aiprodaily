-- Check the current constraint on prompt_type column
SELECT
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid) as constraint_definition
FROM pg_constraint con
INNER JOIN pg_class rel ON rel.oid = con.conrelid
INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'ai_prompt_tests'
  AND con.conname = 'ai_prompt_tests_prompt_type_check';

-- Also check for any rows with old 'article-generator' type
SELECT prompt_type, COUNT(*)
FROM ai_prompt_tests
GROUP BY prompt_type
ORDER BY prompt_type;
