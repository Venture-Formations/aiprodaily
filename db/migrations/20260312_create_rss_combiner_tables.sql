-- RSS Feed Combiner tables
-- Global tables (no publication_id) for combining multiple RSS feeds into one

CREATE TABLE combined_feed_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_excluded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_combined_feed_sources_active ON combined_feed_sources (is_active, is_excluded);

CREATE TABLE combined_feed_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  max_age_days INTEGER NOT NULL DEFAULT 7,
  cache_ttl_minutes INTEGER NOT NULL DEFAULT 15,
  feed_title TEXT NOT NULL DEFAULT 'Combined RSS Feed',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default row
INSERT INTO combined_feed_settings (feed_title) VALUES ('Combined RSS Feed');

-- Excluded article sources (publisher names like "Barchart.com", "CNBC")
CREATE TABLE combined_feed_excluded_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
