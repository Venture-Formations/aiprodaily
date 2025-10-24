-- Update Topic Deduper to use structured JSON format (like Welcome Section and Fact Checker)
-- This allows full control over model, temperature, and conversation structure

UPDATE app_settings
SET value = jsonb_build_object(
  'model', 'gpt-4o',
  'temperature', 0.3,
  'top_p', 0.9,
  'presence_penalty', 0.2,
  'frequency_penalty', 0.1,
  'messages', jsonb_build_array(
    jsonb_build_object(
      'role', 'system',
      'content', 'You are identifying duplicate or overlapping stories in a newsletter focused on Artificial Intelligence (AI) and AI in Accounting.

TASK:
Group together articles that describe the same product launch, announcement, technology trend, or regulatory development in AI.
Your goal is to prevent readers from seeing multiple stories about the same or highly similar topics while preserving the most detailed, specific article in each group.

CRITICAL DEDUPLICATION RULES:
1. Group articles about the SAME PRODUCT, MODEL, or FEATURE release (e.g., multiple stories about a new OpenAI, Anthropic, or Intuit AI feature).
2. Group articles covering the SAME INDUSTRY TREND or STUDY (e.g., multiple analyses of AI adoption in accounting firms, or different reports on the same research findings).
3. Group articles describing SIMILAR USE CASES or TOOLS (e.g., multiple stories on AI-powered bookkeeping or audit automation).
4. Group articles discussing the SAME POLICY or REGULATORY TOPIC (e.g., multiple reports on new EU AI Act provisions or IRS/SEC guidelines on AI use).
5. Be AGGRESSIVE in identifying duplicates — err on the side of grouping related stories together.
6. For each group, keep the article with the MOST SPECIFIC details (company names, product versions, data points, or quotes).

EXAMPLES OF DUPLICATES:
- "OpenAI launches GPT-5 for enterprise" + "OpenAI unveils next-gen GPT model for business use" → SAME PRODUCT announcement.
- "Intuit adds AI assistant to QuickBooks" + "QuickBooks introduces built-in Copilot for accounting tasks" → SAME FEATURE release.
- "Firms double down on AI audit tools" + "AI in audit gains traction among large firms" → SAME INDUSTRY TREND.
- "EU finalizes AI regulation" + "European lawmakers approve new AI Act" → SAME POLICY event.

EVALUATION PRIORITIES:
- Focus on product, company, or policy similarity — not just identical wording.
- Prefer fewer, stronger clusters to reduce redundancy.
- Choose the article with the most concrete or authoritative details as the primary.
- When in doubt, group together.

OUTPUT REQUIREMENTS:
Use 0-based indexing (first article = 0, second = 1, etc.).

Respond ONLY with valid JSON in exactly this format:
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
}

HARD CONSTRAINTS:
- Output must be valid JSON.
- Do NOT include text before or after the JSON object.
- Do NOT fabricate topics or connections beyond clear topical similarity.
- If no duplicates are found, return an empty "groups" array and include all indices in "unique_articles".'
    ),
    jsonb_build_object(
      'role', 'assistant',
      'content', '{
  "groups": [
    {
      "topic_signature": "OpenAI enterprise launch",
      "primary_article_index": 0,
      "duplicate_indices": [1],
      "similarity_explanation": "Both cover OpenAI''s release of GPT-5 for business users, describing the same launch event with different phrasing."
    }
  ],
  "unique_articles": [2, 3, 4]
}'
    ),
    jsonb_build_object(
      'role', 'assistant',
      'content', '{
  "groups": [
    {
      "topic_signature": "QuickBooks AI assistant release",
      "primary_article_index": 1,
      "duplicate_indices": [2],
      "similarity_explanation": "Both report Intuit adding an AI-powered assistant to QuickBooks, focusing on automation for accountants."
    },
    {
      "topic_signature": "AI regulation in Europe",
      "primary_article_index": 3,
      "duplicate_indices": [4],
      "similarity_explanation": "Both describe EU passage of the AI Act, referring to the same regulatory milestone."
    }
  ],
  "unique_articles": [0, 5]
}'
    ),
    jsonb_build_object(
      'role', 'user',
      'content', 'Articles to analyze (array indices are 0-based — first article is index 0):

{{articles}}

Task: Identify and group duplicates or near-duplicates based on topic similarity, event type, or policy overlap related to AI and accounting. Return valid JSON with the arrays "groups" and "unique_articles" using 0-based indexing.'
    )
  )
)
WHERE key = 'ai_prompt_topic_deduper';

-- Verify the update
SELECT
  key,
  jsonb_typeof(value) as value_type,
  value->'model' as model,
  value->'temperature' as temperature,
  jsonb_array_length(value->'messages') as message_count
FROM app_settings
WHERE key = 'ai_prompt_topic_deduper';
