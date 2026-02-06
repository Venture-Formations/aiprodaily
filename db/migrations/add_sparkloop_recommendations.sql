-- Migration: Add SparkLoop Recommendations Tracking
-- Purpose: Store recommendation metadata and track our own performance metrics
-- Date: 2026-02-05

-- Table to store SparkLoop recommendation data and our metrics
CREATE TABLE IF NOT EXISTS sparkloop_recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  publication_id UUID REFERENCES publications(id) ON DELETE CASCADE,

  -- SparkLoop identifiers
  ref_code TEXT NOT NULL,
  sparkloop_uuid TEXT, -- SparkLoop's recommendation UUID

  -- Recommendation details
  publication_name TEXT NOT NULL,
  publication_logo TEXT,
  description TEXT,

  -- SparkLoop metadata
  status TEXT DEFAULT 'active', -- 'active', 'paused'
  cpa INTEGER, -- Payout in cents (e.g., 400 = $4.00)
  screening_period INTEGER, -- Days before referral is confirmed
  sparkloop_rcr NUMERIC(5,2), -- SparkLoop's 30-day confirmation rate (0-100)

  -- Our tracking metrics
  impressions INTEGER DEFAULT 0, -- Times shown in popup
  selections INTEGER DEFAULT 0, -- Times user selected this recommendation
  submissions INTEGER DEFAULT 0, -- Times submitted to SparkLoop
  confirms INTEGER DEFAULT 0, -- Confirmed referrals
  rejections INTEGER DEFAULT 0, -- Rejected referrals
  pending INTEGER DEFAULT 0, -- Currently pending referrals

  -- Our calculated RCR: confirms / (confirms + rejections) * 100
  -- NULL until we have enough data (min 10 confirms + rejections)
  our_rcr NUMERIC(5,2),

  -- Timestamps
  last_synced_at TIMESTAMPTZ, -- When we last pulled from SparkLoop API
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint per publication + ref_code
  UNIQUE(publication_id, ref_code)
);

-- Indexes for efficient lookups
CREATE INDEX idx_sparkloop_recs_publication ON sparkloop_recommendations(publication_id);
CREATE INDEX idx_sparkloop_recs_ref_code ON sparkloop_recommendations(ref_code);
CREATE INDEX idx_sparkloop_recs_status ON sparkloop_recommendations(status);
CREATE INDEX idx_sparkloop_recs_cpa ON sparkloop_recommendations(cpa DESC);

-- Enable RLS
ALTER TABLE sparkloop_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS policy for service role access
CREATE POLICY "Service role can manage sparkloop_recommendations"
  ON sparkloop_recommendations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to update our_rcr when confirms/rejections change
CREATE OR REPLACE FUNCTION update_sparkloop_rcr()
RETURNS TRIGGER AS $$
BEGIN
  -- Only calculate our_rcr if we have at least 10 total outcomes
  IF (NEW.confirms + NEW.rejections) >= 10 THEN
    NEW.our_rcr := ROUND((NEW.confirms::NUMERIC / (NEW.confirms + NEW.rejections)) * 100, 2);
  ELSE
    NEW.our_rcr := NULL;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update our_rcr
CREATE TRIGGER trigger_update_sparkloop_rcr
  BEFORE UPDATE ON sparkloop_recommendations
  FOR EACH ROW
  WHEN (OLD.confirms IS DISTINCT FROM NEW.confirms OR OLD.rejections IS DISTINCT FROM NEW.rejections)
  EXECUTE FUNCTION update_sparkloop_rcr();

-- Comments
COMMENT ON TABLE sparkloop_recommendations IS 'Stores SparkLoop recommendation data and our own performance metrics';
COMMENT ON COLUMN sparkloop_recommendations.cpa IS 'Cost per acquisition in cents (e.g., 400 = $4.00)';
COMMENT ON COLUMN sparkloop_recommendations.screening_period IS 'Days before a referral is confirmed or rejected';
COMMENT ON COLUMN sparkloop_recommendations.sparkloop_rcr IS 'SparkLoop 30-day confirmation rate (percentage)';
COMMENT ON COLUMN sparkloop_recommendations.our_rcr IS 'Our calculated RCR based on our confirms/rejections (NULL until 10+ outcomes)';
COMMENT ON COLUMN sparkloop_recommendations.impressions IS 'Number of times this recommendation was shown in the popup';
COMMENT ON COLUMN sparkloop_recommendations.selections IS 'Number of times a user checked/selected this recommendation';
COMMENT ON COLUMN sparkloop_recommendations.submissions IS 'Number of times this was submitted to SparkLoop for subscription';
