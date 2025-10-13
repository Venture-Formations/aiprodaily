-- Pending Event Submissions Table
-- Stores event data temporarily while waiting for Stripe payment confirmation
-- Records are deleted after successful payment or after expiration

CREATE TABLE IF NOT EXISTS pending_event_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id TEXT UNIQUE NOT NULL,
  events_data JSONB NOT NULL,
  submitter_email TEXT NOT NULL,
  submitter_name TEXT NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ
);

-- Index for faster lookups by session ID
CREATE INDEX IF NOT EXISTS idx_pending_submissions_session_id
  ON pending_event_submissions(stripe_session_id);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_pending_submissions_expires_at
  ON pending_event_submissions(expires_at)
  WHERE NOT processed;

-- Add comment for documentation
COMMENT ON TABLE pending_event_submissions IS
  'Temporary storage for event submissions awaiting Stripe payment confirmation. Records expire after 24 hours.';

-- Cleanup function for expired pending submissions
CREATE OR REPLACE FUNCTION cleanup_expired_pending_submissions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM pending_event_submissions
  WHERE expires_at < NOW() AND NOT processed;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- You can schedule this cleanup function to run periodically via a cron job
-- Example cron endpoint: /api/cron/cleanup-pending-submissions
