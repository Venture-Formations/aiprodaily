# Secondary Articles Implementation Guide

_Last updated: 2025-11-28_
_Status: Implementation Complete ✅_

## Overview
This guide documents the implementation of a secondary article section (bottom article section) for the newsletter system. This section mirrors the primary (top) article section but can use different RSS feeds and have customizable AI evaluation criteria.

## Features Implemented

### 1. RSS Feed Section Assignment
- **Location**: Settings > RSS Feeds tab
- **Functionality**: Each RSS feed can now be assigned to:
  - Primary Section (Top Articles) - max 5 articles
  - Secondary Section (Bottom Articles) - max 3 articles (expandable to 5)
  - Both sections
  - Neither section
- **UI Changes**:
  - New "Sections" column in RSS feeds table
  - Checkboxes for section assignment in add/edit forms
  - Color-coded section indicators (blue=Primary, purple=Secondary)

### 2. Database Schema
- **New Tables**:
  - `secondary_articles` - Stores secondary section articles (mirrors `articles` table structure)
  - `archived_secondary_articles` - Stores archived secondary articles

- **Modified Tables**:
  - `rss_feeds` - Added columns:
    - `use_for_primary_section` (BOOLEAN, default true)
    - `use_for_secondary_section` (BOOLEAN, default false)

### 3. TypeScript Types
- **New Interfaces** (src/types/database.ts):
  - `SecondaryArticle` - Secondary article structure
  - `ArchivedSecondaryArticle` - Archived secondary article structure
  - `SecondaryArticleWithPost` - Combined type with RSS post data

- **Modified Interfaces**:
  - `RssFeed` - Added section assignment fields
  - `CampaignWithArticles` - Added `secondary_articles` array

### 4. AI Prompts System
- **Separate AI Prompts** for secondary articles:
  - `ai_prompt_secondary_content_evaluator`
  - `ai_prompt_secondary_newsletter_writer`
  - `ai_prompt_secondary_criteria_1` through `ai_prompt_secondary_criteria_5`

- **Initial Values**: Copied from primary section prompts (customizable via Settings UI later)

## Setup Instructions

### Step 1: Database Migration
Run the following SQL in Supabase SQL Editor:

```sql
-- See: database_migration_secondary_articles.sql
```

Or use the debug endpoint:
```
GET /api/debug/setup-secondary-articles
```

### Step 2: Initialize AI Prompts
Use the debug endpoint to copy primary prompts to secondary:
```
GET /api/debug/setup-secondary-ai-prompts
```

### Step 3: Configure RSS Feeds
1. Go to Settings > RSS Feeds
2. Edit each feed to assign sections:
   - Check "Primary Section" for top articles
   - Check "Secondary Section" for bottom articles
3. Save changes

## Configuration

### Article Limits
- **Primary Section**: Max 5 articles (current setting)
- **Secondary Section**: Max 3 articles (configurable via max_articles setting)
- **Expandable**: Both can be increased to 5 via settings

### RSS Feed Selection
- Feeds can be assigned to both sections simultaneously
- If no feeds assigned to secondary, section won't generate articles
- Active status must be true for feeds to be processed

## Next Implementation Steps

The following components still need to be built:

### 5. API Endpoints (Pending)
- `POST /api/secondary-articles/generate` - Generate secondary articles from RSS
- `PATCH /api/secondary-articles/[id]` - Update secondary article
- `DELETE /api/secondary-articles/[id]` - Delete secondary article
- `POST /api/secondary-articles/[id]/skip` - Skip secondary article
- `POST /api/secondary-articles/reorder` - Reorder secondary articles

### 6. RSS Processor Integration (Pending)
- Modify RSS processor to handle secondary section feeds
- Generate articles for both sections in parallel
- Apply secondary-specific AI prompts
- Respect max article limits per section

### 7. Campaign Detail UI (Pending)
- Add "Secondary Articles" section to campaign detail page
- Mirror primary section UI (skip, reorder, activate)
- Independent article management
- Show section assignment badges

### 8. Newsletter Preview Integration (Pending)
- Add secondary articles section to newsletter HTML generation
- Position after primary articles section
- Apply consistent styling
- Include in newsletter preview API

### 9. Testing (Pending)
- End-to-end RSS processing with both sections
- Article generation with different RSS feeds per section
- Skip/reorder functionality for secondary articles
- Newsletter preview with both sections
- Subject line generation (should only use primary section)

## Files Modified

### Database & Types
- `database_migration_secondary_articles.sql` - Database schema
- `src/types/database.ts` - TypeScript interfaces
- `src/app/api/debug/setup-secondary-articles/route.ts` - Schema setup endpoint
- `src/app/api/debug/setup-secondary-ai-prompts/route.ts` - AI prompts setup

### Settings UI
- `src/app/dashboard/[slug]/settings/page.tsx` - RSS feed section assignments

### API Endpoints
- `src/app/api/rss-feeds/[id]/route.ts` - Added section assignment fields

## Technical Notes

### Design Decisions
1. **Separate Tables**: Using `secondary_articles` instead of adding a `section` field to `articles` table
   - Cleaner separation of concerns
   - Easier to query and manage independently
   - Prevents accidental mixing of sections

2. **Separate AI Prompts**: Each section has its own prompts
   - Allows different evaluation criteria
   - More flexible for future customization
   - Initially copied from primary (user can customize later)

3. **RSS Feed Checkboxes**: Global settings approach
   - Consistent across all campaigns
   - Easy to manage from one location
   - Clear visual indication of feed usage

### Performance Considerations
- RSS processing will need to query feeds twice (once per section)
- Consider caching RSS feed data to avoid duplicate downloads
- Database indexes added for campaign_id and post_id lookups

### Future Enhancements
- Allow per-campaign RSS feed overrides
- Different max article limits per section
- Section-specific subject line generation option
- Analytics per section (click rates, engagement)

## Testing Checklist

- [ ] Database migration runs without errors
- [ ] AI prompts initialized successfully
- [ ] RSS feeds show section checkboxes
- [ ] Section assignments save correctly
- [ ] Secondary articles generate from correct feeds
- [ ] Primary and secondary sections independent
- [ ] Skip/reorder works for both sections
- [ ] Newsletter preview shows both sections
- [ ] Subject line only uses primary section
- [ ] Campaign deletion removes both sections

## Support & Troubleshooting

### Common Issues

**RSS feeds not showing section checkboxes:**
- Run database migration: `/api/debug/setup-secondary-articles`
- Check rss_feeds table has new columns

**AI prompts not working:**
- Run prompt setup: `/api/debug/setup-secondary-ai-prompts`
- Verify app_settings table has secondary prompt keys

**Secondary articles not generating:**
- Check RSS feeds have `use_for_secondary_section = true`
- Verify feeds are active
- Check RSS processor integration is complete

## Maintenance

### Updating AI Prompts
1. Go to Settings > AI Prompts
2. Find secondary section prompts (prefixed with "Secondary Article")
3. Edit as needed
4. Save changes

### Changing Article Limits
1. Update max_articles setting in app_settings
2. Value applies to secondary section
3. Primary section uses existing max_active_articles setting

## Version History
- **v1.0** (2025-10-15): Initial implementation
  - RSS feed section assignments
  - Database schema
  - TypeScript types
  - AI prompts structure
  - Setup endpoints

---

*Document last updated: 2025-11-28*
