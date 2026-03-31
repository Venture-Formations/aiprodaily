-- Phase 3, Q4: Materialized view for click analytics
-- Pre-computes per-issue click metrics that the analytics API currently
-- aggregates in JavaScript by fetching all rows in batches of 1000.
--
-- Columns: issue_id, issue_date, publication_id, total_clicks, unique_clickers,
--   bot_clicks, human_clicks, unique_human_clickers, distinct_links, clicks_by_section (JSONB)
--
-- Refreshed hourly via pg_cron (CONCURRENTLY, no lock).
-- Unique index on issue_id required for CONCURRENTLY refresh.

CREATE MATERIALIZED VIEW issue_click_stats AS
SELECT
  issue_id,
  issue_date,
  publication_id,
  count(*) AS total_clicks,
  count(DISTINCT subscriber_email) AS unique_clickers,
  count(*) FILTER (WHERE is_bot_ua = true) AS bot_clicks,
  count(*) FILTER (WHERE is_bot_ua IS NOT true) AS human_clicks,
  count(DISTINCT CASE WHEN is_bot_ua IS NOT true THEN subscriber_email END) AS unique_human_clickers,
  count(DISTINCT link_url) AS distinct_links,
  -- Per-section click breakdown (human only) as JSONB
  (SELECT jsonb_object_agg(sub.link_section, sub.cnt ORDER BY sub.cnt DESC)
   FROM (
     SELECT link_section, count(*) AS cnt
     FROM link_clicks lc2
     WHERE lc2.issue_id = link_clicks.issue_id
       AND lc2.is_bot_ua IS NOT true
     GROUP BY link_section
   ) sub
  ) AS clicks_by_section
FROM link_clicks
WHERE issue_id IS NOT NULL
  AND publication_id IS NOT NULL
GROUP BY issue_id, issue_date, publication_id;

-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX idx_issue_click_stats_issue ON issue_click_stats (issue_id);

-- Query index for dashboard (filter by publication, order by date)
CREATE INDEX idx_issue_click_stats_pub_date ON issue_click_stats (publication_id, issue_date DESC);

-- Schedule hourly refresh via pg_cron:
-- SELECT cron.schedule('refresh-issue-click-stats', '0 * * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY issue_click_stats');
