-- Phase 3, Q7: Full-text search on tools_directory
-- Generated tsvector column combining tool_name, description, and tagline.
-- GIN index for fast @@ queries.

ALTER TABLE tools_directory ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(tool_name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(tagline, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_tools_directory_fts ON tools_directory USING gin (search_vector);

-- Usage:
-- SELECT tool_name, ts_rank(search_vector, query) AS rank
-- FROM tools_directory, to_tsquery('english', 'accounting & ai') AS query
-- WHERE search_vector @@ query
-- ORDER BY rank DESC;
