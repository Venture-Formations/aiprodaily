-- Feed health rules: AI-generated and manual monitoring rules for RSS feeds
-- Part of the AI-Powered Monitoring & Self-Healing System (Phase 2b)

CREATE TABLE IF NOT EXISTS feed_health_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  feed_id UUID NOT NULL REFERENCES rss_feeds(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('freshness', 'quality', 'extraction', 'volume')),
  description TEXT NOT NULL,
  threshold_value NUMERIC NOT NULL,
  threshold_unit TEXT NOT NULL,
  baseline_value NUMERIC,
  is_active BOOLEAN DEFAULT true,
  created_by TEXT NOT NULL CHECK (created_by IN ('ai', 'manual')),
  last_triggered TIMESTAMPTZ,
  last_evaluated TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feed_rules_pub ON feed_health_rules(publication_id);
CREATE INDEX idx_feed_rules_feed ON feed_health_rules(feed_id);
CREATE INDEX idx_feed_rules_active ON feed_health_rules(publication_id, is_active) WHERE is_active = true;

-- Seed the feed health analysis prompt
INSERT INTO app_settings (publication_id, key, value, description, updated_at)
VALUES (
  'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf',
  'ai_feed_health_analysis',
  '{"model":"gpt-4o-mini","messages":[{"role":"system","content":"You analyze RSS feed health data and generate monitoring rules. For each feed with concerning patterns, generate rules. Return JSON array: [{\"feed_id\":\"...\",\"rule_type\":\"freshness|quality|extraction|volume\",\"description\":\"...\",\"threshold_value\":0,\"threshold_unit\":\"hours|percent|score|count\",\"baseline_value\":0}]. Only generate rules for feeds with clear anomalies or concerning trends. Do not generate rules for healthy feeds."},{"role":"user","content":"Feed health data for last 7 days:\n{{feed_stats}}\n\nGenerate monitoring rules for feeds with concerning patterns."}],"temperature":0.3,"max_tokens":2000}'::jsonb,
  'AI prompt for generating RSS feed health monitoring rules',
  NOW()
)
ON CONFLICT (publication_id, key) DO NOTHING;
