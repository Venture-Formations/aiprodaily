-- Link Click Tracking System
-- Tracks all newsletter link clicks with comprehensive metadata

CREATE TABLE IF NOT EXISTS link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_date DATE NOT NULL,
  campaign_id TEXT,
  subscriber_email TEXT NOT NULL,
  subscriber_id TEXT,
  link_url TEXT NOT NULL,
  link_section TEXT NOT NULL,
  clicked_at TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_link_clicks_campaign_date ON link_clicks(campaign_date);
CREATE INDEX IF NOT EXISTS idx_link_clicks_campaign_id ON link_clicks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_subscriber_email ON link_clicks(subscriber_email);
CREATE INDEX IF NOT EXISTS idx_link_clicks_link_section ON link_clicks(link_section);
CREATE INDEX IF NOT EXISTS idx_link_clicks_clicked_at ON link_clicks(clicked_at);
CREATE INDEX IF NOT EXISTS idx_link_clicks_section_subscriber ON link_clicks(link_section, subscriber_email, campaign_date);

ALTER TABLE link_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access to link_clicks"
  ON link_clicks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
