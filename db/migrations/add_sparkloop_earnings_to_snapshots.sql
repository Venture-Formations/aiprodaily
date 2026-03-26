-- Add sparkloop_earnings to daily snapshots for actual earnings tracking
-- Previously we estimated earnings as confirms × CPA, which is inaccurate when CPA changes over time
ALTER TABLE sparkloop_daily_snapshots
  ADD COLUMN IF NOT EXISTS sparkloop_earnings integer DEFAULT 0;
