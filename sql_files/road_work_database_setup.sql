-- Road Work Database Setup Script
-- This script sets up the database tables and configuration needed for the Road Work section

-- 1. Add Road Work section to newsletter_sections table
INSERT INTO newsletter_sections (name, display_order, is_active)
VALUES ('Road Work', 7, true)
ON CONFLICT (name) DO UPDATE SET
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

-- 2. Create road_work_data table to store generated road work information
CREATE TABLE IF NOT EXISTS road_work_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  road_work_data JSONB NOT NULL, -- Array of RoadWorkItem objects
  html_content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_road_work_data_campaign_id ON road_work_data(campaign_id);
CREATE INDEX IF NOT EXISTS idx_road_work_data_generated_at ON road_work_data(generated_at);
CREATE INDEX IF NOT EXISTS idx_road_work_data_is_active ON road_work_data(is_active);

-- 4. Create updated_at trigger for road_work_data table
CREATE OR REPLACE FUNCTION update_road_work_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_road_work_data_updated_at
  BEFORE UPDATE ON road_work_data
  FOR EACH ROW
  EXECUTE FUNCTION update_road_work_data_updated_at();

-- 5. Verify the setup
SELECT 'Road Work section added/updated' as status;
SELECT 'road_work_data table created' as status;
SELECT 'Indexes and triggers created' as status;

-- Show current newsletter sections
SELECT id, name, display_order, is_active, created_at
FROM newsletter_sections
ORDER BY display_order;