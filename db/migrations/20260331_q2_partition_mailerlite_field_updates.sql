-- Phase 3, Q2: Partition mailerlite_field_updates by month
-- 302MB / 1.45M rows, growing ~800K/month. 90-day retention.
--
-- Strategy:
--   1. Create partitioned table with same schema
--   2. Create monthly partitions (Dec 2025 through Jun 2026 + default)
--   3. Copy all data from original table
--   4. Rename old indexes, swap table names, recreate indexes
--   5. Set autovacuum on LEAF partitions (not parent — PG doesn't allow it)
--   6. Drop partitions older than 90 days
--   7. Create maintenance function for future partition lifecycle
--
-- GOTCHAS DISCOVERED DURING DEPLOYMENT:
--   - Index names are global: must rename old indexes BEFORE swapping tables
--   - Cannot set storage params (autovacuum) on partitioned parent table
--     — must set on each leaf partition individually
--   - PK must include partition key: (id, created_at) not just (id)
--
-- NOTE: The swap briefly locks the table. Data copy for 1.45M rows
-- takes ~5-10 seconds. Schedule during low traffic window.

-- ============================================================
-- Step 1: Create partitioned table
-- ============================================================

CREATE TABLE mailerlite_field_updates_new (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  subscriber_email TEXT NOT NULL,
  field_name TEXT NOT NULL,
  field_value BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  publication_id UUID NOT NULL,
  issue_id UUID,
  link_click_id UUID,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- ============================================================
-- Step 2: Create monthly partitions
-- ============================================================

CREATE TABLE mfu_y2025m12 PARTITION OF mailerlite_field_updates_new
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
CREATE TABLE mfu_y2026m01 PARTITION OF mailerlite_field_updates_new
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE mfu_y2026m02 PARTITION OF mailerlite_field_updates_new
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE mfu_y2026m03 PARTITION OF mailerlite_field_updates_new
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE mfu_y2026m04 PARTITION OF mailerlite_field_updates_new
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE mfu_y2026m05 PARTITION OF mailerlite_field_updates_new
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE mfu_y2026m06 PARTITION OF mailerlite_field_updates_new
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE mfu_default PARTITION OF mailerlite_field_updates_new DEFAULT;

-- ============================================================
-- Step 3: Copy data
-- ============================================================

INSERT INTO mailerlite_field_updates_new
  (id, subscriber_email, field_name, field_value, status, error_message,
   retry_count, created_at, processed_at, publication_id, issue_id, link_click_id)
SELECT id, subscriber_email, field_name, field_value, status, error_message,
   retry_count, created_at, processed_at, publication_id, issue_id, link_click_id
FROM mailerlite_field_updates;

-- ============================================================
-- Step 4: Rename old indexes, swap tables, recreate indexes
-- ============================================================
-- IMPORTANT: Index names are global. Must rename old indexes first
-- to avoid name collision when creating new ones.

ALTER INDEX idx_mailerlite_updates_pending RENAME TO idx_mailerlite_updates_pending_old;
ALTER INDEX idx_mailerlite_updates_publication RENAME TO idx_mailerlite_updates_publication_old;
ALTER INDEX idx_mailerlite_updates_subscriber_field RENAME TO idx_mailerlite_updates_subscriber_field_old;
ALTER INDEX mailerlite_field_updates_pkey RENAME TO mailerlite_field_updates_old_pkey;

ALTER TABLE mailerlite_field_updates RENAME TO mailerlite_field_updates_old;
ALTER TABLE mailerlite_field_updates_new RENAME TO mailerlite_field_updates;

CREATE INDEX idx_mailerlite_updates_pending
  ON mailerlite_field_updates (status, created_at)
  WHERE (status = 'pending');

CREATE INDEX idx_mailerlite_updates_publication
  ON mailerlite_field_updates (publication_id);

CREATE INDEX idx_mailerlite_updates_subscriber_field
  ON mailerlite_field_updates (subscriber_email, field_name);

-- ============================================================
-- Step 5: Enable RLS
-- ============================================================

ALTER TABLE mailerlite_field_updates ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Step 6: Set autovacuum on LEAF partitions (cannot set on parent)
-- ============================================================

ALTER TABLE mfu_y2025m12 SET (autovacuum_vacuum_scale_factor = 0.01, autovacuum_analyze_scale_factor = 0.01, autovacuum_vacuum_cost_delay = 2);
ALTER TABLE mfu_y2026m01 SET (autovacuum_vacuum_scale_factor = 0.01, autovacuum_analyze_scale_factor = 0.01, autovacuum_vacuum_cost_delay = 2);
ALTER TABLE mfu_y2026m02 SET (autovacuum_vacuum_scale_factor = 0.01, autovacuum_analyze_scale_factor = 0.01, autovacuum_vacuum_cost_delay = 2);
ALTER TABLE mfu_y2026m03 SET (autovacuum_vacuum_scale_factor = 0.01, autovacuum_analyze_scale_factor = 0.01, autovacuum_vacuum_cost_delay = 2);
ALTER TABLE mfu_y2026m04 SET (autovacuum_vacuum_scale_factor = 0.01, autovacuum_analyze_scale_factor = 0.01, autovacuum_vacuum_cost_delay = 2);
ALTER TABLE mfu_y2026m05 SET (autovacuum_vacuum_scale_factor = 0.01, autovacuum_analyze_scale_factor = 0.01, autovacuum_vacuum_cost_delay = 2);
ALTER TABLE mfu_y2026m06 SET (autovacuum_vacuum_scale_factor = 0.01, autovacuum_analyze_scale_factor = 0.01, autovacuum_vacuum_cost_delay = 2);
ALTER TABLE mfu_default SET (autovacuum_vacuum_scale_factor = 0.01, autovacuum_analyze_scale_factor = 0.01, autovacuum_vacuum_cost_delay = 2);

-- ============================================================
-- Step 7: Drop December 2025 partition (outside 90-day window)
-- ============================================================

DROP TABLE IF EXISTS mfu_y2025m12;

-- ============================================================
-- Cleanup: Drop old table after verification
-- ============================================================

DROP TABLE IF EXISTS mailerlite_field_updates_old;

-- ============================================================
-- Partition maintenance function
-- ============================================================
-- Call monthly (via pg_cron or app cron) to create future partitions
-- and drop expired ones. Creates 2 months ahead, drops > 90 days old.

CREATE OR REPLACE FUNCTION maintain_mfu_partitions()
RETURNS void AS $$
DECLARE
  next_month_start DATE;
  next_month_end DATE;
  partition_name TEXT;
  drop_partition TEXT;
  drop_date DATE;
BEGIN
  -- Create partition for 2 months ahead (safety buffer)
  next_month_start := date_trunc('month', now() + interval '2 months')::date;
  next_month_end := (next_month_start + interval '1 month')::date;
  partition_name := 'mfu_y' || to_char(next_month_start, 'YYYY') || 'm' || to_char(next_month_start, 'MM');

  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = partition_name) THEN
    EXECUTE format(
      'CREATE TABLE %I PARTITION OF mailerlite_field_updates FOR VALUES FROM (%L) TO (%L)',
      partition_name, next_month_start, next_month_end
    );
    EXECUTE format(
      'ALTER TABLE %I SET (autovacuum_vacuum_scale_factor = 0.01, autovacuum_analyze_scale_factor = 0.01, autovacuum_vacuum_cost_delay = 2)',
      partition_name
    );
    RAISE NOTICE 'Created partition: %', partition_name;
  END IF;

  -- Drop partitions older than 90 days
  -- Partition name format: mfu_yYYYYmMM (year at pos 6-9, month at pos 11-12)
  drop_date := date_trunc('month', now() - interval '90 days')::date;
  FOR drop_partition IN
    SELECT tablename FROM pg_tables
    WHERE tablename LIKE 'mfu_y____m__'
    AND to_date(
      substring(tablename from 6 for 4) || substring(tablename from 11 for 2),
      'YYYYMM'
    ) < drop_date
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS %I', drop_partition);
    RAISE NOTICE 'Dropped expired partition: %', drop_partition;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- To set up pg_cron (run once manually):
-- ============================================================
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('maintain-mfu-partitions', '0 0 1 * *', 'SELECT maintain_mfu_partitions()');
