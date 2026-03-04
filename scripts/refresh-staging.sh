#!/usr/bin/env bash
set -euo pipefail

# Refresh staging database from production.
#
# Usage:
#   PROD_DATABASE_URL="..." STAGING_DATABASE_URL="..." bash scripts/refresh-staging.sh
#
# Requires: pg_dump, psql

if [ -z "${PROD_DATABASE_URL:-}" ]; then
  echo "Error: PROD_DATABASE_URL is not set." >&2
  exit 1
fi

if [ -z "${STAGING_DATABASE_URL:-}" ]; then
  echo "Error: STAGING_DATABASE_URL is not set." >&2
  exit 1
fi

echo "=== Staging Database Refresh ==="
echo ""
echo "This will:"
echo "  1. Dump the production database"
echo "  2. Restore it to the staging database (replacing all existing data)"
echo ""
read -rp "Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

DUMP_FILE="/tmp/prod-dump-$(date +%Y%m%d-%H%M%S).sql"

echo ""
echo "Dumping production database..."
pg_dump "$PROD_DATABASE_URL" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  > "$DUMP_FILE"

DUMP_SIZE=$(wc -c < "$DUMP_FILE")
echo "Dump complete: $DUMP_FILE ($(( DUMP_SIZE / 1024 )) KB)"

echo ""
echo "Restoring to staging database..."
psql "$STAGING_DATABASE_URL" -f "$DUMP_FILE" 2>&1 | tail -5

echo ""
echo "Smoke test: checking publications row count..."
ROW_COUNT=$(psql "$STAGING_DATABASE_URL" -t -c "SELECT count(*) FROM publications;" 2>/dev/null | tr -d ' ')
echo "Publications rows: ${ROW_COUNT}"

if [ "${ROW_COUNT:-0}" -eq 0 ]; then
  echo "WARNING: No publications found — restore may have failed!" >&2
  exit 1
fi

echo ""
echo "Staging refresh complete."
echo "Dump file retained at: $DUMP_FILE"
