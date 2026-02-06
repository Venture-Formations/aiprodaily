-- Bot Detection Support Migration
-- Adds columns and indexes for detecting bot clicks in newsletter analytics

-- Add exclusion_source column to excluded_ips table
-- Tracks how the IP was added: manual, velocity detection, or honeypot
ALTER TABLE excluded_ips
ADD COLUMN IF NOT EXISTS exclusion_source TEXT DEFAULT 'manual'
  CHECK (exclusion_source IN ('manual', 'velocity', 'honeypot'));

-- Add bot UA detection columns to link_clicks table
-- is_bot_ua: flags clicks from suspicious user agents
-- bot_ua_reason: stores the pattern that matched (for review)
ALTER TABLE link_clicks
ADD COLUMN IF NOT EXISTS is_bot_ua BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS bot_ua_reason TEXT;

-- Index for velocity detection queries
-- Enables fast lookups of recent clicks from same IP for same issue
CREATE INDEX IF NOT EXISTS idx_link_clicks_velocity
ON link_clicks(ip_address, issue_id, clicked_at DESC)
WHERE ip_address IS NOT NULL;

-- Index for honeypot click detection
-- Enables fast lookups of honeypot clicks by IP
CREATE INDEX IF NOT EXISTS idx_link_clicks_honeypot
ON link_clicks(link_section, ip_address)
WHERE link_section = 'Honeypot';

-- Index for filtering bot UA clicks in analytics
CREATE INDEX IF NOT EXISTS idx_link_clicks_bot_ua
ON link_clicks(is_bot_ua)
WHERE is_bot_ua = TRUE;
