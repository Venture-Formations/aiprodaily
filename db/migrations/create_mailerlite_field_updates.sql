-- ============================================
-- MAILERLITE FIELD UPDATES QUEUE
-- ============================================
-- Queue table for async updates to MailerLite subscriber custom fields
-- when subscribers click on ads or AI apps in newsletters
-- ============================================

-- Create the queue table
CREATE TABLE IF NOT EXISTS mailerlite_field_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_email TEXT NOT NULL,
  field_name TEXT NOT NULL,              -- 'clicked_ad' or 'clicked_ai_app'
  field_value BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'pending',         -- pending, processing, completed, failed
  error_message TEXT,                    -- store failure reason if any
  retry_count INTEGER DEFAULT 0,         -- track retries
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  publication_id UUID NOT NULL,          -- multi-tenant isolation
  issue_id UUID,                         -- optional: link to issue for debugging
  link_click_id UUID                     -- optional: reference to original click
);

-- Index for efficient queue processing (fetch pending items)
CREATE INDEX IF NOT EXISTS idx_mailerlite_updates_pending
  ON mailerlite_field_updates(status, created_at)
  WHERE status = 'pending';

-- Index for publication filtering (multi-tenant)
CREATE INDEX IF NOT EXISTS idx_mailerlite_updates_publication
  ON mailerlite_field_updates(publication_id);

-- Index for subscriber lookup (deduplication)
CREATE INDEX IF NOT EXISTS idx_mailerlite_updates_subscriber_field
  ON mailerlite_field_updates(subscriber_email, field_name);

-- Add comment for documentation
COMMENT ON TABLE mailerlite_field_updates IS 'Queue for async MailerLite subscriber field updates when clicking ads/AI apps';
COMMENT ON COLUMN mailerlite_field_updates.field_name IS 'MailerLite custom field: clicked_ad or clicked_ai_app';
COMMENT ON COLUMN mailerlite_field_updates.status IS 'Queue status: pending, processing, completed, failed';
