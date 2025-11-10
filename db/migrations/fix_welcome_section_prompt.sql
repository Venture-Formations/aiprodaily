-- Fix the welcome section prompt by properly parsing it as a JSONB object
-- This replaces literal newlines with \n before parsing

-- Step 1: Get the current value (it's a JSONB string)
-- Step 2: Replace literal newlines with escaped newlines
-- Step 3: Parse it as JSONB object

UPDATE app_settings
SET value = (
  -- Take the JSONB string value, convert to text, replace newlines, then parse as JSONB
  SELECT replace(value::text, E'\n', '\n')::jsonb
  FROM app_settings
  WHERE key = 'ai_prompt_welcome_section'
)
WHERE key = 'ai_prompt_welcome_section';

-- Verify the change
SELECT
  key,
  pg_typeof(value) as column_type,
  jsonb_typeof(value) as value_type,
  value->'messages' as has_messages
FROM app_settings
WHERE key = 'ai_prompt_welcome_section';
