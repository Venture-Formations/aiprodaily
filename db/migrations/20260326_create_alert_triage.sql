-- Alert triage system: AI-powered classification of alerts before Slack delivery
-- Part of the AI-Powered Monitoring & Self-Healing System (Phase 1)

CREATE TABLE IF NOT EXISTS alert_triage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID,
  alert_message TEXT NOT NULL,
  alert_level TEXT NOT NULL,
  notification_type TEXT,
  triage_result TEXT NOT NULL CHECK (triage_result IN ('auto_resolve', 'investigate', 'critical', 'triage_failed')),
  ai_reasoning TEXT,
  recent_context JSONB DEFAULT '[]'::jsonb,
  triage_duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alert_triage_result ON alert_triage_log(triage_result, created_at DESC);
CREATE INDEX idx_alert_triage_created ON alert_triage_log(created_at DESC);

-- Seed triage settings for all active publications (disabled by default — opt-in)
-- NOTE: app_settings requires publication_id (NOT NULL) and value is JSONB
INSERT INTO app_settings (publication_id, key, value, description, updated_at)
SELECT id, 'ai_triage_enabled', '"false"'::jsonb,
  'Enable AI-powered alert triage before sending to Slack. Set to true to activate.',
  NOW()
FROM publications WHERE is_active = true
ON CONFLICT (publication_id, key) DO NOTHING;

-- Seed the triage prompt for all active publications
INSERT INTO app_settings (publication_id, key, value, description, updated_at)
SELECT id, 'ai_triage_alert',
  '{"model":"gpt-4o-mini","messages":[{"role":"system","content":"You are an ops triage agent for a newsletter automation platform. Classify alerts as one of: auto_resolve (transient, self-healing, or already remediated), investigate (needs human attention but not urgent), or critical (immediate action needed). Respond with JSON only: {\"classification\":\"...\",\"reasoning\":\"...\",\"suggested_action\":\"...\"}"},{"role":"user","content":"Alert: {{alert_message}}\nLevel: {{alert_level}}\nType: {{notification_type}}\n\nRecent logs from same source (last 10):\n{{recent_logs}}\n\nClassify this alert."}],"temperature":0.2,"max_tokens":200}'::jsonb,
  'AI prompt for alert triage classification (auto_resolve/investigate/critical)',
  NOW()
FROM publications WHERE is_active = true
ON CONFLICT (publication_id, key) DO NOTHING;
