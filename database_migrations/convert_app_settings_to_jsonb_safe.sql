-- Convert app_settings.value from TEXT to JSONB safely
-- Step 1: Wrap plain text values in quotes to make them valid JSON strings
-- Step 2: Convert column type to JSONB

-- First, let's identify which values need fixing by checking for common patterns
-- We'll update any plain text/number values to be valid JSON

-- Fix plain numbers (like "07", "123") by wrapping in quotes
UPDATE app_settings
SET value = '"' || value || '"'
WHERE value IS NOT NULL
  AND value != ''
  AND value !~ '^\s*[\{\[]'  -- Not starting with { or [
  AND value !~ '^\s*"'       -- Not already quoted
  AND value !~ '^\s*(true|false|null)\s*$'  -- Not a boolean or null
  -- Try to detect if it's not valid JSON by checking if it looks like plain text/number
  AND (value ~ '^[0-9]' OR value !~ '[\{\}\[\]]');

-- Now convert the column type
ALTER TABLE app_settings
ALTER COLUMN value TYPE jsonb USING value::jsonb;

-- Verify the conversion
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
