-- Convert app_settings.value from TEXT to JSONB
-- This will allow proper storage of structured JSON prompts

-- Step 1: Check current values and identify which are valid JSON
-- (This is just for verification - run this first to see what will be affected)
SELECT
  key,
  CASE
    WHEN value::jsonb IS NOT NULL THEN 'Valid JSON'
    ELSE 'Invalid JSON or Plain Text'
  END as validation_status,
  LENGTH(value) as value_length
FROM app_settings;

-- Step 2: Convert the column type from TEXT to JSONB
-- This will fail if any values are not valid JSON
-- If it fails, we'll need to fix those values first
ALTER TABLE app_settings
ALTER COLUMN value TYPE jsonb USING value::jsonb;

-- Step 3: Verify the conversion
SELECT
  key,
  pg_typeof(value) as column_type,
  jsonb_typeof(value) as value_type
FROM app_settings
LIMIT 5;

-- Note: After this migration, Supabase will return JSONB values as JavaScript objects,
-- not strings. The code already handles this with the typeof check.
