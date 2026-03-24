-- System metrics: lightweight internal APM for operational visibility
-- Part of the AI-Powered Monitoring & Self-Healing System (Phase 3)

CREATE TABLE IF NOT EXISTS system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  tags JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Primary query pattern: time-range queries per publication and metric
CREATE INDEX idx_metrics_pub_name_time ON system_metrics(publication_id, metric_name, recorded_at DESC);
-- Cleanup query: delete old rows by recorded_at
CREATE INDEX idx_metrics_recorded ON system_metrics(recorded_at);
