-- 20260430_make_webhook_first_open_gate.sql
-- Adds lifecycle columns to make_webhook_fires so Beehiiv-gated subscribers
-- can be claimed as 'pending' at signup time and transitioned to 'fired' (or
-- 'expired') by the check-pending-webhooks cron once a first open is observed.
-- Existing rows default to 'fired' so the old immediate-fire flow is unchanged.

ALTER TABLE make_webhook_fires
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'fired'
    CHECK (status IN ('pending', 'fired', 'expired')),
  ADD COLUMN IF NOT EXISTS fired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_polled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS poll_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expired_reason TEXT;

UPDATE make_webhook_fires
   SET fired_at = created_at
 WHERE fired_at IS NULL AND status = 'fired';

CREATE INDEX IF NOT EXISTS idx_make_webhook_fires_pending
  ON make_webhook_fires(publication_id, last_polled_at NULLS FIRST)
  WHERE status = 'pending';
