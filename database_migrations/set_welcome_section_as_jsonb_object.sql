-- Set the welcome section prompt as a proper JSONB object
-- This preserves the exact prompt content while fixing the storage format

UPDATE app_settings
SET value = jsonb_build_object(
  'model', 'gpt-4o',
  'temperature', 0.75,
  'top_p', 0.9,
  'presence_penalty', 0.3,
  'frequency_penalty', 0.2,
  'messages', jsonb_build_array(
    jsonb_build_object(
      'role', 'system',
      'content', '
You are writing a welcoming introduction for AI Accounting Daily — a daily newsletter about how AI is transforming the accounting world.

STYLE:
- Conversational and friendly tone.
- Intro that starts with ''Hey, [Audience]!'' (use an appropriate audience name like ''Accounting Pros'' or ''Finance Pros'').
- Include tagline: e.g., ''Welcome back to AI Accounting Daily, your #1 source for AI news in accounting.''
- Create a summary by weaving in 3–5 key stories from today''s newsletter in a natural, flowing sentence.
- Use engaging, curiosity-driven language.
- End smoothly — no abrupt cutoffs.

GUIDELINES:
- Use formats like ''Today, we''ve got…'', ''Today, we''re covering…'', or ''Today, we''re taking a look at…''.
- Connect stories with commas and ''and'' before the last one.
- Each story should be a short phrase — not full headlines.
- Highlight the most interesting or newsworthy angles.
- Keep the total length to 3–4 sentences.
- Focus on natural rhythm and readability.

OUTPUT FORMAT (STRICT):
Respond ONLY with valid JSON in exactly this shape:
{
  "intro": "<Hey, [Audience]! line>",
  "tagline": "<Welcome line>",
  "summary": "<2–3 sentence summary>"
}

HARD CONSTRAINTS:
- Output exactly three keys: intro, tagline, summary.
- Do NOT include any other keys.
- Do NOT add text before or after the JSON object.
- Ensure the summary reads naturally and ends smoothly.'
    ),
    jsonb_build_object(
      'role', 'assistant',
      'content', '{
  "intro": "Hey, Accounting Pros!",
  "tagline": "Welcome back to AI Accounting Daily, your #1 source for AI news in accounting.",
  "summary": "Today, we''re taking a look at how automation is speeding up audits, why regulators are watching AI use in tax prep, and how firms are training staff for the tech ahead."
}'
    ),
    jsonb_build_object(
      'role', 'assistant',
      'content', '{
  "intro": "Hey, Finance Pros!",
  "tagline": "Welcome back to AI Accounting Daily, your daily dose of smart insights in the accounting world.",
  "summary": "Today, we''ve got tools that cut close time in half, new IRS guidance on automation reporting, and a look at AI''s role in fraud detection."
}'
    ),
    jsonb_build_object(
      'role', 'assistant',
      'content', '{
  "intro": "Hey, Accounting Pros!",
  "tagline": "Welcome back to AI Accounting Daily, your go-to source for what''s next in accounting tech.",
  "summary": "Today, we''re covering AI assistants in audit, the rise of predictive analytics, and how client onboarding is changing fast."
}'
    ),
    jsonb_build_object(
      'role', 'user',
      'content', '
ARTICLES TO SUMMARIZE (Primary and Secondary): {{articles}}

Task: Write a conversational, friendly introduction that includes 3–5 of the most compelling stories. Follow the format and tone described above. Return your response as valid JSON with only the keys intro, tagline, and summary.'
    )
  )
)
WHERE key = 'ai_prompt_welcome_section';

-- Verify the update
SELECT
  key,
  pg_typeof(value) as column_type,
  jsonb_typeof(value) as value_type,
  value->'messages' IS NOT NULL as has_messages,
  jsonb_array_length(value->'messages') as message_count,
  value->'model' as model
FROM app_settings
WHERE key = 'ai_prompt_welcome_section';
