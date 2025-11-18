-- Check the two issues
SELECT
  id,
  date,
  status,
  created_at,
  publication_id
FROM publication_issues
WHERE id IN ('d8679cfd-c2a2-42c0-aa1a-ca6a612ba0af', 'f546382b-54e6-4d3f-8edf-79bc20541b85')
ORDER BY date;

-- Check articles in each issue
SELECT
  i.id as issue_id,
  i.date as issue_date,
  i.status,
  a.id as article_id,
  a.post_id,
  a.headline,
  a.is_active,
  a.skipped
FROM publication_issues i
LEFT JOIN articles a ON a.issue_id = i.id
WHERE i.id IN ('d8679cfd-c2a2-42c0-aa1a-ca6a612ba0af', 'f546382b-54e6-4d3f-8edf-79bc20541b85')
ORDER BY i.date, a.id;

-- Check RSS posts used
SELECT
  i.id as issue_id,
  i.date,
  r.id as post_id,
  r.title,
  r.feed_id,
  LEFT(r.content, 100) as content_preview,
  LEFT(r.full_article_text, 100) as full_text_preview
FROM publication_issues i
JOIN articles a ON a.issue_id = i.id
JOIN rss_posts r ON r.id = a.post_id
WHERE i.id IN ('d8679cfd-c2a2-42c0-aa1a-ca6a612ba0af', 'f546382b-54e6-4d3f-8edf-79bc20541b85')
ORDER BY i.date;

-- Check if deduplication ran for these issues
SELECT
  i.id as issue_id,
  i.date,
  COUNT(dg.id) as duplicate_groups_count
FROM publication_issues i
LEFT JOIN duplicate_groups dg ON dg.issue_id = i.id
WHERE i.id IN ('d8679cfd-c2a2-42c0-aa1a-ca6a612ba0af', 'f546382b-54e6-4d3f-8edf-79bc20541b85')
GROUP BY i.id, i.date
ORDER BY i.date;

-- Get publication settings for dedup config
SELECT
  ps.publication_id,
  ps.key,
  ps.value
FROM publication_issues i
JOIN publication_settings ps ON ps.publication_id = i.publication_id
WHERE i.id = 'f546382b-54e6-4d3f-8edf-79bc20541b85'
  AND ps.key IN ('dedup_historical_lookback_days', 'dedup_strictness_threshold');
