-- Check the actual column types in your database
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('rss_posts', 'newsletter_campaigns', 'articles')
AND column_name IN ('id', 'post_id', 'campaign_id')
ORDER BY table_name, column_name;
