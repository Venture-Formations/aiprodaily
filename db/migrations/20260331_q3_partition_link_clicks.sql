-- Phase 3, Q3: Partition link_clicks by month (issue_date)
-- 77MB / 168K rows, growing ~58K/month. 12-month retention.
--
-- Same approach as Q2 (mailerlite_field_updates), applying all lessons:
--   - Rename old indexes BEFORE swapping tables (global names)
--   - Drop FK constraint (link_clicks_publication_id_fkey → publications)
--   - PK changes from (id) to (id, issue_date)
--   - No autovacuum customization needed (not high-churn like mfu)

-- ============================================================
-- Step 1: Create partitioned table
-- ============================================================

CREATE TABLE link_clicks_new (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  issue_date DATE NOT NULL,
  issue_id UUID,
  subscriber_email TEXT NOT NULL,
  subscriber_id TEXT,
  link_url TEXT NOT NULL,
  link_section TEXT NOT NULL,
  clicked_at TIMESTAMPTZ DEFAULT now(),
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  publication_id UUID,
  is_bot_ua BOOLEAN DEFAULT false,
  bot_ua_reason TEXT,
  PRIMARY KEY (id, issue_date)
) PARTITION BY RANGE (issue_date);

-- ============================================================
-- Step 2: Create monthly partitions (Oct 2025 through Sep 2026)
-- ============================================================

CREATE TABLE lc_y2025m10 PARTITION OF link_clicks_new FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE lc_y2025m11 PARTITION OF link_clicks_new FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE lc_y2025m12 PARTITION OF link_clicks_new FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
CREATE TABLE lc_y2026m01 PARTITION OF link_clicks_new FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE lc_y2026m02 PARTITION OF link_clicks_new FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE lc_y2026m03 PARTITION OF link_clicks_new FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE lc_y2026m04 PARTITION OF link_clicks_new FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE lc_y2026m05 PARTITION OF link_clicks_new FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE lc_y2026m06 PARTITION OF link_clicks_new FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE lc_y2026m07 PARTITION OF link_clicks_new FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE lc_y2026m08 PARTITION OF link_clicks_new FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE lc_y2026m09 PARTITION OF link_clicks_new FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE lc_default PARTITION OF link_clicks_new DEFAULT;

-- ============================================================
-- Step 3: Copy data
-- ============================================================

INSERT INTO link_clicks_new
  (id, issue_date, issue_id, subscriber_email, subscriber_id, link_url,
   link_section, clicked_at, user_agent, ip_address, created_at,
   publication_id, is_bot_ua, bot_ua_reason)
SELECT id, issue_date, issue_id, subscriber_email, subscriber_id, link_url,
   link_section, clicked_at, user_agent, ip_address, created_at,
   publication_id, is_bot_ua, bot_ua_reason
FROM link_clicks;

-- ============================================================
-- Step 4: Rename old indexes, drop FK, swap tables
-- ============================================================

ALTER INDEX idx_link_clicks_bot_ua RENAME TO idx_link_clicks_bot_ua_old;
ALTER INDEX idx_link_clicks_honeypot RENAME TO idx_link_clicks_honeypot_old;
ALTER INDEX idx_link_clicks_issue RENAME TO idx_link_clicks_issue_old;
ALTER INDEX idx_link_clicks_issue_date RENAME TO idx_link_clicks_issue_date_old;
ALTER INDEX idx_link_clicks_publication RENAME TO idx_link_clicks_publication_old;
ALTER INDEX idx_link_clicks_publication_ip RENAME TO idx_link_clicks_publication_ip_old;
ALTER INDEX idx_link_clicks_velocity RENAME TO idx_link_clicks_velocity_old;
ALTER INDEX link_clicks_pkey RENAME TO link_clicks_old_pkey;

ALTER TABLE link_clicks DROP CONSTRAINT IF EXISTS link_clicks_publication_id_fkey;

ALTER TABLE link_clicks RENAME TO link_clicks_old;
ALTER TABLE link_clicks_new RENAME TO link_clicks;

-- ============================================================
-- Step 5: Recreate all indexes
-- ============================================================

CREATE INDEX idx_link_clicks_bot_ua ON link_clicks (is_bot_ua) WHERE (is_bot_ua = true);
CREATE INDEX idx_link_clicks_honeypot ON link_clicks (link_section, ip_address) WHERE (link_section = 'Honeypot');
CREATE INDEX idx_link_clicks_issue ON link_clicks (issue_id);
CREATE INDEX idx_link_clicks_issue_date ON link_clicks (issue_date);
CREATE INDEX idx_link_clicks_publication ON link_clicks (publication_id);
CREATE INDEX idx_link_clicks_publication_ip ON link_clicks (publication_id, ip_address) WHERE (ip_address IS NOT NULL);
CREATE INDEX idx_link_clicks_velocity ON link_clicks (ip_address, issue_id, clicked_at DESC) WHERE (ip_address IS NOT NULL);

-- ============================================================
-- Step 6: Enable RLS
-- ============================================================

ALTER TABLE link_clicks ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Cleanup
-- ============================================================

DROP TABLE IF EXISTS link_clicks_old;

-- ============================================================
-- Partition maintenance function (12-month retention)
-- ============================================================

CREATE OR REPLACE FUNCTION maintain_lc_partitions()
RETURNS void AS $$
DECLARE
  next_month_start DATE;
  next_month_end DATE;
  partition_name TEXT;
  drop_partition TEXT;
  drop_date DATE;
BEGIN
  next_month_start := date_trunc('month', now() + interval '2 months')::date;
  next_month_end := (next_month_start + interval '1 month')::date;
  partition_name := 'lc_y' || to_char(next_month_start, 'YYYY') || 'm' || to_char(next_month_start, 'MM');

  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = partition_name) THEN
    EXECUTE format(
      'CREATE TABLE %I PARTITION OF link_clicks FOR VALUES FROM (%L) TO (%L)',
      partition_name, next_month_start, next_month_end
    );
    RAISE NOTICE 'Created partition: %', partition_name;
  END IF;

  drop_date := date_trunc('month', now() - interval '12 months')::date;
  FOR drop_partition IN
    SELECT tablename FROM pg_tables
    WHERE tablename LIKE 'lc_y____m__'
    AND to_date(
      substring(tablename from 5 for 4) || substring(tablename from 10 for 2),
      'YYYYMM'
    ) < drop_date
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS %I', drop_partition);
    RAISE NOTICE 'Dropped expired partition: %', drop_partition;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule via pg_cron (monthly on 1st at midnight UTC)
-- SELECT cron.schedule('maintain-lc-partitions', '0 0 1 * *', 'SELECT maintain_lc_partitions()');
