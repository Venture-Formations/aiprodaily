# Database Setup Guide
## AI Professional Newsletter Platform

**Last Updated:** 2025-10-14

---

## ✅ Connection Status

Your Supabase connection is **WORKING PERFECTLY**!

- **URL:** `https://vsbdfrqfokoltgjyiivq.supabase.co`
- **Status:** ✅ Connected and authenticated
- **Database:** Empty and ready for schema setup

---

## 📋 Required SQL Files (Run in Order)

### 1. **Core Schema** (REQUIRED)
**File:** `database_complete_schema.sql`
**Description:** Creates all core tables for the multi-newsletter platform
**Tables Created:**
- Newsletters & newsletter_settings (multi-tenant)
- Campaigns, RSS feeds, posts, articles
- User management & activities
- Analytics & metrics
- Archival tables
- Polls & engagement

**Run in Supabase SQL Editor:** Copy and paste the entire file contents

### 2. **AI Features** (REQUIRED)
**File:** `database_ai_features_schema.sql`
**Description:** Adds AI-powered features for professional newsletters
**Tables Created:**
- AI applications catalog
- Prompt ideas library
- Campaign selections for AI apps
- Campaign selections for prompts

### 3. **Breaking News** (OPTIONAL)
**File:** `database_breaking_news_schema.sql`
**Description:** Breaking news detection and categorization
**Tables Created:**
- Breaking news tracking
- AI scoring for news urgency

### 4. **RSS Feeds Migration** (OPTIONAL)
**File:** `database_rss_feeds_migration.sql`
**Description:** Additional RSS feed enhancements

---

## 🚀 Quick Setup Steps

### Step 1: Open Supabase SQL Editor
1. Go to https://supabase.com/dashboard
2. Select your project: `vsbdfrqfokoltgjyiivq`
3. Click "SQL Editor" in the left sidebar

### Step 2: Run Core Schema
1. Open `database_complete_schema.sql`
2. Copy the entire contents
3. Paste into Supabase SQL Editor
4. Click "Run" button
5. ✅ Verify success message

### Step 3: Run AI Features Schema
1. Open `database_ai_features_schema.sql`
2. Copy the entire contents
3. Paste into Supabase SQL Editor
4. Click "Run" button
5. ✅ Verify success message

### Step 4: (Optional) Run Additional Schemas
Repeat the same process for:
- `database_breaking_news_schema.sql`
- `database_rss_feeds_migration.sql`

---

## 🔍 Verification

### Test 1: Run Connection Test Script
```bash
node test-supabase-connection.js
```

**Expected Output:**
```
✅ Connection successful!
✅ Settings table accessible
✅ App settings table accessible
✅ All tests passed!
```

### Test 2: Check Tables in Supabase
Run this query in SQL Editor:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Expected Tables (minimum 25):**
- advertisements
- ai_applications
- app_settings
- archived_articles
- archived_post_ratings
- archived_rss_posts
- article_performance
- articles
- campaign_advertisements
- campaign_ai_app_selections
- campaign_prompt_selections
- duplicate_groups
- duplicate_posts
- email_metrics
- link_clicks
- manual_articles
- newsletter_campaigns
- newsletter_sections
- newsletter_settings
- newsletters
- poll_responses
- polls
- post_ratings
- prompt_ideas
- rss_feeds
- rss_posts
- system_logs
- user_activities
- users

---

## 📊 Database Schema Overview

### Multi-Tenant Architecture
```
newsletters (parent)
  └── newsletter_settings (config per newsletter)
  └── newsletter_campaigns (campaigns per newsletter)
      └── articles
      └── rss_posts
      └── campaign_ai_app_selections
      └── campaign_prompt_selections
```

### Key Features
- **Multi-Newsletter Support**: Each professional industry (Accounting, Legal, etc.) gets its own newsletter
- **AI-Powered Content**: Automated content generation and scoring
- **RSS Aggregation**: Pull from multiple RSS feeds per newsletter
- **Analytics**: Track opens, clicks, engagement
- **Archival System**: Historical data retention
- **User Management**: Admin and reviewer roles

---

## 🛠️ Troubleshooting

### Issue: "table already exists" error
**Solution:** Tables from a previous setup. Safe to ignore or run:
```sql
DROP TABLE IF EXISTS [table_name] CASCADE;
```
Then re-run the schema file.

### Issue: Foreign key constraint errors
**Solution:** Run schemas in the correct order (core → AI features → optional)

### Issue: Permission denied
**Solution:** Make sure you're using the service role key in `.env.local`:
```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

---

## 📝 Next Steps After Setup

1. **Create First Newsletter**
   ```sql
   INSERT INTO newsletters (slug, name, subdomain, primary_color)
   VALUES ('accounting', 'AI Accounting Pro', 'accounting', '#3B82F6');
   ```

2. **Add RSS Feeds**
   - Go to Dashboard → RSS Feeds
   - Add industry-specific RSS sources

3. **Configure Newsletter Settings**
   - Go to Dashboard → Settings
   - Set up MailerLite API keys
   - Configure email sending times

4. **Test Campaign Creation**
   - Go to Dashboard → Campaigns
   - Create a test campaign
   - Process RSS feeds

---

## 🔗 Useful Resources

- **Supabase Dashboard**: https://supabase.com/dashboard
- **Local Test Script**: `node test-supabase-connection.js`
- **Environment File**: `.env.local`
- **TypeScript Types**: `src/types/database.ts`

---

## ⚠️ Important Notes

- **Backup First**: If you have existing data, export it before running schema
- **Service Role Key**: Required for admin operations (already in .env.local)
- **Indexes**: Automatically created for performance
- **Triggers**: Auto-update timestamps on table changes

---

## ✨ Current Status

- [x] Supabase connection verified
- [x] Environment variables configured
- [ ] Core schema installed
- [ ] AI features schema installed
- [ ] First newsletter created
- [ ] RSS feeds added
- [ ] Test campaign created

**You're ready to run the SQL schemas!**
