-- Tracks which subscribers have already triggered the Make.com subscribe webhook
-- per publication. Used as an at-most-once dedup gate so a subscriber who signs
-- up via SparkLoop and later converts via AfterOffers (or vice-versa) only fires
-- the webhook once. Cross-source, per-publication.

CREATE TABLE IF NOT EXISTS make_webhook_fires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  subscriber_email TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('sparkloop', 'afteroffers')),
  subscriber_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT make_webhook_fires_pub_email_unique UNIQUE (publication_id, subscriber_email)
);

CREATE INDEX IF NOT EXISTS idx_make_webhook_fires_pub
  ON make_webhook_fires(publication_id);

ALTER TABLE make_webhook_fires ENABLE ROW LEVEL SECURITY;
