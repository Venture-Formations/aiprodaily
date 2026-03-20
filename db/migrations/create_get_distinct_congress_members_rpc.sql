-- RPC function for efficient distinct member name lookup
-- Used by /api/article-images/members for autocomplete
-- Avoids paginating through 110K+ congress_trades rows

CREATE OR REPLACE FUNCTION get_distinct_congress_members()
RETURNS TABLE(name TEXT, party TEXT, state TEXT, chamber TEXT)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT DISTINCT ON (ct.name)
    ct.name, ct.party, ct.state, ct.chamber
  FROM congress_trades ct
  WHERE ct.name IS NOT NULL
  ORDER BY ct.name;
$$;
