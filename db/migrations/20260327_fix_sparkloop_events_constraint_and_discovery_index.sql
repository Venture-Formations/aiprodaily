-- Fix sparkloop_events unique constraint to include publication_id
-- Without this, two publications receiving the same event for the same subscriber
-- would collide — the second insert silently fails.

-- Drop the cross-tenant unique constraint
ALTER TABLE sparkloop_events
  DROP CONSTRAINT IF EXISTS sparkloop_events_event_type_subscriber_email_event_timestam_key;

-- Add multi-tenant-safe unique constraint
ALTER TABLE sparkloop_events
  ADD CONSTRAINT sparkloop_events_unique_per_publication
  UNIQUE (publication_id, event_type, subscriber_email, event_timestamp);

-- The new unique index covers publication_id as leading column,
-- so the single-column type index is redundant for per-publication queries
DROP INDEX IF EXISTS idx_sparkloop_events_type;

-- Add discovery index for sync cron to efficiently find publications with SparkLoop configured
CREATE INDEX IF NOT EXISTS idx_publication_settings_sparkloop_discovery
  ON publication_settings(key, publication_id)
  WHERE value IS NOT NULL AND value <> '';
