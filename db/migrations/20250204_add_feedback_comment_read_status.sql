-- Migration: Add feedback comment read status tracking
-- Tracks which comments have been read by which user

CREATE TABLE IF NOT EXISTS feedback_comment_read_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES feedback_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- Index for efficient lookups
CREATE INDEX idx_feedback_comment_read_status_user ON feedback_comment_read_status(user_id);
CREATE INDEX idx_feedback_comment_read_status_comment ON feedback_comment_read_status(comment_id);

-- RLS policies
ALTER TABLE feedback_comment_read_status ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role can manage feedback comment read status"
  ON feedback_comment_read_status
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can read/write their own read status
CREATE POLICY "Users can manage their own read status"
  ON feedback_comment_read_status
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
