-- Convert app_settings.value from TEXT to JSONB with proper escaping
-- This handles JSON objects that have literal newlines in string values

-- Step 1: Add a temporary JSONB column
ALTER TABLE app_settings ADD COLUMN value_jsonb jsonb;

-- Step 2: Convert all values to JSONB strings first
-- This preserves the original content but makes it valid JSON
UPDATE app_settings
SET value_jsonb = to_jsonb(value);

-- Step 3: Drop old column and rename new one
ALTER TABLE app_settings DROP COLUMN value;
ALTER TABLE app_settings RENAME COLUMN value_jsonb TO value;

-- Step 4: Verify the conversion
SELECT
  key,
  description,
  pg_typeof(value) as column_type,
  jsonb_typeof(value) as value_type,
  LEFT(value::text, 100) as value_preview
FROM app_settings
ORDER BY key;

-- Note: After this migration, ALL values will be JSONB strings.
-- The application code will need to:
-- 1. Check if typeof data.value === 'string'
-- 2. Try to parse it as JSON
-- 3. If it parses and has a 'messages' array, use as structured prompt
-- 4. Otherwise, use as plain text prompt
