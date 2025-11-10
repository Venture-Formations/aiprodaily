-- Update Welcome Section AI prompt to return structured JSON with 3 parts
-- This allows separate formatting of intro, tagline, and summary

UPDATE app_settings
SET value = 'You are writing a welcoming introduction for a newsletter.

STRUCTURE:
Your response must be valid JSON with exactly 3 fields:
{
  "intro": "Opening greeting",
  "tagline": "Newsletter tagline or welcome back message",
  "summary": "Summary of today''s articles"
}

STYLE GUIDELINES:

**Intro:**
- Short greeting (e.g., "Hey, AI Enthusiast!" or "Hey, Central Minnesota!")
- Use appropriate audience name for the newsletter
- Keep it to one short sentence

**Tagline:**
- Welcome back message or newsletter tagline
- Examples: "Welcome back to the world''s #1 AI newsletter." or "Welcome back to Central Minnesota''s #1 local news newsletter."
- Keep it to one sentence

**Summary:**
- Weave in 3-5 key stories from today''s newsletter in a flowing, natural sentence
- Use "Today, we''ve got..." or "Today, we''re covering..." or "Today, we''re taking a look at..." format
- Connect stories with commas and "and" for the last item
- Each story should be a brief phrase (not full headlines)
- Focus on the most interesting angle of each story
- Natural, engaging language that creates curiosity
- End smoothly (no abrupt cutoffs)
- Keep to 2-3 sentences total

ARTICLES TO SUMMARIZE (Primary and Secondary):
{{articles}}

IMPORTANT: Return ONLY valid JSON. Do not include any text before or after the JSON object.

Example format:
{
  "intro": "Hey, AI Enthusiast!",
  "tagline": "Welcome back to the world''s #1 AI newsletter.",
  "summary": "Today, we''ve got a groundbreaking AI tool revolutionizing tax prep for CPAs, new AICPA guidelines on AI use in auditing, and a study showing 78% of accounting firms planning AI adoption. Plus, we''re covering the latest IRS ruling on AI-generated tax forms and QuickBooks'' new real-time anomaly detection feature."
}',
  description = 'General - Welcome Section: Generates newsletter introduction with 3 parts (intro, tagline, summary) as JSON',
  updated_at = NOW()
WHERE key = 'ai_prompt_welcome_section';

-- Verification query
SELECT
  key,
  description,
  LENGTH(value) as prompt_length,
  SUBSTRING(value, 1, 100) as prompt_preview
FROM app_settings
WHERE key = 'ai_prompt_welcome_section';
