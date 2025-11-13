# Tables with publication_id Column

## Complete List of Tables

This document lists all tables that have a `publication_id` column (formerly `newsletter_id`) after the migration.

### Core Multi-Tenant Tables (UUID type)

1. **newsletter_settings**
   - Type: `UUID`
   - References: `publications(id)`
   - Index: N/A (part of unique constraint)
   - Unique Constraint: `(publication_id, key)`

2. **newsletter_campaigns**
   - Type: `UUID`
   - References: `publications(id)`
   - Index: `idx_campaigns_publication`
   - Foreign Key: ON DELETE CASCADE

3. **rss_feeds**
   - Type: `UUID`
   - References: `publications(id)`
   - Index: `idx_rss_feeds_publication` (if exists)
   - Foreign Key: ON DELETE CASCADE

4. **newsletter_sections**
   - Type: `UUID`
   - References: `publications(id)`
   - Index: `idx_newsletter_sections_publication` (if exists)
   - Foreign Key: ON DELETE CASCADE

### AI Features Tables (UUID type)

5. **ai_applications**
   - Type: `UUID`
   - References: `publications(id)`
   - Index: N/A
   - Foreign Key: ON DELETE CASCADE

6. **prompt_ideas**
   - Type: `UUID`
   - References: `publications(id)`
   - Index: N/A
   - Foreign Key: ON DELETE CASCADE

### Breaking News Tables (UUID type)

7. **breaking_news_feeds** (if exists)
   - Type: `UUID`
   - References: `publications(id)`
   - Index: N/A
   - Foreign Key: ON DELETE CASCADE

### Settings Tables (UUID type)

8. **app_settings** (if publication_id column exists)
   - Type: `UUID`
   - References: `publications(id)`
   - Index: N/A
   - Foreign Key: Optional

### Archived Tables (varies)

9. **archived_newsletters** (if exists)
   - Type: Varies (could be TEXT or UUID depending on implementation)
   - References: May reference newsletters
   - Index: `idx_archived_newsletters_publication_id`
   - Unique Constraint: `(publication_id, campaign_date)`

### Advertising Tables (UUID type)

10. **advertisements**
    - Type: `UUID`
    - References: `publications(id)`
    - Index: `idx_advertisements_publication` (if exists)
    - Foreign Key: ON DELETE CASCADE

### User Interaction Tables (TEXT type)

11. **contact_submissions** (if exists)
    - Type: `TEXT`
    - References: `publications(slug)` ⚠️ (references slug, not id!)
    - Index: `idx_contact_submissions_publication_id`
    - Foreign Key: ON DELETE CASCADE

12. **ai_prompt_tests** (if exists)
    - Type: `TEXT`
    - References: None (stores slug directly)
    - Index: `idx_ai_prompt_tests_user_publication`
    - Unique Constraint: `(user_id, publication_id, provider, model, prompt_type)`

## Important Notes

### Data Type Differences

**UUID-based tables**: Most tables use `UUID` type and reference `publications(id)`
- newsletter_settings
- newsletter_campaigns
- rss_feeds
- newsletter_sections
- ai_applications
- prompt_ideas
- breaking_news_feeds
- app_settings

**TEXT-based tables**: These tables use `TEXT` type (often storing slugs)
- contact_submissions (references `publications(slug)`)
- ai_prompt_tests (stores slug directly, no foreign key)

### Foreign Key References

Most tables reference `publications(id)` with UUID:
```sql
publication_id UUID REFERENCES publications(id) ON DELETE CASCADE
```

**Exception**: `contact_submissions` references newsletters by slug:
```sql
publication_id TEXT
FOREIGN KEY (publication_id) REFERENCES publications(slug) ON DELETE CASCADE
```

### Migration Considerations

1. **UUID columns**: Can be renamed directly without data conversion
2. **TEXT columns**: Can be renamed directly (contain slug values)
3. **Foreign keys**: Will automatically update to point to renamed columns
4. **Indexes**: Must be explicitly renamed
5. **Unique constraints**: Must be dropped and recreated with new column names

## Verification Queries

### Check all publication_id columns
```sql
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE column_name = 'publication_id'
AND table_schema = 'public'
ORDER BY table_name;
```

### Check foreign key relationships
```sql
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND kcu.column_name = 'publication_id'
ORDER BY tc.table_name;
```

### Verify no newsletter_id columns remain
```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE column_name = 'newsletter_id'
AND table_schema = 'public';
-- Should return 0 rows after migration
```

### Check all indexes
```sql
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE '%publication%'
ORDER BY tablename;
```

## Post-Migration Testing

After running the migration, test these scenarios:

1. **Campaign Creation**: Verify campaigns are created with correct publication_id
2. **RSS Processing**: Check RSS feeds filter by publication_id correctly
3. **Article Generation**: Ensure articles reference correct publication_id
4. **Settings Access**: Verify app_settings queries filter properly
5. **Contact Forms**: Test contact submission with publication slug
6. **AI Prompt Tests**: Verify prompt test storage and retrieval
7. **Multi-Tenant Isolation**: Confirm different publications can't access each other's data

## Rollback Information

If needed, reverse the migration by renaming columns back:
```sql
ALTER TABLE newsletter_settings RENAME COLUMN publication_id TO newsletter_id;
-- Repeat for all tables...
```

See `MIGRATION_NEWSLETTER_TO_PUBLICATION.md` for full rollback script.
