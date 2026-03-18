-- Add separate URL templates for Sale and Purchase transactions
-- and per-trade article limit

ALTER TABLE combined_feed_settings
  ADD COLUMN IF NOT EXISTS sale_url_template TEXT,
  ADD COLUMN IF NOT EXISTS purchase_url_template TEXT,
  ADD COLUMN IF NOT EXISTS max_articles_per_trade INTEGER DEFAULT 5;
