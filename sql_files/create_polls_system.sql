-- Poll System Database Schema
-- Run this in Supabase SQL Editor

-- Create polls table
CREATE TABLE IF NOT EXISTS polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create poll_responses table
CREATE TABLE IF NOT EXISTS poll_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  campaign_id TEXT,
  subscriber_email TEXT NOT NULL,
  selected_option TEXT NOT NULL,
  responded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(poll_id, subscriber_email)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_polls_is_active ON polls(is_active);
CREATE INDEX IF NOT EXISTS idx_poll_responses_poll_id ON poll_responses(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_responses_subscriber_email ON poll_responses(subscriber_email);
CREATE INDEX IF NOT EXISTS idx_poll_responses_campaign_id ON poll_responses(campaign_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for polls table
DROP TRIGGER IF EXISTS update_polls_updated_at ON polls;
CREATE TRIGGER update_polls_updated_at
  BEFORE UPDATE ON polls
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert initial poll (migrating from feedback section)
INSERT INTO polls (title, question, options, is_active)
VALUES (
  'Your opinion matters!',
  'Which section of today''s Scoop did you find the most valuable?',
  '["Weather", "The Local Scoop", "Local Events", "Dining Deals", "Yesterday''s Wordle", "Road Work"]'::jsonb,
  true
)
ON CONFLICT DO NOTHING;

-- Grant necessary permissions (adjust if needed)
-- ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE poll_responses ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE polls IS 'Stores poll questions and configuration';
COMMENT ON TABLE poll_responses IS 'Stores individual subscriber responses to polls';
COMMENT ON COLUMN poll_responses.subscriber_email IS 'Email from campaign tracking link';
COMMENT ON COLUMN poll_responses.campaign_id IS 'Newsletter campaign ID this response came from';
