-- Phase 3, Q9: BRIN indexes for time-series tables
-- BRIN indexes are 100-1000x smaller than B-tree for append-only time-series data.
-- Created on partitioned parent — PG propagates to leaf partitions.

CREATE INDEX IF NOT EXISTS idx_lc_brin_created ON link_clicks USING brin (created_at);
CREATE INDEX IF NOT EXISTS idx_mfu_brin_created ON mailerlite_field_updates USING brin (created_at);
