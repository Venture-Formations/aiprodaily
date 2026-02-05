-- Migration: Add SparkLoop Events Tracking
-- Purpose: Track SparkLoop webhook events (referrals, offer leads, etc.)
-- Date: 2026-02-05

-- Table to store SparkLoop webhook events
CREATE TABLE IF NOT EXISTS sparkloop_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  publication_id UUID REFERENCES publications(id) ON DELETE CASCADE,

  -- Event metadata
  event_type TEXT NOT NULL, -- 'new_offer_lead', 'new_referral', 'reward_unlocked', etc.
  event_id TEXT, -- SparkLoop's event ID if provided

  -- Subscriber info
  subscriber_email TEXT NOT NULL,
  subscriber_uuid TEXT, -- SparkLoop's subscriber UUID

  -- Referral/offer details
  referred_publication TEXT, -- Name of newsletter they subscribed to (for new_offer_lead)
  referred_publication_id TEXT, -- SparkLoop's publication ID
  referrer_email TEXT, -- Email of person who referred them (for new_referral)
  referrer_uuid TEXT,

  -- Reward details (for reward events)
  reward_name TEXT,
  reward_id TEXT,

  -- Raw payload for debugging
  raw_payload JSONB,

  -- Timestamps
  event_timestamp TIMESTAMPTZ, -- When SparkLoop says it happened
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate events
  UNIQUE(event_type, subscriber_email, event_timestamp)
);

-- Indexes for efficient lookups
CREATE INDEX idx_sparkloop_events_publication ON sparkloop_events(publication_id);
CREATE INDEX idx_sparkloop_events_email ON sparkloop_events(subscriber_email);
CREATE INDEX idx_sparkloop_events_type ON sparkloop_events(event_type);
CREATE INDEX idx_sparkloop_events_created ON sparkloop_events(created_at DESC);

-- Enable RLS
ALTER TABLE sparkloop_events ENABLE ROW LEVEL SECURITY;

-- RLS policy for service role access
CREATE POLICY "Service role can manage sparkloop_events"
  ON sparkloop_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE sparkloop_events IS 'Tracks SparkLoop webhook events for referral and offer attribution';
COMMENT ON COLUMN sparkloop_events.event_type IS 'Type: new_offer_lead, new_referral, new_partner_referral, reward_unlocked, reward_redeemed, sync_subscriber';
COMMENT ON COLUMN sparkloop_events.referred_publication IS 'For new_offer_lead: the newsletter the subscriber opted into';
