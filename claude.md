# AI Accounting Daily - Development Documentation

**Last Updated:** 2025-10-15
**Project:** AI Accounting Daily Newsletter Platform
**Purpose:** Professional newsletter for accounting industry with AI-powered content curation

---

## 🔒 **CURRENT SAVE POINT - Secondary Articles Feature Complete** (2025-10-15)

**System State:** Fully functional multi-section newsletter with secondary article support
**Working Features:**
- ✅ RSS Processing for primary and secondary article sections
- ✅ AI-powered article evaluation and generation
- ✅ Multi-section newsletter architecture
- ✅ Campaign management workflow
- ✅ Breaking News and Beyond the Feed sections
- ✅ AI Applications showcase
- ✅ Community Business Spotlight (advertisements)
- ✅ Poll system
- ✅ **NEW: Secondary Articles Section** (complete end-to-end implementation)

**Purpose:** Safe restore point with complete secondary article section feature

---

## 🆕 Current Session (2025-10-15): Secondary Articles Feature Implementation

### Major Features Implemented ✅

#### 1. **Secondary Articles Database Schema**
- Created `secondary_articles` table mirroring primary `articles` structure
- Schema includes: headline, content, rank, is_active, fact_check_score, campaign_id, post_id
- Foreign key relationships to campaigns and RSS posts
- Supports same features as primary articles (toggle, skip, reorder)

#### 2. **RSS Feed Selection System**
- Added `use_for_primary_section` boolean to `rss_feeds` table
- Added `use_for_secondary_section` boolean to `rss_feeds` table
- UI checkboxes in Settings > RSS Feeds for section assignment
- Feeds can be assigned to primary, secondary, or both sections

#### 3. **AI Prompts for Secondary Section**
- Created 7 new AI prompt settings for secondary articles:
  - `ai_prompt_secondary_content_evaluator`
  - `ai_prompt_secondary_criteria_1_evaluator`
  - `ai_prompt_secondary_criteria_2_evaluator`
  - `ai_prompt_secondary_criteria_3_evaluator`
  - `ai_prompt_secondary_criteria_4_evaluator`
  - `ai_prompt_secondary_criteria_5_evaluator`
  - `ai_prompt_secondary_newsletter_writer`
- All prompts configurable via Settings > AI Prompts page
- Separate evaluation criteria from primary section

#### 4. **API Endpoints for Secondary Articles**
- `POST /api/secondary-articles/[id]/toggle` - Toggle article active state
- `POST /api/secondary-articles/[id]/skip` - Skip article
- `POST /api/campaigns/[id]/secondary-articles/reorder` - Reorder articles
- Complete audit logging via `user_activities` table

#### 5. **RSS Processor Integration**
- Added `processSecondaryArticles()` method to RSS processor
- Parallel processing after primary articles complete
- Separate AI evaluation using secondary prompts
- Automatic article generation and top N selection
- Configurable max articles via `max_secondary_articles` setting (default: 3)

#### 6. **Campaign Detail Page UI**
- Added Secondary Articles section with expand/collapse
- Drag-and-drop reordering using @dnd-kit
- Toggle and skip functionality
- Article count display (selected vs total)
- Reuses existing `SortableArticle` component for consistency
- State management with `maxSecondaryArticles` setting

#### 7. **Newsletter Preview Integration**
- Added `secondary_articles` query to preview route
- Created `generateSecondaryArticlesSection()` function
- Section title: "More Local News"
- Matches primary article layout for consistency
- URL tracking for click analytics
- Facebook image URL filtering

---

## 📊 Database Schema Updates

### New Tables
```sql
-- Secondary Articles table
CREATE TABLE secondary_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES rss_posts(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  headline TEXT NOT NULL,
  content TEXT NOT NULL,
  rank INTEGER,
  is_active BOOLEAN DEFAULT false,
  skipped BOOLEAN DEFAULT false,
  fact_check_score NUMERIC,
  word_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Modified Tables
```sql
-- RSS Feeds - Added section assignment columns
ALTER TABLE rss_feeds
ADD COLUMN use_for_primary_section BOOLEAN DEFAULT false,
ADD COLUMN use_for_secondary_section BOOLEAN DEFAULT false;

-- App Settings - Added custom_default column for AI prompts
ALTER TABLE app_settings
ADD COLUMN custom_default TEXT;
```

### Newsletter Sections
```sql
-- Rename existing "Bottom Articles" to "Secondary Articles"
UPDATE newsletter_sections
SET name = 'Secondary Articles',
    description = 'Additional local news articles from secondary RSS feeds'
WHERE name = 'Bottom Articles';
```

---

## 🛠️ Technical Implementation Details

### Files Modified This Session

#### RSS Processing
- `src/lib/rss-processor.ts` - Added secondary article processing methods

#### AI Prompts
- `src/lib/openai.ts` - Added 7 secondary prompt functions with database fallbacks

#### API Routes
- `src/app/api/secondary-articles/[id]/toggle/route.ts` - Toggle endpoint
- `src/app/api/secondary-articles/[id]/skip/route.ts` - Skip endpoint
- `src/app/api/campaigns/[id]/secondary-articles/reorder/route.ts` - Reorder endpoint

#### UI Components
- `src/app/dashboard/[slug]/campaigns/[id]/page.tsx` - Secondary articles UI section
- Renamed variables: `maxTopArticles` → `maxPrimaryArticles`, `maxBottomArticles` → `maxSecondaryArticles`

#### Newsletter Templates
- `src/lib/newsletter-templates.ts` - Added `generateSecondaryArticlesSection()`
- `src/app/api/campaigns/[id]/preview/route.ts` - Integrated secondary articles query and generation

---

## ⚙️ Configuration Settings

### RSS Feed Settings
Navigate to **Settings > RSS Feeds**:
- Check "Use for Primary Section" to include feed in main articles
- Check "Use for Secondary Section" to include feed in secondary articles
- Feeds can be assigned to both sections simultaneously

### AI Prompt Settings
Navigate to **Settings > AI Prompts**:
- Configure evaluation criteria for secondary articles
- Customize newsletter writer prompt for secondary section
- Test prompts with "Test Prompt" button
- Save custom defaults with "Save as Default"

### Article Limits
Navigate to **Settings > General**:
- `max_primary_articles` - Maximum primary articles (default: 5)
- `max_secondary_articles` - Maximum secondary articles (default: 3)

---

## 🔄 RSS Processing Workflow

### Complete Flow
1. **RSS Feed Collection** - Fetch posts from all active feeds
2. **Primary Article Processing**:
   - Filter feeds with `use_for_primary_section = true`
   - Evaluate posts with primary AI prompts
   - Generate newsletter articles
   - Select top N primary articles
3. **Secondary Article Processing**:
   - Filter feeds with `use_for_secondary_section = true`
   - Evaluate posts with secondary AI prompts
   - Generate newsletter articles
   - Select top N secondary articles
4. **Newsletter Generation** - Combine all sections in configured order

---

## 📝 Newsletter Section Order

Current configured sections (via `newsletter_sections` table):
1. Welcome/Overview
2. Community Business Spotlight (Advertisement)
3. Breaking News
4. AI Applications (3-5 apps with use cases)
5. Beyond the Feed
6. Secondary Articles ("More Local News")
7. AI Prompt Ideas

---

## ⚠️ CRITICAL DEVELOPMENT RULES

### Confidence and Clarification Policy
**When uncertain or confidence is below 80%, always ask the user for clarification:**
- ❌ **NEVER** proceed with assumptions when uncertain about requirements
- ✅ **ALWAYS** ask for clarification, guidance, or more context when confidence is below 80%
- ✅ **PREFER** multiple choice format when asking for clarification

### Date/Time Handling Policy
**ALL date and time operations MUST use local (non-UTC) comparisons:**
- ❌ **NEVER** use `.toISOString()`, `.toUTCString()`, or UTC-based Date methods for date comparisons
- ✅ **ALWAYS** extract date strings directly (e.g., `date.split('T')[0]`)
- ✅ Use local time for filtering, sorting, and displaying dates

---

## 🔍 Key Technical Concepts

### Multi-Section Architecture
- Database-driven section ordering via `newsletter_sections` table
- Each section can be independently activated/deactivated
- Sections rendered in `display_order` sequence

### AI-Powered Content Evaluation
- Separate evaluation criteria for primary and secondary sections
- Database-first prompt loading with code fallbacks
- Batch processing for API rate limiting

### Article Management
- Drag-and-drop reordering with rank persistence
- Toggle active/inactive state
- Skip functionality with audit trail
- Real-time UI updates without page refresh

### Newsletter Generation
- Preview route: Real-time HTML generation for testing
- Final route: MailerLite campaign creation with tracking URLs
- Section-based composition with conditional rendering

---

## 📚 Reference Documentation

### Database Tables (Core)
- `newsletters` - Newsletter registry (AI Accounting Daily, etc.)
- `newsletter_campaigns` - Individual campaign instances
- `rss_feeds` - RSS feed sources with section assignments
- `rss_posts` - Fetched RSS posts
- `articles` - Primary generated articles
- `secondary_articles` - Secondary generated articles
- `newsletter_sections` - Section configuration and ordering
- `app_settings` - Global system settings

### API Endpoints (Key)
- `/api/campaigns/[id]/preview` - Newsletter preview generation
- `/api/campaigns/[id]/rss-processing` - Trigger RSS processing
- `/api/settings/ai-prompts` - AI prompt management
- `/api/settings/rss-feeds` - RSS feed configuration

---

## 🚀 Next Steps / Future Enhancements

- [ ] Complete end-to-end testing of secondary article workflow
- [ ] Monitor RSS processing performance with both sections
- [ ] Gather feedback on secondary article selection criteria
- [ ] Consider additional section types (e.g., industry trends, case studies)

---

## 💡 Development Tips

### Testing Secondary Articles
1. Configure RSS feeds with `use_for_secondary_section = true`
2. Run RSS processing via campaign detail page
3. Verify secondary articles appear in campaign UI
4. Test toggle, skip, and reorder functionality
5. Check newsletter preview for "More Local News" section

### Debugging RSS Processing
- Check console logs for "STARTING SECONDARY ARTICLE PROCESSING"
- Verify feed selection: `Found X feeds configured for secondary section`
- Monitor article generation: `Activated top X secondary articles`
- Use debug endpoints: `/api/debug/campaign-articles?campaign_id=X`

### AI Prompt Development
- Use "Test Prompt" button for rapid iteration
- Save working prompts as custom defaults
- Reset to original defaults if needed
- Test with realistic accounting industry content

---

**Document Maintenance:**
- Update this file with each major feature addition
- Keep save points for critical functionality milestones
- Document all database schema changes
- Track API endpoint additions/modifications

---

*Last updated by Claude Code during secondary articles feature implementation*
