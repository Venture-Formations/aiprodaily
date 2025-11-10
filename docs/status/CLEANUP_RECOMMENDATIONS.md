# St. Cloud Scoop Cleanup Recommendations

This document provides actionable recommendations for each reference category, organized by priority and impact.

---

## 🎯 RECOMMENDATION SUMMARY

### Quick Decision Matrix
- **🟢 DELETE**: Safe to remove, not needed for AI newsletters
- **🟡 UPDATE**: Should be updated to use newsletter settings or be newsletter-agnostic
- **🔵 KEEP**: Leave as-is (backwards compatible, multi-tenant support, or documentation)

---

## 1. ST. CLOUD SCOOP REFERENCES

### 🟡 UPDATE - High Priority (Breaking Issues)

#### **Email & Newsletter Templates - Default Fallbacks**
**Files:**
- `src/lib/newsletter-templates.ts` (lines 167, 169, 1271)
- `src/lib/mailerlite.ts` (lines 60, 61, 560, 561)
- `src/app/dashboard/[slug]/settings/page.tsx` (line 1130)
- `src/app/api/settings/email/route.ts` (line 48)

**Current Issue:**
- Hardcoded fallbacks to "St. Cloud Scoop" and "scoop@stcscoop.com"
- If newsletter settings are missing, emails show wrong branding

**Recommendation:** UPDATE
- Change fallbacks to generic values or newsletter-specific defaults
- Use `newsletter_name` from `app_settings` table
- Default to empty string or generic "Newsletter" if setting missing

**Example Fix:**
```typescript
const newsletterName = settingsMap.newsletter_name || 'Newsletter'
const fromEmail = settingsMap['email_fromEmail'] || ''
const senderName = settingsMap['email_senderName'] || settingsMap.newsletter_name || 'Newsletter'
```

---

### 🟡 UPDATE - Medium Priority (URLs)

#### **Hardcoded St. Cloud URLs**
**Files:**
- `src/lib/newsletter-templates.ts` (lines 620-621)
- `src/lib/gmail-service.ts` (lines 118, 191)

**Current Issue:**
- Events URLs hardcoded to `events.stcscoop.com`
- Email footers link to `stcscoop.com`

**Recommendation:** UPDATE
- Use `website_url` from `app_settings` for base URLs
- For events: `{website_url}/events/view` and `{website_url}/events/submit`
- Or add `events_url` setting if events are newsletter-specific

**Example Fix:**
```typescript
const websiteUrl = settingsMap.website_url || ''
const viewAllEventsUrl = websiteUrl ? wrapTrackingUrl(`${websiteUrl}/events/view`, ...) : ''
```

---

### 🟡 UPDATE - Low Priority (User-Agent Headers)

#### **User-Agent Strings**
**Files:**
- `src/lib/github-storage.ts` (lines 49, 142)
- `src/lib/vrbo-image-processor.ts` (line 35)
- `src/app/api/debug/test-visitstcloud/route.ts` (line 21)
- `src/app/api/debug/test-fetch/route.ts` (line 23)

**Current Issue:**
- User-Agent headers say "StCloudScoop-Newsletter/1.0"
- Not critical but shows in server logs

**Recommendation:** UPDATE
- Use generic user-agent: `"Newsletter-Platform/1.0"` or `"AI-Pros-Newsletter/1.0"`
- Or make it dynamic based on newsletter: `"${newsletterName}-Newsletter/1.0"`

---

### 🟡 UPDATE - Medium Priority (Logo Images)

#### **Logo Image URLs**
**Files:**
- `src/lib/newsletter-templates.ts` (line 167)
- `src/app/events/view/page.tsx` (line 292)
- `src/app/events/submit/page.tsx` (line 406)
- `src/app/events/[id]/page.tsx` (line 234)

**Current Issue:**
- Default logo points to St. Cloud Scoop GitHub repo
- Event pages use hardcoded St. Cloud logo

**Recommendation:** UPDATE
- Use `header_image_url` or `logo_url` from `app_settings`
- Default to generic placeholder or empty if not set
- Event pages should use newsletter-specific logo

---

### 🟡 UPDATE - Low Priority (UI Text)

#### **Public-Facing Text**
**Files:**
- `src/app/feedback/thank-you/page.tsx` (lines 40, 50, 55)
- `src/app/feedback/error/page.tsx` (lines 56, 61)
- `src/app/dashboard/polls/page.tsx` (line 258)
- `src/app/ads/submit/page.tsx` (line 144)

**Current Issue:**
- Hardcoded "St. Cloud Scoop" in UI text
- Placeholder examples reference St. Cloud

**Recommendation:** UPDATE
- Use `newsletter_name` from settings
- Make placeholders generic: "How satisfied are you with this newsletter?"

---

### 🟢 DELETE - Safe to Remove

#### **Test Endpoints with Hardcoded Values**
**Files:**
- `src/app/api/debug/test-mailerlite-schedule/route.ts` (line 59)
- `src/app/api/debug/test-mailerlite-schedule-format/route.ts` (line 40)
- `src/app/api/debug/mailerlite-test/route.ts` (line 129)
- `src/app/api/test/slack/route.ts` (line 18)

**Recommendation:** DELETE or UPDATE
- These are debug/test endpoints
- Either remove or update to use settings
- Safe to delete if not actively used

---

### 🟢 DELETE - Documentation

#### **Historical Documentation Files**
**Files:**
- `README.md` (entire file - mentions St. Cloud Scoop)
- `../guides/NEWSLETTER_ARCHIVE_TO_WEBSITE_IMPLEMENTATION_GUIDE.md` (multiple references)
- `docs/AI_PROMPT_SYSTEM_GUIDE.md` (St. Cloud references)
- `SESSION_NOTES.md`, `SESSION_PROGRESS.md`, `../migrations/DASHBOARD_MIGRATION_STATUS.md`
- `../migrations/MULTI_TENANT_MIGRATION_GUIDE.md` (St. Cloud examples)
- `CLAUDE.md.backup`, `*.backup` files

**Recommendation:** DELETE or UPDATE
- **README.md**: Update to reflect AI Pros Newsletter platform
- **Migration guides**: Keep for reference but note they're historical
- **Backup files**: Safe to delete (`.backup` files)
- **Session notes**: Archive or delete if no longer needed

---

### 🔵 KEEP - Leave As-Is

#### **Code Comments & Documentation Strings**
**Files:**
- Various code comments mentioning St. Cloud Scoop
- Error messages that reference the original project

**Recommendation:** KEEP
- Comments are informational, don't affect functionality
- Can be updated later if desired

---

## 2. ROAD WORK REFERENCES

### 🟢 DELETE - Already Disabled

#### **Disabled Road Work Section**
**File:** `src/lib/newsletter-templates.ts` (line 1245-1248)

**Current Status:**
- Function exists but returns empty string
- Logs "Road Work section disabled for AI Accounting Daily"

**Recommendation:** DELETE
- Function is already disabled
- Safe to remove entirely if Road Work won't be used for AI newsletters
- **OR** keep function but remove the disabled message and make it return empty silently

---

### 🟡 UPDATE - Conditional Logic

#### **Road Work in Campaign Management**
**Files:**
- `src/app/dashboard/[slug]/campaigns/[id]/page.tsx` (line 1088)
- `src/lib/mailerlite.ts` (line 412)
- `src/app/api/campaigns/[id]/preview/route.ts` (line 238)

**Current Status:**
- Road Work section rendering logic still active
- Only generates empty HTML, but UI components exist

**Recommendation:** UPDATE
- Check if Road Work section is active in `newsletter_sections` table
- Only render if `is_active = true` for that newsletter
- This makes it newsletter-agnostic (some newsletters might want Road Work)

---

### 🔵 KEEP - Infrastructure (Multi-Tenant Support)

#### **Road Work Database Schema & Utilities**
**Files:**
- `src/types/database.ts` (RoadWorkItem, RoadWorkData interfaces)
- `src/lib/road-work-scraper.ts` (entire file)
- `src/lib/perplexity.ts` (road work functions)
- `src/lib/openai.ts` (road work prompts)
- `src/app/api/campaigns/[id]/delete/route.ts` (cleanup logic)

**Recommendation:** KEEP
- Database schema needed for multi-tenant support (other newsletters might use Road Work)
- Scraping utilities are generic and can be reused
- Only remove if you're certain no newsletter will ever use Road Work

---

### 🟢 DELETE - St. Cloud-Specific Scraping

#### **St. Cloud-Specific Road Work Scraping**
**Files:**
- `src/lib/road-work-scraper.ts` (lines 16, 22, 88)
- `src/lib/perplexity.ts` (lines 135, 253)
- `src/lib/openai.ts` (line 461)
- `src/app/api/settings/ai-prompts/route.ts` (line 498)
- `src/app/api/debug/initialize-ai-prompts/route.ts` (line 172)

**Current Issue:**
- Hardcoded St. Cloud city URLs in scraping prompts
- `scrapeStCloudRoadWork()` function name

**Recommendation:** UPDATE
- Make scraping location configurable via newsletter settings
- Add `road_work_location` or `road_work_urls` setting
- Update function names to be generic: `scrapeRoadWork(location)`
- Update AI prompts to use configurable location

---

### 🟢 DELETE - Test Endpoints

#### **Road Work Test Endpoints**
**Files:**
- `src/app/api/test/road-work/route.ts` (entire file)
- `src/app/api/debug/test-ai-prompts/route.ts` (lines 539-543)

**Recommendation:** DELETE or KEEP
- Keep if you plan to re-enable Road Work
- Delete if Road Work is permanently removed

---

## 3. WORDLE REFERENCES

### 🤔 DECISION REQUIRED - Active Feature

#### **Wordle Cron Job & Collection**
**Files:**
- `vercel.json` (line 44, 86)
- `src/lib/wordle-scraper.ts` (entire file)
- `src/lib/newsletter-templates.ts` (Wordle section generator)
- `src/app/dashboard/[slug]/campaigns/[id]/page.tsx` (WordleSection component)

**Current Status:**
- Active cron job runs daily at 7 PM CT
- Collects Wordle data automatically
- Section renders in newsletters if active

**Recommendation:** DECISION REQUIRED
- **Option A - KEEP**: If Wordle is valuable for AI newsletters, keep it
- **Option B - DELETE**: If Wordle doesn't fit AI newsletter theme, remove:
  1. Remove cron job from `vercel.json`
  2. Delete `src/lib/wordle-scraper.ts`
  3. Remove Wordle section from templates
  4. Remove WordleSection component
  5. Remove Wordle from database schema (if unused)

**Impact if Deleted:**
- No breaking changes if section is inactive
- Database cleanup needed if Wordle table has data

---

### 🟡 UPDATE - Section Name Check

#### **Wordle Section Matching**
**File:** `src/app/dashboard/[slug]/campaigns/[id]/page.tsx` (line 1066)

**Current Issue:**
- Hardcoded string match: `case 'Yesterday\'s Wordle':`

**Recommendation:** UPDATE
- Use section ID matching instead of name matching
- Or check if section is active before rendering

---

### 🔵 KEEP - Database Schema

#### **Wordle Database Types**
**File:** `src/types/database.ts` (line 625)

**Recommendation:** KEEP
- Type definitions don't hurt if unused
- Can be removed if Wordle is completely deleted

---

## 4. LOCAL EVENTS REFERENCES

### 🟡 UPDATE - Critical (Hardcoded URLs)

#### **Events URLs in Newsletter Templates**
**File:** `src/lib/newsletter-templates.ts` (lines 620-621)

**Current Issue:**
- Hardcoded `events.stcscoop.com` URLs
- Will break if newsletter uses different domain

**Recommendation:** UPDATE - HIGH PRIORITY
- Use `website_url` from settings
- Construct URLs: `${websiteUrl}/events/view` and `${websiteUrl}/events/submit`
- Or add `events_base_url` setting

**Example Fix:**
```typescript
const websiteUrl = settingsMap.website_url || ''
const viewAllEventsUrl = websiteUrl 
  ? wrapTrackingUrl(`${websiteUrl}/events/view`, 'Local Events', ...)
  : ''
```

---

### 🤔 DECISION REQUIRED - Events Feature

#### **Local Events Section**
**Files:**
- `src/lib/newsletter-templates.ts` (generateLocalEventsSection)
- `src/app/dashboard/[slug]/campaigns/[id]/page.tsx` (event selection UI)
- `src/app/events/` (entire directory)

**Current Status:**
- Active feature with event management
- Public event pages exist
- Event submission system

**Recommendation:** DECISION REQUIRED
- **Option A - KEEP**: If events are valuable for AI newsletters (e.g., "AI Events", "Webinars")
- **Option B - DELETE**: If events are only for local newsletters:
  1. Remove events section from templates
  2. Remove `/events` routes
  3. Remove event management UI
  4. Archive event database tables

**Note:** Events system is generic enough to be repurposed for AI-related events

---

### 🟡 UPDATE - UI Text

#### **Events Page Branding**
**Files:**
- `src/app/events/view/page.tsx` (line 305 - "Local Events" heading)
- Logo images (already covered above)

**Recommendation:** UPDATE
- Make heading configurable: use `newsletter_name` + " Events"
- Or use generic "Events" if events are multi-tenant

---

## 5. ST. CLOUD-SPECIFIC SCRAPING & UTILITIES

### 🟡 UPDATE - Location-Specific Functions

#### **St. Cloud City Scraping**
**Files:**
- `src/lib/road-work-scraper.ts` (scrapeStCloudRoadWork)
- `src/lib/perplexity.ts` (St. Cloud URLs in prompts)
- `src/app/api/debug/test-visitstcloud/route.ts` (entire file)

**Recommendation:** UPDATE
- Make location configurable
- Add location settings to newsletter configuration
- Genericize function names

**OR DELETE:**
- If Road Work is permanently disabled, remove these entirely

---

## 📋 PRIORITY ACTION PLAN

### Phase 1: Critical Updates (Do First)
1. ✅ Update email sender defaults in `mailerlite.ts` and `newsletter-templates.ts`
2. ✅ Update hardcoded event URLs in `newsletter-templates.ts`
3. ✅ Update logo image fallbacks
4. ✅ Update feedback page text to use newsletter name

### Phase 2: Feature Decisions
5. 🤔 Decide: Keep or remove Wordle? (Recommendation: Remove for AI newsletters)
6. 🤔 Decide: Keep or remove Local Events? (Recommendation: Keep but rebrand for AI events)
7. 🤔 Decide: Keep or remove Road Work? (Recommendation: Remove for AI newsletters)

### Phase 3: Cleanup After Decisions
8. 🟢 Remove Wordle cron job if deleted
9. 🟢 Remove Road Work section generation if deleted
10. 🟢 Clean up St. Cloud-specific scraping functions
11. 🟢 Update user-agent headers

### Phase 4: Documentation
12. 🟢 Update README.md
13. 🟢 Delete or archive backup files
14. 🟢 Update migration guides (mark as historical)

---

## 🔍 SAFE DELETION CHECKLIST

Before deleting any feature, verify:

- [ ] Feature is not active in any newsletter (check `newsletter_sections` table)
- [ ] No cron jobs reference the feature (check `vercel.json`)
- [ ] No database data exists (check relevant tables)
- [ ] No active campaigns use the feature (check `newsletter_campaigns`)
- [ ] Test endpoints are not used (check API routes)
- [ ] No external dependencies (check imports)

---

## 💡 RECOMMENDED DEFAULT ACTIONS

### Safe to Delete Now:
1. **Road Work section generation** (already disabled)
2. **St. Cloud-specific scraping functions** (if Road Work removed)
3. **Backup files** (`.backup` files)
4. **Test endpoints with hardcoded values** (if not actively used)

### Must Update:
1. **Email defaults** (breaking issue)
2. **Event URLs** (breaking issue)
3. **Logo fallbacks** (branding issue)
4. **User-facing text** (branding issue)

### Decision Needed:
1. **Wordle feature** (active but may not fit AI theme)
2. **Local Events feature** (active, could be repurposed)

---

## 🎯 RECOMMENDED FINAL STATE

After cleanup, the system should:
- ✅ Use `app_settings` table for all newsletter-specific values
- ✅ Have no hardcoded "St. Cloud Scoop" references in active code
- ✅ Support multi-tenant newsletters with different configurations
- ✅ Only include features relevant to AI professional newsletters
- ✅ Have clean, maintainable code with no legacy references

---

*This document should be reviewed and updated as cleanup progresses.*


