-- Check the current value of the welcome section prompt
SELECT
  key,
  value,
  pg_typeof(value) as column_type,
  jsonb_typeof(value) as value_type,
  LENGTH(value::text) as length
FROM app_settings
WHERE key = 'ai_prompt_welcome_section';
