-- Convert app_settings.value from TEXT to JSONB using PostgreSQL JSON functions
-- This migration properly handles:
-- 1. Values that are already valid JSON (objects/arrays) - keep as-is
-- 2. Plain text values - use to_jsonb() to properly escape special characters

-- Step 1: Add a temporary JSONB column
ALTER TABLE app_settings ADD COLUMN value_jsonb jsonb;

-- Step 2: Convert values to JSONB
-- For rows with valid JSON objects/arrays, parse them directly
-- For all other rows (plain text, numbers, etc.), use to_jsonb() to properly encode
UPDATE app_settings
SET value_jsonb = CASE
  -- If value starts with { or [, try to parse as JSON object/array
  WHEN value ~ '^\s*[\{\[]' THEN
    value::jsonb
  -- Otherwise, use to_jsonb() to properly encode as JSON string
  ELSE
    to_jsonb(value)
END;

-- Step 3: Drop old column and rename new one
ALTER TABLE app_settings DROP COLUMN value;
ALTER TABLE app_settings RENAME COLUMN value_jsonb TO value;

-- Step 4: Verify the conversion
SELECT
  key,
  description,
  pg_typeof(value) as column_type,
  jsonb_typeof(value) as value_type,
  CASE
    WHEN jsonb_typeof(value) = 'object' THEN 'Structured prompt'
    WHEN jsonb_typeof(value) = 'string' THEN 'Plain text value'
    WHEN jsonb_typeof(value) = 'number' THEN 'Numeric value'
    WHEN jsonb_typeof(value) = 'boolean' THEN 'Boolean value'
    ELSE jsonb_typeof(value)
  END as description_type
FROM app_settings
ORDER BY key;
