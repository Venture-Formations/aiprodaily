# Database Migrations

## Naming Convention

```
YYYYMMDD_descriptive_name.sql
```

Example: `20260327_create_feed_health_rules.sql`

## Required Patterns

### Table Creation
```sql
CREATE TABLE IF NOT EXISTS my_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  -- ... columns ...
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Always index publication_id
CREATE INDEX IF NOT EXISTS idx_my_table_pub ON my_table(publication_id);
```

### Rules
- **`publication_id` is required** on every new table (multi-tenant isolation)
- **Use `IF NOT EXISTS`** for idempotency — migrations may be re-run
- **Use `TIMESTAMPTZ`** for all timestamps (never `DATE` or `TIMESTAMP`)
- **Use `UUID` primary keys** with `gen_random_uuid()`
- **Use `CHECK` constraints** for enum-like columns instead of Postgres enums
- **Use `ON DELETE CASCADE`** for foreign keys referencing `publications`
- **Create indexes** on `publication_id`, foreign keys, and frequent query columns
- **Conditional indexes** where useful: `WHERE is_active = true`

### RLS
- Enable RLS on new tables: `ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;`
- No policies needed — app uses `supabaseAdmin` (service role) which bypasses RLS
- RLS locks out direct PostgREST/anon key access

### Column Additions
```sql
ALTER TABLE my_table ADD COLUMN IF NOT EXISTS new_col TEXT DEFAULT '';
```

## Running Migrations

```bash
npm run migrate:staging   # Apply to staging Supabase
npm run migrate:prod      # Apply to production Supabase
```

Always run on staging first, verify, then apply to production.

## Schema Drift Warning

After adding migrations, run `npm run sync-staging` to sync data. Column mismatches between environments cause silent data loss in upserts.
