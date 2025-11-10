-- Fix welcome section: Convert JSONB string to JSONB object
-- Current state: value is a JSONB string like "{\\"model\\": \\"gpt-4o\\", ...}"
-- Desired state: value is a JSONB object like {"model": "gpt-4o", ...}

-- Step 1: Parse the JSONB string value to get the actual JSON text
-- Step 2: Cast that text back to JSONB to make it an object

UPDATE app_settings
SET value = (value#>>'{}')::jsonb
WHERE key = 'ai_prompt_welcome_section'
  AND jsonb_typeof(value) = 'string';

-- Verify it's now a JSONB object (not string!)
SELECT
  key,
  jsonb_typeof(value) as value_type,
  value->'model' as model,
  jsonb_array_length(value->'messages') as message_count
FROM app_settings
WHERE key = 'ai_prompt_welcome_section';
