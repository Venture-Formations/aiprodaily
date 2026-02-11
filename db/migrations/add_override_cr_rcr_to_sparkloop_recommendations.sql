-- Add override columns for manual CR/RCR overrides in score calculation
-- When NULL = no override (use calculated/default). When set = fully replaces effective value.
-- Sync code doesn't touch these columns, so overrides persist across syncs.
ALTER TABLE sparkloop_recommendations
  ADD COLUMN IF NOT EXISTS override_cr NUMERIC(5,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS override_rcr NUMERIC(5,2) DEFAULT NULL;
