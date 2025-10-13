-- Create VRBO listings table for Minnesota Getaways section
CREATE TABLE IF NOT EXISTS vrbo_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    main_image_url TEXT,
    adjusted_image_url TEXT, -- GitHub hosted resized image URL
    city VARCHAR(100),
    bedrooms INTEGER,
    bathrooms DECIMAL(3,1), -- Allows for 1.5, 2.5 bathrooms
    sleeps INTEGER,
    link TEXT NOT NULL, -- Tracked affiliate link
    non_tracked_link TEXT, -- Original VRBO link
    listing_type VARCHAR(10) CHECK (listing_type IN ('Local', 'Greater')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vrbo_listings_type ON vrbo_listings(listing_type);
CREATE INDEX IF NOT EXISTS idx_vrbo_listings_active ON vrbo_listings(is_active);
CREATE INDEX IF NOT EXISTS idx_vrbo_listings_type_active ON vrbo_listings(listing_type, is_active);

-- Create table for tracking selected properties per campaign
CREATE TABLE IF NOT EXISTS campaign_vrbo_selections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
    listing_id UUID NOT NULL REFERENCES vrbo_listings(id) ON DELETE CASCADE,
    selection_order INTEGER NOT NULL, -- 1, 2, 3 for display order
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(campaign_id, listing_id),
    UNIQUE(campaign_id, selection_order)
);

-- Create table for tracking sequential selection state
CREATE TABLE IF NOT EXISTS vrbo_selection_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_type VARCHAR(10) NOT NULL CHECK (listing_type IN ('Local', 'Greater')),
    current_index INTEGER DEFAULT 0,
    shuffle_order JSON, -- Array of listing IDs in shuffled order
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(listing_type)
);

-- Create trigger to update updated_at timestamp for vrbo_listings
CREATE OR REPLACE FUNCTION update_vrbo_listings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_vrbo_listings_updated_at ON vrbo_listings;
CREATE TRIGGER trigger_update_vrbo_listings_updated_at
    BEFORE UPDATE ON vrbo_listings
    FOR EACH ROW
    EXECUTE FUNCTION update_vrbo_listings_updated_at();