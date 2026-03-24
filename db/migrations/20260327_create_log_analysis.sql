-- Log analysis reports: stores daily AI-generated analysis of system_logs
-- Part of the AI-Powered Monitoring & Self-Healing System (Phase 2a)

CREATE TABLE IF NOT EXISTS log_analysis_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  anomalies JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  summary TEXT,
  error_counts JSONB DEFAULT '{}'::jsonb,
  new_error_types JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(publication_id, report_date)
);

CREATE INDEX idx_log_reports_pub ON log_analysis_reports(publication_id);
CREATE INDEX idx_log_reports_date ON log_analysis_reports(report_date DESC);

-- Seed the log analysis prompt
INSERT INTO app_settings (key, value, description, updated_at)
VALUES (
  'ai_log_analysis',
  '{"model":"gpt-4o-mini","messages":[{"role":"system","content":"You are a systems reliability engineer analyzing 24h of newsletter platform logs. Identify anomalies, new error types, increasing error rates, and potential issues. Return JSON: {\"anomalies\":[{\"description\":\"...\",\"severity\":\"low|medium|high\",\"source\":\"...\",\"count\":0}],\"recommendations\":[{\"action\":\"...\",\"priority\":\"low|medium|high\",\"reasoning\":\"...\"}],\"summary\":\"...\"}"},{"role":"user","content":"Log summary for {{report_date}}:\n\nError counts by source:\n{{error_counts}}\n\nNew error types (not seen in prior 7 days):\n{{new_errors}}\n\nTop 20 error messages:\n{{top_errors}}\n\nRecent remediation actions:\n{{remediation_summary}}\n\nAnalyze and recommend."}],"temperature":0.3,"max_tokens":1000}',
  'AI prompt for daily log analysis and anomaly detection',
  NOW()
)
ON CONFLICT (key) DO NOTHING;
