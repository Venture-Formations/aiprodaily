-- Local Events Feature Database Migration
-- This creates the tables needed for the Local Events section
-- Run this against your Supabase database

-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  venue VARCHAR(255),
  address TEXT,
  url VARCHAR(500),
  image_url VARCHAR(500),
  featured BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for events table
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_featured ON events(featured);
CREATE INDEX IF NOT EXISTS idx_events_active ON events(active);
CREATE INDEX IF NOT EXISTS idx_events_external_id ON events(external_id);

-- Create campaign_events table
CREATE TABLE IF NOT EXISTS campaign_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  is_selected BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  display_order INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for campaign_events table
CREATE INDEX IF NOT EXISTS idx_campaign_events_campaign ON campaign_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_events_date ON campaign_events(event_date);
CREATE INDEX IF NOT EXISTS idx_campaign_events_event ON campaign_events(event_id);

-- Create newsletter_sections table
CREATE TABLE IF NOT EXISTS newsletter_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  display_order INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default sections (only if they don't exist)
INSERT INTO newsletter_sections (name, display_order)
SELECT 'The Local Scoop', 1
WHERE NOT EXISTS (SELECT 1 FROM newsletter_sections WHERE name = 'The Local Scoop');

INSERT INTO newsletter_sections (name, display_order)
SELECT 'Local Events', 2
WHERE NOT EXISTS (SELECT 1 FROM newsletter_sections WHERE name = 'Local Events');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for events table
DROP TRIGGER IF EXISTS update_events_updated_at ON events;
CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions (adjust role name as needed)
-- Note: Using UUIDs instead of SERIAL, so no sequences to grant
-- GRANT SELECT, INSERT, UPDATE, DELETE ON events TO authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON campaign_events TO authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON newsletter_sections TO authenticated;