-- Migration: Add newsletter ad scheduling support
-- This enables multi-date ad purchases and Stripe integration

-- 1. Add new columns to advertisements table
ALTER TABLE advertisements 
  ADD COLUMN IF NOT EXISTS use_next_available BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS next_available_days INTEGER,
  ADD COLUMN IF NOT EXISTS total_amount INTEGER,
  ADD COLUMN IF NOT EXISTS num_days INTEGER,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS button_text TEXT DEFAULT 'Learn More';

-- Add status for pending_payment
COMMENT ON COLUMN advertisements.status IS 
  'Status: pending_payment, pending_review, in_progress, awaiting_approval, approved, active, completed, rejected';

-- 2. Create advertisement_dates junction table for multi-date scheduling
CREATE TABLE IF NOT EXISTS advertisement_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertisement_id UUID NOT NULL REFERENCES advertisements(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, scheduled, sent, cancelled
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(advertisement_id, scheduled_date)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_advertisement_dates_ad_id 
  ON advertisement_dates(advertisement_id);

CREATE INDEX IF NOT EXISTS idx_advertisement_dates_date 
  ON advertisement_dates(scheduled_date);

CREATE INDEX IF NOT EXISTS idx_advertisement_dates_status_date 
  ON advertisement_dates(status, scheduled_date);

-- Comments for documentation
COMMENT ON TABLE advertisement_dates IS 
  'Stores scheduled dates for each advertisement. One ad can have multiple dates.';

COMMENT ON COLUMN advertisement_dates.scheduled_date IS 
  'The date this ad is scheduled to appear in the newsletter.';

COMMENT ON COLUMN advertisement_dates.status IS 
  'Status: pending (not paid/confirmed), scheduled (ready to send), sent (delivered), cancelled';

COMMENT ON COLUMN advertisements.use_next_available IS 
  'If true, admin assigns dates. If false, customer selected specific dates.';

COMMENT ON COLUMN advertisements.next_available_days IS 
  'Number of days requested when use_next_available is true.';

COMMENT ON COLUMN advertisements.total_amount IS 
  'Total amount paid in dollars (not cents).';

COMMENT ON COLUMN advertisements.num_days IS 
  'Total number of newsletter days purchased.';

-- 3. Add stripe_customer_id to tools_directory if not exists
ALTER TABLE tools_directory 
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_tools_directory_stripe_customer 
  ON tools_directory(stripe_customer_id);

-- 4. Function to get the next available ad date (helper for admin)
CREATE OR REPLACE FUNCTION get_next_available_ad_date(p_ad_type TEXT DEFAULT 'main_sponsor')
RETURNS DATE AS $$
DECLARE
  next_date DATE;
BEGIN
  -- Start from tomorrow
  next_date := CURRENT_DATE + 1;
  
  -- Find the first date not already booked
  WHILE EXISTS (
    SELECT 1 
    FROM advertisement_dates ad
    JOIN advertisements a ON ad.advertisement_id = a.id
    WHERE ad.scheduled_date = next_date
      AND ad.status IN ('scheduled', 'sent')
      AND a.ad_type = p_ad_type
  ) LOOP
    next_date := next_date + 1;
  END LOOP;
  
  RETURN next_date;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_next_available_ad_date IS 
  'Returns the next date without a scheduled ad of the given type.';

-- 5. Function to get ad for a specific newsletter date
CREATE OR REPLACE FUNCTION get_newsletter_ad_for_date(
  p_date DATE,
  p_ad_type TEXT DEFAULT 'main_sponsor'
)
RETURNS TABLE (
  ad_id UUID,
  company_name TEXT,
  title TEXT,
  description TEXT,
  url TEXT,
  button_text TEXT,
  image_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id AS ad_id,
    a.company_name,
    a.title,
    a.description,
    a.url,
    a.button_text,
    a.image_url
  FROM advertisements a
  JOIN advertisement_dates ad ON ad.advertisement_id = a.id
  WHERE ad.scheduled_date = p_date
    AND ad.status = 'scheduled'
    AND a.ad_type = p_ad_type
    AND a.status = 'approved'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_newsletter_ad_for_date IS 
  'Returns the approved ad scheduled for a specific date, used during newsletter generation.';

