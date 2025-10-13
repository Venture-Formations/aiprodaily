-- Link Click Tracking System
-- Tracks all newsletter link clicks with comprehensive metadata

CREATE TABLE IF NOT EXISTS link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Campaign Information
  campaign_date DATE NOT NULL,
  campaign_id TEXT,  -- MailerLite campaign ID

  -- Subscriber Information
  subscriber_email TEXT NOT NULL,
  subscriber_id TEXT,  -- MailerLite subscriber ID

  -- Link Information
  link_url TEXT NOT NULL,
  link_section TEXT NOT NULL,  -- Section where link was located (Local Scoop, Local Events, etc.)

  -- Tracking Metadata
  clicked_at TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT,
  ip_address TEXT,

  -- Indexes for performance
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_link_clicks_campaign_date ON link_clicks(campaign_date);
CREATE INDEX IF NOT EXISTS idx_link_clicks_campaign_id ON link_clicks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_subscriber_email ON link_clicks(subscriber_email);
CREATE INDEX IF NOT EXISTS idx_link_clicks_link_section ON link_clicks(link_section);
CREATE INDEX IF NOT EXISTS idx_link_clicks_clicked_at ON link_clicks(clicked_at);

-- Composite index for unique user click analytics
CREATE INDEX IF NOT EXISTS idx_link_clicks_section_subscriber ON link_clicks(link_section, subscriber_email, campaign_date);

-- Enable Row Level Security
ALTER TABLE link_clicks ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role full access
CREATE POLICY "Allow service role full access to link_clicks"
  ON link_clicks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE link_clicks IS 'Tracks all newsletter link clicks with campaign and subscriber metadata';
COMMENT ON COLUMN link_clicks.campaign_id IS 'MailerLite campaign ID from which the link was clicked';
COMMENT ON COLUMN link_clicks.subscriber_id IS 'MailerLite subscriber ID who clicked the link';
COMMENT ON COLUMN link_clicks.link_section IS 'Newsletter section containing the clicked link';
COMMENT ON COLUMN link_clicks.link_url IS 'Full URL that was clicked';
