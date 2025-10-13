-- Feedback Tracking System Migration
-- Creates table to store user feedback on newsletter sections

-- Create feedback_responses table
CREATE TABLE IF NOT EXISTS feedback_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_date DATE NOT NULL,
  section_choice TEXT NOT NULL,
  subscriber_email TEXT NOT NULL,
  mailerlite_updated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes for analytics queries
  CONSTRAINT feedback_responses_unique UNIQUE (campaign_date, subscriber_email)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_feedback_campaign_date ON feedback_responses(campaign_date);
CREATE INDEX IF NOT EXISTS idx_feedback_section_choice ON feedback_responses(section_choice);
CREATE INDEX IF NOT EXISTS idx_feedback_subscriber_email ON feedback_responses(subscriber_email);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback_responses(created_at);

-- Add RLS policies
ALTER TABLE feedback_responses ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage all feedback
CREATE POLICY "Service role can manage feedback"
  ON feedback_responses
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to view feedback data (for analytics)
CREATE POLICY "Authenticated users can view feedback"
  ON feedback_responses
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE feedback_responses IS 'Stores user feedback on newsletter sections with MailerLite integration';
COMMENT ON COLUMN feedback_responses.campaign_date IS 'Date of the newsletter campaign';
COMMENT ON COLUMN feedback_responses.section_choice IS 'Section the user found most valuable';
COMMENT ON COLUMN feedback_responses.subscriber_email IS 'Email of the subscriber who submitted feedback';
COMMENT ON COLUMN feedback_responses.mailerlite_updated IS 'Whether the MailerLite custom field was successfully updated';
