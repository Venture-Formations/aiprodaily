-- Migration: Add per-issue pinning overrides to issue_ai_app_modules
-- Allows overriding global pins or adding per-issue pins

-- Add pinned_overrides JSONB column
ALTER TABLE issue_ai_app_modules
ADD COLUMN IF NOT EXISTS pinned_overrides JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN issue_ai_app_modules.pinned_overrides IS 'Per-issue position overrides. Format: {"app_id": position|null}. Number = override position, null = explicit unpin for this issue only.';
