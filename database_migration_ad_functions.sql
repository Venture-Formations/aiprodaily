-- Database functions for advertisement usage tracking

-- Function to increment ad usage counter and auto-complete
CREATE OR REPLACE FUNCTION increment_ad_usage(ad_id UUID)
RETURNS void AS $$
DECLARE
  current_used INTEGER;
  total_paid INTEGER;
  new_status TEXT;
BEGIN
  -- Get current counts
  SELECT times_used, times_paid INTO current_used, total_paid
  FROM advertisements
  WHERE id = ad_id;

  -- Calculate new values
  current_used := current_used + 1;

  -- Determine new status
  IF current_used >= total_paid THEN
    new_status := 'completed';
  ELSE
    new_status := 'active';
  END IF;

  -- Update the advertisement
  UPDATE advertisements
  SET
    times_used = current_used,
    status = new_status,
    updated_at = NOW()
  WHERE id = ad_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check if ad needs to be scheduled
CREATE OR REPLACE FUNCTION should_schedule_ad(ad_id UUID, check_date DATE)
RETURNS BOOLEAN AS $$
DECLARE
  ad_record RECORD;
  used_count INTEGER;
BEGIN
  -- Get ad details
  SELECT * INTO ad_record
  FROM advertisements
  WHERE id = ad_id;

  -- Check if ad is active and hasn't reached limit
  IF ad_record.status NOT IN ('approved', 'active') THEN
    RETURN FALSE;
  END IF;

  IF ad_record.times_used >= ad_record.times_paid THEN
    RETURN FALSE;
  END IF;

  -- Check if already used on this date
  SELECT COUNT(*) INTO used_count
  FROM campaign_advertisements
  WHERE advertisement_id = ad_id
    AND campaign_date = check_date;

  IF used_count > 0 THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON FUNCTION increment_ad_usage IS 'Increments ad usage counter and auto-completes when limit reached';
COMMENT ON FUNCTION should_schedule_ad IS 'Checks if an ad should be scheduled for a given date';
