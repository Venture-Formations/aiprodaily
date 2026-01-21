-- Add IP address tracking to poll responses
-- This allows tracking the IP address of poll voters for analytics and fraud prevention

ALTER TABLE poll_responses
ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- Add index for IP-based queries (e.g., finding multiple votes from same IP)
CREATE INDEX IF NOT EXISTS idx_poll_responses_ip_address ON poll_responses(ip_address);

COMMENT ON COLUMN poll_responses.ip_address IS 'IP address of the voter, captured from request headers';
