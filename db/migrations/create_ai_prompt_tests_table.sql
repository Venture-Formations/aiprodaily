-- Create table for storing AI prompt test configurations
-- This allows users to save and load their test prompts across devices

CREATE TABLE IF NOT EXISTS ai_prompt_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL, -- Email from session
  newsletter_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'claude')),
  model TEXT NOT NULL,
  prompt_type TEXT NOT NULL CHECK (prompt_type IN ('article-title', 'article-body', 'post-scorer', 'subject-line', 'custom')),
  prompt TEXT NOT NULL,
  parameters JSONB DEFAULT '{}', -- Store temperature, max_tokens, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one saved prompt per user/newsletter/provider/model/type combination
  UNIQUE(user_id, newsletter_id, provider, model, prompt_type)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_prompt_tests_user_newsletter
  ON ai_prompt_tests(user_id, newsletter_id);

-- Add RLS policies
ALTER TABLE ai_prompt_tests ENABLE ROW LEVEL SECURITY;

-- Users can only see their own prompts
CREATE POLICY "Users can view own prompts"
  ON ai_prompt_tests FOR SELECT
  USING (true); -- Allow admin view in supabase, restrict in API

-- Users can insert their own prompts
CREATE POLICY "Users can insert own prompts"
  ON ai_prompt_tests FOR INSERT
  WITH CHECK (true); -- Restrict in API

-- Users can update their own prompts
CREATE POLICY "Users can update own prompts"
  ON ai_prompt_tests FOR UPDATE
  USING (true); -- Restrict in API

-- Users can delete their own prompts
CREATE POLICY "Users can delete own prompts"
  ON ai_prompt_tests FOR DELETE
  USING (true); -- Restrict in API

-- Add comment
COMMENT ON TABLE ai_prompt_tests IS 'Stores saved AI prompt configurations for the testing playground';
