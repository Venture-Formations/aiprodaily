-- Migration: Add global pinning to ai_applications
-- Allows pinning specific apps to fixed positions across all issues

-- Add pinned_position column
ALTER TABLE ai_applications
ADD COLUMN IF NOT EXISTS pinned_position INTEGER DEFAULT NULL;

-- Create index for efficient pinned app queries
CREATE INDEX IF NOT EXISTS idx_ai_applications_pinned_position
  ON ai_applications(publication_id, pinned_position)
  WHERE pinned_position IS NOT NULL;

-- Add constraint for valid position values (1-20)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_applications_pinned_position_check'
  ) THEN
    ALTER TABLE ai_applications
    ADD CONSTRAINT ai_applications_pinned_position_check
    CHECK (pinned_position IS NULL OR (pinned_position >= 1 AND pinned_position <= 20));
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN ai_applications.pinned_position IS '1-based position for globally pinned apps. NULL = not pinned. When set, app always appears in this position until unpinned.';
