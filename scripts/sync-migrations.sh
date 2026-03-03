#!/usr/bin/env bash
# sync-migrations.sh — Apply all SQL migrations to a Supabase project.
#
# Usage:
#   npm run migrate:staging
#   # or directly:
#   STAGING_DB_URL="postgresql://..." bash scripts/sync-migrations.sh
#
# Requires: psql (PostgreSQL client)
#
# The script applies every file in db/migrations/ in alphabetical order.
# Files that have already been applied will fail on duplicate objects —
# use idempotent SQL (IF NOT EXISTS, etc.) in migrations for safety.

set -euo pipefail

DB_URL="${STAGING_DB_URL:?'Set STAGING_DB_URL to the staging Supabase connection string'}"
MIGRATIONS_DIR="$(cd "$(dirname "$0")/../db/migrations" && pwd)"

if ! command -v psql &> /dev/null; then
  echo "❌ psql not found. Install PostgreSQL client tools."
  exit 1
fi

echo "Applying migrations from $MIGRATIONS_DIR ..."

count=0
for file in "$MIGRATIONS_DIR"/*.sql; do
  [ -f "$file" ] || continue
  echo "  → $(basename "$file")"
  psql "$DB_URL" -f "$file" -v ON_ERROR_STOP=1
  count=$((count + 1))
done

echo "✅ Applied $count migration(s) to staging database."
