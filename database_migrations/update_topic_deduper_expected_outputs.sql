-- Update Topic Deduplicator expected outputs to reflect actual code usage
-- The code only uses the "groups" array, not "unique_articles"
-- Each group must have: topic_signature, primary_article_index, duplicate_indices, similarity_explanation

UPDATE app_settings
SET expected_outputs = '{
  "groups": {
    "type": "array",
    "items": {
      "topic_signature": "string",
      "primary_article_index": "integer",
      "duplicate_indices": "array",
      "similarity_explanation": "string"
    }
  }
}'::jsonb
WHERE key = 'ai_prompt_topic_deduper';

-- Verify the update
SELECT
  key,
  expected_outputs
FROM app_settings
WHERE key = 'ai_prompt_topic_deduper';
