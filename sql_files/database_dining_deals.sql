-- Create Dining Deals table for newsletter campaigns
CREATE TABLE IF NOT EXISTS dining_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name VARCHAR(255) NOT NULL,
    business_address TEXT,
    google_profile TEXT, -- Google Maps URL
    day_of_week VARCHAR(10) NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
    special_description TEXT NOT NULL,
    special_time VARCHAR(100), -- e.g., "11AM - 3PM", "All day", etc.
    is_featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_dining_deals_day_of_week ON dining_deals(day_of_week);
CREATE INDEX IF NOT EXISTS idx_dining_deals_active ON dining_deals(is_active);
CREATE INDEX IF NOT EXISTS idx_dining_deals_featured ON dining_deals(is_featured);
CREATE INDEX IF NOT EXISTS idx_dining_deals_day_active ON dining_deals(day_of_week, is_active);
CREATE INDEX IF NOT EXISTS idx_dining_deals_day_featured ON dining_deals(day_of_week, is_featured, is_active);

-- Create table for tracking selected deals per campaign
CREATE TABLE IF NOT EXISTS campaign_dining_selections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
    deal_id UUID NOT NULL REFERENCES dining_deals(id) ON DELETE CASCADE,
    selection_order INTEGER NOT NULL, -- 1-8 for display order
    is_featured_in_campaign BOOLEAN DEFAULT false, -- Whether this deal is featured in this campaign
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(campaign_id, deal_id),
    UNIQUE(campaign_id, selection_order)
);

-- Create trigger to update updated_at timestamp for dining_deals
CREATE OR REPLACE FUNCTION update_dining_deals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_dining_deals_updated_at ON dining_deals;
CREATE TRIGGER trigger_update_dining_deals_updated_at
    BEFORE UPDATE ON dining_deals
    FOR EACH ROW
    EXECUTE FUNCTION update_dining_deals_updated_at();