-- Add confirmed_impressions columns to sparkloop_recommendations
-- These count impressions only from subscribers who completed signup
ALTER TABLE sparkloop_recommendations
  ADD COLUMN IF NOT EXISTS confirmed_impressions integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confirmed_page_impressions integer DEFAULT 0;

-- RPC to increment confirmed popup impressions
CREATE OR REPLACE FUNCTION increment_sparkloop_confirmed_impressions(
  p_publication_id uuid,
  p_ref_codes text[]
)
RETURNS void AS $$
BEGIN
  UPDATE sparkloop_recommendations
  SET confirmed_impressions = confirmed_impressions + 1
  WHERE publication_id = p_publication_id
    AND ref_code = ANY(p_ref_codes);
END;
$$ LANGUAGE plpgsql;

-- RPC to increment confirmed page impressions
CREATE OR REPLACE FUNCTION increment_sparkloop_confirmed_page_impressions(
  p_publication_id uuid,
  p_ref_codes text[]
)
RETURNS void AS $$
BEGIN
  UPDATE sparkloop_recommendations
  SET confirmed_page_impressions = confirmed_page_impressions + 1
  WHERE publication_id = p_publication_id
    AND ref_code = ANY(p_ref_codes);
END;
$$ LANGUAGE plpgsql;
