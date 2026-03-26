-- Composite index for track endpoint lookup by (publication_id, event_type, subscriber_email)
-- Covers the popup_opened lookup in subscriptions_success flow with ORDER BY event_timestamp
CREATE INDEX IF NOT EXISTS idx_sparkloop_events_type_email_ts
  ON sparkloop_events(publication_id, event_type, subscriber_email, event_timestamp DESC);

-- Composite index for referrals date-range + source queries in stats and daterange routes
CREATE INDEX IF NOT EXISTS idx_sl_referrals_pub_source_subscribed
  ON sparkloop_referrals(publication_id, source, subscribed_at DESC);

-- Secondary snapshot index for date-range queries that don't filter by ref_code
CREATE INDEX IF NOT EXISTS idx_sl_snapshots_pub_date
  ON sparkloop_daily_snapshots(publication_id, snapshot_date DESC);
