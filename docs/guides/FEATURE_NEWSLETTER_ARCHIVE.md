# Feature: Newsletter Archive System

## What This Feature Does
Automatically archives sent newsletters in a database and displays them on a public-facing website, allowing readers to browse and view past newsletter editions with all original content (articles, events, road work updates, etc.) preserved.

## How It Works
When a newsletter campaign is sent to subscribers via MailerLite, the system automatically:
1. Captures all campaign content (articles, events, road work, AI apps, polls) from the database
2. Stores everything in a structured archive with metadata
3. Makes the archived newsletter available at a public URL: `/newsletter/[YYYY-MM-DD]`
4. Displays the archive in a clean, web-optimized layout (not the email HTML)

Users can then browse all past newsletters at `/newsletter` and click into any edition to read the full content.

## Files Changed/Added

### Core Library
- `src/lib/newsletter-archiver.ts` - Main archiving logic and data fetching

### Public Pages
- `src/app/newsletter/page.tsx` - Archive list page (shows all past newsletters)
- `src/app/newsletter/[date]/page.tsx` - Individual newsletter viewer (shows full content)

### API Integration
- `src/app/api/campaigns/[id]/send-final/route.ts` - Triggers archiving when newsletter is sent

### Type Definitions
- `src/types/database.ts` - Added `ArchivedNewsletter` interface

## Key Functions/Components

### NewsletterArchiver Class
**Located in:** `src/lib/newsletter-archiver.ts`

**Main Methods:**

**`archiveNewsletter(params)`**
- **What it does:** Creates a complete archive record when a newsletter is sent
- **Data captured:**
  - Articles (headline, content, word count, source info, images)
  - Events (titles, dates, venues, AI summaries, featured status)
  - Road Work (all 9 items with dates and locations)
  - AI Apps (if included in campaign)
  - Poll Questions (if included)
  - Metadata (counts, timestamps, feature flags)
- **Called by:** `/api/campaigns/[id]/send-final` route during send process
- **Returns:** `{ success: boolean, error?: string }`

**`getArchivedNewsletter(date)`**
- **What it does:** Retrieves a specific archived newsletter by date (YYYY-MM-DD)
- **Used by:** Individual newsletter page at `/newsletter/[date]`
- **Returns:** `ArchivedNewsletter | null`

**`getArchiveList(limit)`**
- **What it does:** Gets list of all archived newsletters, sorted newest first
- **Used by:** Archive list page at `/newsletter`
- **Default limit:** 50 newsletters
- **Returns:** Array of newsletter summaries (id, date, subject, send date, metadata)

**`updateArchive(campaignId, updates)`**
- **What it does:** Updates an existing archive (useful for adding analytics data later)
- **Example use:** Adding open rates, click rates after newsletter is sent
- **Returns:** `{ success: boolean, error?: string }`

### Archive List Page Component
**Located in:** `src/app/newsletter/page.tsx`

- **What it does:** Displays all past newsletters in a clean, browsable list
- **Shows:** Subject line, send date, content stats (article count, event count, features)
- **Features:** Empty state when no newsletters archived yet, subscribe CTA at bottom

### Individual Newsletter Page Component
**Located in:** `src/app/newsletter/[date]/page.tsx`

- **What it does:** Renders full newsletter content in web-optimized format
- **Sections rendered:**
  - Top Stories (all articles with headlines, content, source links)
  - Local Events (grid layout with featured badges)
  - Road Work & Closures (3-column grid)
- **SEO:** Dynamic metadata with OpenGraph tags for social sharing
- **Navigation:** Back to archive link, subscription CTA

## Database Schema

### archived_newsletters Table
```sql
CREATE TABLE archived_newsletters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT UNIQUE NOT NULL,
  campaign_date TEXT NOT NULL,  -- YYYY-MM-DD format for URL routing
  subject_line TEXT NOT NULL,
  send_date TIMESTAMPTZ NOT NULL,
  recipient_count INTEGER DEFAULT 0,
  html_backup TEXT,  -- Optional HTML email backup
  metadata JSONB,  -- Campaign metadata (counts, flags, timestamps)
  articles JSONB,  -- Array of article objects with full content
  events JSONB,  -- Array of event objects
  sections JSONB,  -- Additional sections (road_work, ai_apps, polls)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Metadata Structure
```json
{
  "total_articles": 5,
  "total_events": 12,
  "has_road_work": true,
  "has_ai_apps": false,
  "has_poll": false,
  "archived_at": "2025-10-20T15:30:00Z"
}
```

## How to Test

### Manual Testing Steps:

1. **Create and Send a Newsletter**
   - Go to dashboard and create a campaign
   - Add articles and events
   - Send the final newsletter via "Send to Main List" button

2. **Verify Archive Created**
   - Check database: `SELECT * FROM archived_newsletters ORDER BY created_at DESC LIMIT 1;`
   - Should see new record with campaign data

3. **Test Public Archive Pages**
   - Visit `/newsletter` - should see your sent newsletter in the list
   - Click on the newsletter - should open `/newsletter/[date]` with full content
   - Verify all sections render correctly (articles, events, road work)

4. **Test Empty State**
   - On a fresh database, visit `/newsletter`
   - Should see "No Newsletters Archived Yet" message

### Automated Testing:
```typescript
// Example test for archiveNewsletter
const result = await newsletterArchiver.archiveNewsletter({
  campaignId: 'test-campaign-123',
  campaignDate: '2025-10-20',
  subjectLine: 'Test Newsletter',
  recipientCount: 1000,
  htmlContent: '<html>...</html>'
});

expect(result.success).toBe(true);

// Verify retrieval
const archived = await newsletterArchiver.getArchivedNewsletter('2025-10-20');
expect(archived).toBeTruthy();
expect(archived.subject_line).toBe('Test Newsletter');
```

## Public URLs

- **Archive List:** `https://yourdomain.com/newsletter`
- **Specific Newsletter:** `https://yourdomain.com/newsletter/2025-10-20`

## Dependencies

**Existing:**
- `@/lib/supabase` - Database connection via supabaseAdmin
- `@/types/database` - TypeScript interfaces
- Next.js App Router - For routing and server components

**New:**
- None - uses existing dependencies

## Notes & TODOs

### Current Limitations:
- Recipient count is set to 0 initially (could be updated with MailerLite webhook data)
- HTML backup is optional and not currently used (could add email HTML for reference)
- Archive updates (analytics integration) not yet implemented

### Future Improvements:
- **Analytics Integration:** Add webhook to capture open rates, click rates from MailerLite
- **Search Functionality:** Add search bar to find newsletters by keyword or date
- **RSS Feed:** Generate RSS feed from archived newsletters
- **Social Sharing:** Add social share buttons to individual newsletter pages
- **Download Options:** Allow downloading newsletter as PDF
- **Archive Pagination:** Add pagination when archive list exceeds 50 newsletters

### Important Notes:
- Archiving happens **during** the send process but is non-blocking (errors don't stop the send)
- All data is fetched fresh from database (not from email HTML) to ensure accuracy
- Public pages use Server Components for optimal SEO and performance
- Date format must be YYYY-MM-DD for URL routing to work correctly
- Featured events preserve their featured status from the original campaign

### Known Issues:
- None currently reported

### Related Features:
- Campaign Send Final (triggers archiving)
- Event Management (events displayed in archive)
- Road Work Generation (road work displayed in archive)
- Article Management (articles displayed in archive)
