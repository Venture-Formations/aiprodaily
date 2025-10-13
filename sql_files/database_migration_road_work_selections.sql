-- Create campaign_road_work_selections table
-- This table stores which road work items are selected for each campaign (max 9)
-- Similar to campaign_dining_selections

CREATE TABLE IF NOT EXISTS campaign_road_work_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  road_work_item_id UUID NOT NULL REFERENCES road_work_items(id) ON DELETE CASCADE,
  selection_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure no duplicate selections for same campaign + item
  UNIQUE(campaign_id, road_work_item_id),

  -- Ensure no duplicate selection orders within a campaign
  UNIQUE(campaign_id, selection_order)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_campaign_road_work_selections_campaign
  ON campaign_road_work_selections(campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaign_road_work_selections_item
  ON campaign_road_work_selections(road_work_item_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_campaign_road_work_selections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_campaign_road_work_selections_timestamp
  BEFORE UPDATE ON campaign_road_work_selections
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_road_work_selections_updated_at();

-- Grant permissions
GRANT ALL ON campaign_road_work_selections TO authenticated;
GRANT ALL ON campaign_road_work_selections TO service_role;

-- Success message
SELECT 'campaign_road_work_selections table created successfully!' as result;
