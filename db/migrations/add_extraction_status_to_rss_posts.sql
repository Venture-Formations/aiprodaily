-- Add extraction status tracking to rss_posts
-- This allows explicit detection of paywalls, login requirements, and other access restrictions

ALTER TABLE rss_posts 
ADD COLUMN IF NOT EXISTS extraction_status TEXT DEFAULT 'pending'
  CHECK (extraction_status IN ('pending', 'success', 'paywall', 'login_required', 'blocked', 'timeout', 'failed'));

ALTER TABLE rss_posts 
ADD COLUMN IF NOT EXISTS extraction_error TEXT;

-- Add index for filtering by status
CREATE INDEX IF NOT EXISTS idx_rss_posts_extraction_status ON rss_posts(extraction_status);

-- Add comments for documentation
COMMENT ON COLUMN rss_posts.extraction_status IS 'Status of full article extraction: pending, success, paywall, login_required, blocked, timeout, failed';
COMMENT ON COLUMN rss_posts.extraction_error IS 'Error message or reason for extraction failure';











