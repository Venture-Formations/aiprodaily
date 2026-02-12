-- Add sparkloop_daily_snapshots table for tracking daily aggregate changes
-- Used to calculate rolling window RCR and slippage metrics

CREATE TABLE sparkloop_daily_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  publication_id UUID NOT NULL REFERENCES publications(id),
  ref_code TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  sparkloop_confirmed INTEGER NOT NULL DEFAULT 0,
  sparkloop_rejected INTEGER NOT NULL DEFAULT 0,
  sparkloop_pending INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(publication_id, ref_code, snapshot_date)
);

CREATE INDEX idx_sl_snapshots_lookup
  ON sparkloop_daily_snapshots(publication_id, ref_code, snapshot_date DESC);
