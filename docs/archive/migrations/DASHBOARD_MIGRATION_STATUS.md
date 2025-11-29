# Admin Dashboard Migration Status

**Date:** 2025-10-13
**Project:** AI Professional Newsletter (Accounting AI Daily)
**Source:** St. Cloud Scoop

---

## ✅ Completed Tasks

### 1. Core Dashboard Structure Copied
- All dashboard pages copied from St. Cloud Scoop
- File structure preserved: `/src/app/dashboard/`

### 2. St. Cloud-Specific Sections Removed
Deleted the following St. Cloud-specific database pages:
- ❌ `/dashboard/databases/events` (Local Events)
- ❌ `/dashboard/databases/dining` (Dining Deals)
- ❌ `/dashboard/databases/vrbo` (VRBO Listings)
- ❌ `/dashboard/events` (Events Review)

### 3. Database Stats API Updated
**File:** `src/app/api/databases/stats/route.ts`

Removed St. Cloud sections:
- Events
- Dining Deals
- VRBO Listings
- Polls

Added AI Newsletter sections:
- ✅ AI Applications
- ✅ Prompt Ideas

Kept core sections:
- ✅ Images (reused from St. Cloud)
- ✅ RSS Sources (reused from St. Cloud)
- ✅ Advertisements (reused from St. Cloud)

### 4. Branding Updated
- **Main Dashboard:** Changed "St. Cloud Scoop" → "Accounting AI Daily"
  - File: `src/app/dashboard/page.tsx`
- **Navigation Header:** Changed logo text in both staging and production modes
  - File: `src/components/Layout.tsx`

---

## 📋 Dashboard Pages Available

### Core Pages (Working)
- ✅ `/dashboard` - Main dashboard with campaign stats
- ✅ `/dashboard/campaigns` - Campaign list view
- ✅ `/dashboard/campaigns/new` - Create new campaign
- ✅ `/dashboard/campaigns/[id]` - Campaign detail view
- ✅ `/dashboard/analytics` - Analytics dashboard
- ✅ `/dashboard/settings` - Settings page
- ✅ `/dashboard/logs` - System logs
- ✅ `/dashboard/databases` - Database management hub

### Database Management Pages (Working)
- ✅ `/dashboard/databases/images` - Image library management
- ✅ `/dashboard/databases/rss-sources` - RSS source configuration
- ✅ `/dashboard/databases/ads` - Advertisement management

### Database Management Pages (Need Creation)
- ⏳ `/dashboard/databases/ai-apps` - **NOT YET CREATED**
- ⏳ `/dashboard/databases/prompt-ideas` - **NOT YET CREATED**

---

## 🚧 Next Steps (In Priority Order)

### Step 1: Create AI Applications Database Page
**File to create:** `src/app/dashboard/databases/ai-apps/page.tsx`

**Features needed:**
- List all AI applications from `ai_applications` table
- Add new application form
- Edit existing application (inline editing)
- Delete application with confirmation
- Filter by category (Automation, Analysis, Writing, etc.)
- Mark as featured toggle
- Track usage stats display

**Reference:** Use `src/app/dashboard/databases/events/page.tsx` from St. Cloud as template

### Step 2: Create Prompt Ideas Database Page
**File to create:** `src/app/dashboard/databases/prompt-ideas/page.tsx`

**Features needed:**
- List all prompt ideas from `prompt_ideas` table
- Add new prompt form with multi-line text area
- Edit existing prompt (inline editing)
- Delete prompt with confirmation
- Filter by category and difficulty level
- Preview prompt text
- Track usage stats display

**Reference:** Similar pattern to AI apps page

### Step 3: Create API Routes for AI Apps
**Files to create:**
- `src/app/api/ai-apps/route.ts` - GET (list) and POST (create)
- `src/app/api/ai-apps/[id]/route.ts` - PATCH (update) and DELETE

### Step 4: Create API Routes for Prompt Ideas
**Files to create:**
- `src/app/api/prompt-ideas/route.ts` - GET (list) and POST (create)
- `src/app/api/prompt-ideas/[id]/route.ts` - PATCH (update) and DELETE

### Step 5: Update Campaign Detail Page
**File to modify:** `src/app/dashboard/campaigns/[id]/page.tsx`

**Changes needed:**
- Add "AI Apps" section (select 5 apps for campaign)
- Add "Prompt Ideas" section (select 3-5 prompts for campaign)
- Remove St. Cloud sections (Events, Dining, etc.)

### Step 6: Test Local Build
```bash
npm run dev
```

**Test checklist:**
- [ ] Dashboard loads without errors
- [ ] All navigation links work
- [ ] Database stats show correct counts
- [ ] Images/RSS/Ads pages still work
- [ ] AI Apps page loads (once created)
- [ ] Prompt Ideas page loads (once created)

---

## 📊 Current Database Status

### Tables Ready (From Supabase Setup)
- ✅ `newsletters` - Newsletter registry
- ✅ `newsletter_settings` - Newsletter-specific settings
- ✅ `newsletter_sections` - Section configuration
- ✅ `newsletter_campaigns` - Campaign data
- ✅ `ai_applications` - 10 sample apps loaded
- ✅ `prompt_ideas` - 10 sample prompts loaded
- ✅ `campaign_ai_app_selections` - Links campaigns to apps
- ✅ `campaign_prompt_selections` - Links campaigns to prompts
- ✅ `articles` - RSS articles
- ✅ `rss_posts` - RSS feed data
- ✅ `images` - Image library
- ✅ `advertisements` - Ad management

---

## 🔄 Reusable Components from St. Cloud Scoop

These St. Cloud Scoop components can be reused as-is:

### Campaign Management
- Campaign creation workflow
- Campaign status management (Draft → In Review → Sent)
- Campaign preview generation (needs modification for new sections)
- MailerLite integration

### Content Management
- RSS feed processing
- AI article ranking
- Subject line generation
- Image management with AI tagging

### User Interface
- Layout component (✅ Already updated with new branding)
- Navigation structure
- Loading states
- Error handling

---

## ⚠️ Important Notes

1. **Database Connection:** Ensure `.env.local` has correct Supabase credentials for AI_Pros_Newsletter project

2. **MailerLite:** Will need separate group IDs for Accounting newsletter (different from St. Cloud)

3. **Newsletter Preview:** The preview generation route will need significant updates to use the new 6-section layout (Welcome, Top 3 Articles, AI Apps, Bottom 3 Articles, Prompt Ideas)

4. **RSS Sources:** Will need different RSS feeds focused on AI/accounting news instead of St. Cloud local news

---

## 🎯 Estimated Time Remaining

- **AI Apps Database Page:** 2-3 hours
- **Prompt Ideas Database Page:** 2-3 hours
- **API Routes (both):** 1-2 hours
- **Campaign Page Updates:** 1-2 hours
- **Testing & Bug Fixes:** 1-2 hours

**Total:** 7-12 hours remaining for complete dashboard implementation

---

**Status:** Core dashboard structure complete, ready for AI-specific database management pages

**Next Action:** Create AI Applications database management page
