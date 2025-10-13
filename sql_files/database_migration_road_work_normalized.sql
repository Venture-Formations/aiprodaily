-- Road Work Database Migration: Normalize from JSON to separate columns
-- Run this in Supabase SQL Editor

-- Step 1: Create the new normalized road_work_items table
CREATE TABLE road_work_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  road_name TEXT NOT NULL,
  road_range TEXT,
  city_or_township TEXT,
  reason TEXT,
  start_date DATE,
  expected_reopen DATE,
  source_url TEXT,
  display_order INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create indexes for better performance
CREATE INDEX idx_road_work_items_campaign_id ON road_work_items(campaign_id);
CREATE INDEX idx_road_work_items_is_active ON road_work_items(is_active);
CREATE INDEX idx_road_work_items_display_order ON road_work_items(display_order);

-- Step 3: Add RLS (Row Level Security) policies if needed
-- ALTER TABLE road_work_items ENABLE ROW LEVEL SECURITY;

-- Step 4: Grant permissions
-- GRANT ALL ON road_work_items TO authenticated;
-- GRANT ALL ON road_work_items TO service_role;

-- Note: After creating this table, update the TypeScript types and code
-- to use the new normalized structure instead of JSON storage