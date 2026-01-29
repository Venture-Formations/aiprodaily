-- Poll System Enhancement Migration
-- Migration: poll_ip_exclusions_and_issue_uniqueness.sql
-- Date: 2026-01-29
-- Description:
--   1. Change poll_responses uniqueness from (poll_id, email) to (poll_id, email, issue_id)
--      so the same poll in different issues captures separate responses
--   2. Add poll_excluded_ips table for filtering spam/bot IPs from analytics

-- ============================================
-- PART 1: Fix Poll Response Uniqueness
-- ============================================
-- Current: UNIQUE(poll_id, subscriber_email) - one response per email per poll globally
-- New: Separate responses per issue, but still overwrite if same email votes on same issue

-- Step 1: Drop the existing unique constraint
ALTER TABLE poll_responses
DROP CONSTRAINT IF EXISTS poll_responses_poll_id_subscriber_email_key;

-- Step 2: Create partial unique indexes to handle NULL issue_id gracefully
-- PostgreSQL UNIQUE constraints treat NULLs as distinct, so we use partial indexes

-- For responses WITH issue_id: unique per (poll, email, issue)
-- This allows: same email can vote on same poll in different issues
CREATE UNIQUE INDEX IF NOT EXISTS idx_poll_responses_unique_with_issue
ON poll_responses (poll_id, subscriber_email, issue_id)
WHERE issue_id IS NOT NULL;

-- For responses WITHOUT issue_id (legacy): unique per (poll, email)
-- This preserves backward compatibility for any existing responses without issue_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_poll_responses_unique_no_issue
ON poll_responses (poll_id, subscriber_email)
WHERE issue_id IS NULL;

-- ============================================
-- PART 2: IP Exclusion Table
-- ============================================
-- Stores IPs to exclude from poll analytics (votes are still recorded, just filtered)
-- Per-publication for multi-tenant isolation

CREATE TABLE IF NOT EXISTS poll_excluded_ips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  ip_address TEXT NOT NULL,
  reason TEXT,
  added_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- One entry per IP per publication
  UNIQUE(publication_id, ip_address)
);

-- Index for efficient lookups during analytics
CREATE INDEX IF NOT EXISTS idx_poll_excluded_ips_publication
ON poll_excluded_ips(publication_id);

-- Compound index for fast IP existence checks
CREATE INDEX IF NOT EXISTS idx_poll_excluded_ips_lookup
ON poll_excluded_ips(publication_id, ip_address);

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE poll_excluded_ips IS 'IP addresses to exclude from poll analytics (votes still recorded but filtered from stats)';
COMMENT ON COLUMN poll_excluded_ips.ip_address IS 'IPv4 or IPv6 address to exclude';
COMMENT ON COLUMN poll_excluded_ips.reason IS 'Why this IP was excluded (e.g., internal testing, spam clicker, bot)';
COMMENT ON COLUMN poll_excluded_ips.added_by IS 'Email of user who added the exclusion';
COMMENT ON COLUMN poll_excluded_ips.publication_id IS 'Multi-tenant isolation - each publication manages its own exclusion list';

-- Update comment on the old constraint location
COMMENT ON INDEX idx_poll_responses_unique_with_issue IS 'Ensures one vote per subscriber per poll per issue (when issue_id is not null)';
COMMENT ON INDEX idx_poll_responses_unique_no_issue IS 'Ensures one vote per subscriber per poll globally for legacy responses without issue_id';
