-- Add separate URL templates for Sale and Purchase transactions
-- Falls back to existing url_template if these are NULL/empty

ALTER TABLE combined_feed_settings
  ADD COLUMN IF NOT EXISTS sale_url_template TEXT,
  ADD COLUMN IF NOT EXISTS purchase_url_template TEXT;
