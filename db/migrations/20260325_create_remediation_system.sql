-- Remediation system: tracks automated recovery actions for self-healing monitoring
-- Part of the AI-Powered Monitoring & Self-Healing System (Phase 0)

-- remediation_log: records every auto-remediation attempt and its outcome
CREATE TABLE IF NOT EXISTS remediation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  issue_id TEXT,
  playbook_name TEXT NOT NULL,
  trigger_condition TEXT NOT NULL,
  action_taken TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('success', 'failed', 'skipped')),
  context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_remediation_log_pub ON remediation_log(publication_id);
CREATE INDEX idx_remediation_log_created ON remediation_log(created_at DESC);
CREATE INDEX idx_remediation_log_playbook ON remediation_log(playbook_name, created_at DESC);

-- Track auto-retry attempts per issue to cap at 1
ALTER TABLE publication_issues ADD COLUMN IF NOT EXISTS auto_retry_count INTEGER DEFAULT 0;
