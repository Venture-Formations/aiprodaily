-- Check format of all AI prompts
SELECT
  key,
  jsonb_typeof(value) as value_type,
  CASE
    WHEN jsonb_typeof(value) = 'string' THEN
      CASE
        WHEN value::text LIKE '{%"model"%' THEN 'Structured (as string)'
        ELSE 'Plain text'
      END
    WHEN jsonb_typeof(value) = 'object' THEN 'Structured (as object)'
    ELSE jsonb_typeof(value)
  END as format,
  LEFT(value::text, 80) as preview
FROM app_settings
WHERE key LIKE 'ai_prompt_%'
ORDER BY key;
