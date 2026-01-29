-- Unified IP Exclusions Migration
-- Migration: unified_ip_exclusions.sql
-- Date: 2026-01-29
-- Description:
--   1. Rename poll_excluded_ips to excluded_ips for unified exclusion
--   2. Add CIDR range support (is_range, cidr_prefix columns)
--   3. Add publication_id to link_clicks for multi-tenant filtering
--   4. Backfill link_clicks.publication_id from issue_id

-- ============================================
-- PART 1: Rename Table and Add CIDR Support
-- ============================================

-- Rename table from poll-specific to unified
ALTER TABLE poll_excluded_ips RENAME TO excluded_ips;

-- Rename indexes to match new table name
ALTER INDEX IF EXISTS idx_poll_excluded_ips_publication RENAME TO idx_excluded_ips_publication;
ALTER INDEX IF EXISTS idx_poll_excluded_ips_lookup RENAME TO idx_excluded_ips_lookup;

-- Add CIDR range support columns
ALTER TABLE excluded_ips
ADD COLUMN IF NOT EXISTS is_range BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cidr_prefix SMALLINT;

-- Add constraint: cidr_prefix required when is_range=true, null otherwise
-- Drop if exists first (for re-running migration)
ALTER TABLE excluded_ips DROP CONSTRAINT IF EXISTS check_cidr_prefix;
ALTER TABLE excluded_ips
ADD CONSTRAINT check_cidr_prefix
CHECK (
  (is_range = FALSE AND cidr_prefix IS NULL) OR
  (is_range = TRUE AND cidr_prefix IS NOT NULL AND cidr_prefix >= 0 AND cidr_prefix <= 128)
);

-- ============================================
-- PART 2: Add publication_id to link_clicks
-- ============================================

-- Add publication_id column to link_clicks for multi-tenant filtering
ALTER TABLE link_clicks
ADD COLUMN IF NOT EXISTS publication_id UUID REFERENCES publications(id) ON DELETE CASCADE;

-- Index for efficient IP filtering by publication
CREATE INDEX IF NOT EXISTS idx_link_clicks_publication_ip
ON link_clicks(publication_id, ip_address) WHERE ip_address IS NOT NULL;

-- Index for efficient publication filtering
CREATE INDEX IF NOT EXISTS idx_link_clicks_publication
ON link_clicks(publication_id);

-- ============================================
-- PART 3: Backfill publication_id from publication_issues
-- ============================================

-- Backfill publication_id from issue_id relationship
UPDATE link_clicks lc
SET publication_id = pi.publication_id
FROM publication_issues pi
WHERE lc.issue_id = pi.id AND lc.publication_id IS NULL;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE excluded_ips IS 'Unified IP exclusion list for filtering poll responses and link click analytics';
COMMENT ON COLUMN excluded_ips.ip_address IS 'IPv4/IPv6 address or CIDR network address';
COMMENT ON COLUMN excluded_ips.is_range IS 'True if this is a CIDR range, false for single IP';
COMMENT ON COLUMN excluded_ips.cidr_prefix IS 'CIDR prefix length (e.g., 24 for /24)';
COMMENT ON COLUMN link_clicks.publication_id IS 'Publication for multi-tenant filtering';
