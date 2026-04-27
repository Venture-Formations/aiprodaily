-- Migration: Add last_synced_at to email_metrics
-- Date: 2026-04-27
-- Purpose: Track when metrics were last refreshed from the ESP.
--   `imported_at` defaults on INSERT but is never touched on UPDATE,
--   so it cannot serve as a freshness indicator. `last_synced_at` is
--   set explicitly by every metrics-import write (MailerLite + SendGrid).
--
-- Backfill: existing rows inherit imported_at as a reasonable starting
-- value so the UI doesn't render every historical row as "never synced".

ALTER TABLE email_metrics
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Index supports queries like "find issues with stale metrics".
CREATE INDEX IF NOT EXISTS idx_email_metrics_last_synced
  ON email_metrics(last_synced_at);

-- Backfill historical rows with the original import timestamp.
-- This is approximate but better than NULL for UI display.
UPDATE email_metrics
  SET last_synced_at = imported_at
  WHERE last_synced_at IS NULL
    AND imported_at IS NOT NULL;
