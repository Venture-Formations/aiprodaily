-- Database migration for Advertisements feature
-- Community Business Spotlight

-- Create advertisements table
CREATE TABLE IF NOT EXISTS advertisements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL, -- Rich text HTML
  word_count INTEGER NOT NULL,
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  business_address TEXT,
  business_website TEXT,
  frequency TEXT NOT NULL CHECK (frequency IN ('single', 'weekly', 'monthly')),
  times_paid INTEGER NOT NULL DEFAULT 0,
  times_used INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'pending_review', 'approved', 'active', 'completed', 'rejected')),
  preferred_start_date DATE,
  actual_start_date DATE,
  last_used_date DATE,
  payment_intent_id TEXT,
  payment_amount DECIMAL(10, 2),
  payment_status TEXT,
  submission_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create campaign_advertisements junction table
CREATE TABLE IF NOT EXISTS campaign_advertisements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  advertisement_id UUID NOT NULL REFERENCES advertisements(id) ON DELETE CASCADE,
  campaign_date DATE NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, advertisement_id)
);

-- Create ad_pricing_tiers table
CREATE TABLE IF NOT EXISTS ad_pricing_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frequency TEXT NOT NULL CHECK (frequency IN ('single', 'weekly', 'monthly')),
  min_quantity INTEGER NOT NULL,
  max_quantity INTEGER, -- NULL means unlimited
  price_per_unit DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(frequency, min_quantity)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_advertisements_status ON advertisements(status);
CREATE INDEX IF NOT EXISTS idx_advertisements_frequency ON advertisements(frequency);
CREATE INDEX IF NOT EXISTS idx_advertisements_preferred_start_date ON advertisements(preferred_start_date);
CREATE INDEX IF NOT EXISTS idx_advertisements_submission_date ON advertisements(submission_date);
CREATE INDEX IF NOT EXISTS idx_campaign_advertisements_campaign_id ON campaign_advertisements(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_advertisements_advertisement_id ON campaign_advertisements(advertisement_id);
CREATE INDEX IF NOT EXISTS idx_campaign_advertisements_campaign_date ON campaign_advertisements(campaign_date);

-- Create updated_at trigger for advertisements
CREATE OR REPLACE FUNCTION update_advertisements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_advertisements_updated_at
  BEFORE UPDATE ON advertisements
  FOR EACH ROW
  EXECUTE FUNCTION update_advertisements_updated_at();

-- Create updated_at trigger for ad_pricing_tiers
CREATE OR REPLACE FUNCTION update_ad_pricing_tiers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ad_pricing_tiers_updated_at
  BEFORE UPDATE ON ad_pricing_tiers
  FOR EACH ROW
  EXECUTE FUNCTION update_ad_pricing_tiers_updated_at();

-- Insert default pricing tiers (you can modify these values later in Settings)
INSERT INTO ad_pricing_tiers (frequency, min_quantity, max_quantity, price_per_unit) VALUES
  -- Single appearance pricing tiers
  ('single', 1, 5, 50.00),
  ('single', 6, 10, 45.00),
  ('single', 11, 20, 40.00),

  -- Weekly pricing tiers (price is per week)
  ('weekly', 1, 4, 200.00),
  ('weekly', 5, 8, 180.00),
  ('weekly', 9, 20, 160.00),

  -- Monthly pricing tiers (price is per month)
  ('monthly', 1, 3, 600.00),
  ('monthly', 4, 6, 550.00),
  ('monthly', 7, 20, 500.00)
ON CONFLICT (frequency, min_quantity) DO NOTHING;

-- Add Community Business Spotlight section to newsletter_sections
INSERT INTO newsletter_sections (name, display_order, is_active)
VALUES ('Community Business Spotlight', 8, true)
ON CONFLICT DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE advertisements IS 'Stores advertorial submissions for Community Business Spotlight section';
COMMENT ON TABLE campaign_advertisements IS 'Junction table tracking which ads were used in which campaigns';
COMMENT ON TABLE ad_pricing_tiers IS 'Configurable pricing tiers for advertisement purchases';
COMMENT ON COLUMN advertisements.body IS 'Rich text HTML content with formatting';
COMMENT ON COLUMN advertisements.word_count IS 'Word count of body text (max 100 words)';
COMMENT ON COLUMN advertisements.frequency IS 'How often the ad should appear: single, weekly, or monthly';
COMMENT ON COLUMN advertisements.times_paid IS 'Number of appearances purchased';
COMMENT ON COLUMN advertisements.times_used IS 'Number of times ad has appeared in newsletters';
