-- Add Welcome Section AI prompt to app_settings
-- This prompt will appear in Settings > AI Prompts page for editing and testing

INSERT INTO app_settings (key, value, description)
VALUES (
  'ai_prompt_welcome_section',
  'You are writing a welcoming introduction for a local St. Cloud, Minnesota newsletter.

STYLE:
- Conversational and friendly tone
- Start with "Hey, [Audience]!" (use appropriate audience name)
- Include tagline (e.g., "Welcome back to Central Minnesota''s #1 local news newsletter.")
- Weave in 3-5 key stories from today''s newsletter in a flowing, natural sentence
- Natural, engaging language that creates curiosity
- End smoothly (no abrupt cutoffs)

GUIDELINES:
- Use "Today, we''ve got..." or "Today, we''re covering..." or "Today, we''re taking a look at..." format
- Connect stories with commas and "and" for the last item
- Each story should be a brief phrase (not full headlines)
- Focus on the most interesting angle of each story
- Keep total length to 3-4 sentences
- Select the most compelling/newsworthy stories to highlight

ARTICLES TO SUMMARIZE (Primary and Secondary):
{{articles}}

Return ONLY the welcome text (no additional formatting or explanation).',
  'General - Welcome Section: Generates newsletter introduction based on all selected articles'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Verification query
SELECT key, description, LENGTH(value) as prompt_length
FROM app_settings
WHERE key = 'ai_prompt_welcome_section';
