-- ============================================
-- Fix max_tokens to max_output_tokens in OpenAI prompts
-- ============================================
-- OpenAI Responses API uses max_output_tokens, not max_tokens
-- This migration updates all existing prompts to use the correct parameter

-- Update all OpenAI prompts that have max_tokens
UPDATE app_settings
SET value = jsonb_set(
  value - 'max_tokens',  -- Remove max_tokens
  '{max_output_tokens}',  -- Add max_output_tokens
  value -> 'max_tokens'   -- Copy the value from max_tokens
)
WHERE key LIKE 'ai_prompt_%'
  AND ai_provider = 'openai'
  AND value ? 'max_tokens';

-- Verification query (uncomment to check):
-- SELECT key, ai_provider,
--   CASE
--     WHEN value ? 'max_tokens' THEN 'HAS max_tokens (BAD)'
--     WHEN value ? 'max_output_tokens' THEN 'HAS max_output_tokens (GOOD)'
--     ELSE 'NO TOKEN LIMIT'
--   END as status,
--   value -> 'max_output_tokens' as max_output_tokens_value
-- FROM app_settings
-- WHERE key LIKE 'ai_prompt_%'
-- ORDER BY key;
