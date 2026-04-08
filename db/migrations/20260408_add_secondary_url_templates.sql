-- Add secondary URL templates and min posts threshold for RSS combiner
-- When primary template returns < min_posts_per_trade articles for a trade,
-- the system re-fetches using the broader secondary template.

ALTER TABLE combined_feed_settings
  ADD COLUMN IF NOT EXISTS secondary_sale_url_template TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS secondary_purchase_url_template TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS min_posts_per_trade INTEGER DEFAULT 20;

COMMENT ON COLUMN combined_feed_settings.secondary_sale_url_template
  IS 'Broader fallback URL template for sale transactions when primary returns too few articles. Supports {company_name} and {ticker} placeholders.';

COMMENT ON COLUMN combined_feed_settings.secondary_purchase_url_template
  IS 'Broader fallback URL template for purchase transactions when primary returns too few articles. Supports {company_name} and {ticker} placeholders.';

COMMENT ON COLUMN combined_feed_settings.min_posts_per_trade
  IS 'Minimum approved articles per trade before secondary template is triggered.';
