-- Fix welcomeSection to be JSONB string (like factChecker)
-- This converts the current JSONB object to a JSONB string

UPDATE app_settings
SET value = to_jsonb(value::text)
WHERE key = 'ai_prompt_welcome_section'
  AND jsonb_typeof(value) = 'object';  -- Only if it's currently an object

-- Verify it's now a JSONB string (not object!)
SELECT
  key,
  jsonb_typeof(value) as value_type,
  LEFT(value::text, 80) as preview
FROM app_settings
WHERE key = 'ai_prompt_welcome_section';
