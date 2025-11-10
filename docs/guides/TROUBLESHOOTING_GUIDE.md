# Database Type Mismatch - Troubleshooting Guide
## 2025-10-14

## 🔴 Error You're Seeing
```
ERROR: 42804: foreign key constraint "duplicate_groups_campaign_id_fkey" cannot be implemented
DETAIL: Key columns "campaign_id" and "id" are of incompatible types: uuid and text.
```

## 🎯 Root Cause

The error indicates that **tables already exist in your Supabase database** with the wrong data types. Even though the SQL files are now correct, Supabase won't recreate existing tables when using `CREATE TABLE IF NOT EXISTS`.

**The Problem:**
- `newsletter_campaigns.id` exists as **TEXT** (should be UUID)
- `duplicate_groups.campaign_id` trying to reference it as **UUID**
- PostgreSQL won't allow foreign key between incompatible types

## ✅ Solution: Clean Database and Recreate

You have **two options**:

---

### Option 1: Run Cleanup Script (Recommended)

This drops all existing tables and lets you start fresh.

**Steps:**

1. **Open Supabase SQL Editor**
   - Go to https://supabase.com/dashboard
   - Select your project
   - Click "SQL Editor" in left sidebar

2. **Run Diagnostic Query First** (optional but recommended)
   ```sql
   -- Copy/paste contents of database_diagnostic.sql
   -- This shows you what exists and what types they have
   ```

3. **Run Cleanup Script**
   - Copy entire contents of `database_cleanup.sql`
   - Paste into SQL Editor
   - Click "Run"
   - ✅ Confirm "Success" message

4. **Run Core Schema**
   - Copy entire contents of `database_complete_schema.sql`
   - Paste into SQL Editor
   - Click "Run"
   - ✅ Confirm all tables created

5. **Run AI Features Schema**
   - Copy entire contents of `database_ai_features_schema.sql`
   - Paste into SQL Editor
   - Click "Run"
   - ✅ Confirm success

---

### Option 2: Manual Table Drop

If you only want to drop specific problematic tables:

```sql
-- Drop only the tables causing issues
DROP TABLE IF EXISTS duplicate_groups CASCADE;
DROP TABLE IF EXISTS duplicate_posts CASCADE;
DROP TABLE IF EXISTS newsletter_campaigns CASCADE;

-- Then recreate just these tables by running the relevant sections
-- of database_complete_schema.sql
```

⚠️ **Warning:** This is more error-prone because of foreign key dependencies.

---

## 📋 Complete Fresh Install Steps

**Recommended for first-time setup:**

1. **Cleanup** (clear everything)
   ```bash
   # In Supabase SQL Editor, run:
   # database_cleanup.sql
   ```

2. **Install Core Schema** (all main tables)
   ```bash
   # In Supabase SQL Editor, run:
   # database_complete_schema.sql
   ```

3. **Install AI Features** (AI apps and prompts)
   ```bash
   # In Supabase SQL Editor, run:
   # database_ai_features_schema.sql
   ```

4. **Verify Installation**
   ```bash
   # Run locally:
   node test-supabase-connection.js
   ```

   **Expected Output:**
   ```
   ✅ Connection successful!
   ✅ Settings table accessible
   ✅ App settings table accessible
   ✅ All tests passed!
   ```

5. **Optional: Check Data Types**
   ```sql
   -- Run database_diagnostic.sql to verify all types are correct
   ```

---

## 🔍 Why CREATE IF NOT EXISTS Didn't Work

When you run:
```sql
CREATE TABLE IF NOT EXISTS newsletter_campaigns (
  id UUID PRIMARY KEY ...
```

If `newsletter_campaigns` **already exists** with `id TEXT`, PostgreSQL:
1. ✅ Sees table exists
2. ❌ Skips recreation (because of IF NOT EXISTS)
3. ❌ Doesn't alter existing table to match new definition
4. ❌ Throws error when foreign key types don't match

**Solution:** Drop existing tables first, then recreate with correct types.

---

## 📦 Files Created for You

| File | Purpose |
|------|---------|
| `database_diagnostic.sql` | Check what exists and what types tables have |
| `database_cleanup.sql` | Drop all tables to start fresh |
| `database_complete_schema.sql` | **FIXED** - Core tables with correct UUID types |
| `database_ai_features_schema.sql` | **FIXED** - AI features with correct UUID types |
| `test-supabase-connection.js` | Verify connection works after install |

---

## ⚠️ Important Notes

1. **Data Loss Warning**
   - Running `database_cleanup.sql` will **DELETE ALL DATA**
   - Only run if you're okay starting from scratch
   - For production data, export first

2. **Order Matters**
   - Always run cleanup → core schema → AI features
   - Don't skip the cleanup step if tables already exist

3. **UUID vs TEXT**
   - Old codebase may have used TEXT for IDs
   - New multi-tenant platform uses UUID for better scalability
   - All `campaign_id`, `newsletter_id`, `id` fields are now UUID

---

## 🚀 Quick Start Command List

Copy these commands into Supabase SQL Editor in order:

```sql
-- STEP 1: Cleanup (if tables exist)
-- Run: database_cleanup.sql

-- STEP 2: Core Schema
-- Run: database_complete_schema.sql

-- STEP 3: AI Features
-- Run: database_ai_features_schema.sql

-- STEP 4: Verify (optional)
-- Run: database_diagnostic.sql
```

Then locally:
```bash
node test-supabase-connection.js
```

---

## ✅ Success Checklist

After running all scripts, verify:

- [ ] No errors in Supabase SQL Editor
- [ ] `node test-supabase-connection.js` passes
- [ ] All tables visible in Supabase Table Editor
- [ ] `newsletter_campaigns.id` shows as `uuid` type
- [ ] `duplicate_groups.campaign_id` shows as `uuid` type
- [ ] Foreign key constraints created successfully

---

## 🆘 Still Having Issues?

If you still see type mismatch errors after cleanup:

1. **Double-check you ran cleanup first**
   ```sql
   -- Verify no tables exist:
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public';
   -- Should return empty or very few tables
   ```

2. **Try force-dropping with CASCADE**
   ```sql
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   GRANT ALL ON SCHEMA public TO postgres;
   GRANT ALL ON SCHEMA public TO public;
   ```
   ⚠️ **Nuclear option** - removes EVERYTHING including extensions

3. **Check for hidden dependencies**
   ```sql
   -- Run database_diagnostic.sql and look for unexpected foreign keys
   ```

---

**You're ready to go!** Run the cleanup script first, then the schemas will install cleanly.
