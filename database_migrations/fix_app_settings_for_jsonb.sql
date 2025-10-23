-- Find rows with invalid JSON in app_settings.value
-- This will help us identify which values need to be fixed before converting to JSONB

-- Step 1: Identify rows with invalid JSON
SELECT
  key,
  description,
  value,
  LENGTH(value) as value_length,
  CASE
    WHEN value IS NULL THEN 'NULL'
    WHEN value = '' THEN 'EMPTY'
    WHEN value ~ '^[0-9]+$' THEN 'NUMBER'
    WHEN value ~ '^[0-9]+\.[0-9]+$' THEN 'DECIMAL'
    WHEN value ~ '^(true|false)$' THEN 'BOOLEAN'
    WHEN value ~ '^\{.*\}$' THEN 'OBJECT'
    WHEN value ~ '^\[.*\]$' THEN 'ARRAY'
    ELSE 'PLAIN TEXT'
  END as detected_type,
  CASE
    -- Try to cast to JSONB and catch errors
    WHEN value::jsonb IS NOT NULL THEN 'Valid JSON'
    ELSE 'Invalid JSON'
  END as json_validity
FROM app_settings
ORDER BY key;

-- This query will show you all rows and identify which ones will cause problems
-- when converting to JSONB.
