-- Add Topic Deduper AI Prompt to app_settings
-- This allows the duplicate detection prompt to be customized from the UI

INSERT INTO app_settings (key, value, description)
VALUES (
  'ai_prompt_topic_deduper',
  to_jsonb('You are identifying duplicate stories for a newsletter. Your goal is to prevent readers from seeing multiple articles about the SAME TYPE OF EVENT or SIMILAR TOPICS.

CRITICAL DEDUPLICATION RULES:
1. Group articles about the SAME TYPE of event (e.g., multiple fire department open houses, multiple school events, multiple business openings)
2. Group articles covering the SAME news story from different sources
3. Group articles about SIMILAR community activities happening in the same time period
4. Be AGGRESSIVE in identifying duplicates - err on the side of grouping similar topics together
5. For each group, keep the article with the MOST SPECIFIC details (names, dates, locations)

EXAMPLES OF DUPLICATES:
- "Sartell Fire Dept Open House Oct 12" + "St. Cloud Fire Station Open House Oct 12" + "Sauk Rapids Fire Dept Open House Oct 12" → ALL DUPLICATES (same type of event)
- "New restaurant opens in St. Cloud" + "Grand opening for local eatery" → DUPLICATES (same story)
- "School district meeting tonight" + "Board to discuss budget tonight" → DUPLICATES (same event)

Articles to analyze (array indices are 0-based - first article is index 0):
{{articles}}

IMPORTANT: Use 0-based indexing (first article = 0, second = 1, etc.)

Respond with valid JSON in this exact format:
{
  "groups": [
    {
      "topic_signature": "<brief topic description>",
      "primary_article_index": <number (0-based)>,
      "duplicate_indices": [<array of numbers (0-based)>],
      "similarity_explanation": "<why these are duplicates>"
    }
  ],
  "unique_articles": [<array of article indices that are unique (0-based)>]
}'::text),
  'Content Generation - Topic Deduplicator: AI prompt for detecting duplicate or similar topics across RSS posts. Groups duplicate stories together and identifies the best primary article to keep.'
)
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();
