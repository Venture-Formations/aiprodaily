-- Check actual column types in the database
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('newsletter_campaigns', 'rss_posts')
  AND column_name IN ('id', 'campaign_id')
ORDER BY table_name, column_name;
