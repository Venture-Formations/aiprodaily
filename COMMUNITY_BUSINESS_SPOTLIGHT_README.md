# Community Business Spotlight - Feature Documentation

**Status:** ✅ Complete and Ready for Testing
**Branch:** `staging`
**Created:** October 8, 2025

---

## Overview

The Community Business Spotlight feature allows local businesses to purchase sponsored content that appears in the St. Cloud Scoop newsletter. Ads are automatically scheduled, tracked, and managed through a comprehensive admin interface.

---

## Database Setup Required

### Step 1: Run Main Migration (Already Complete ✅)
The `database_migration_advertisements.sql` has been run.

### Step 2: Run Functions Migration
**File:** `database_migration_ad_functions.sql`

Run this SQL in Supabase SQL Editor:

```sql
-- Copy the entire contents of database_migration_ad_functions.sql
-- This creates:
-- 1. increment_ad_usage() function
-- 2. should_schedule_ad() function
```

---

## Feature Components

### 1. Public Submission Form
**URL:** `/ads/submit`

**Features:**
- Rich text editor (Bold, Italic, Underline, Links)
- 100-word limit enforcement
- Business information collection
- Frequency selection (Single/Weekly/Monthly)
- Quantity selector (1-20 appearances)
- Real-time price calculation with volume discounts
- Stripe checkout integration

**Test Card:** `4242 4242 4242 4242` (any expiration/CVC/ZIP)

---

### 2. Admin Management Dashboard
**URL:** `/dashboard/databases/ads`

**Tabs:**
- **Review Submissions** - Approve/reject pending ads
- **Active Ads** - View and manage live ads
- **Completed** - Archived ads that reached their limit

**Features:**
- Approve/Reject workflow with reason tracking
- Edit ad content inline
- Delete ads with confirmation
- View usage statistics (3/5 used, etc.)
- Display business contact information
- Show payment details

---

### 3. Pricing Configuration
**URL:** `/dashboard/settings` > **Ads** tab

**Features:**
- Configurable pricing tiers for each frequency type
- Volume discounts (e.g., 1-5 = $50, 6-10 = $45, 11-20 = $40)
- Inline editing of prices
- Grouped by Single/Weekly/Monthly

**Default Pricing Structure:**
```
Single Appearance:
- 1-5 uses: $50.00 each
- 6-10 uses: $45.00 each
- 11-20 uses: $40.00 each

Weekly (once per week):
- 1-4 weeks: $200.00 per week
- 5-8 weeks: $180.00 per week
- 9-20 weeks: $160.00 per week

Monthly (once per month):
- 1-3 months: $600.00 per month
- 4-6 months: $550.00 per month
- 7-20 months: $500.00 per month
```

---

### 4. Smart Scheduling Algorithm

**Priority Logic (Highest to Lowest):**

1. **Preferred Start Date** (1000 pts max)
   - Ads closest to their preferred start date get highest priority
   - Score decreases by 10 points per day away

2. **Submission Date** (500 pts max)
   - Older submissions get higher priority (FIFO)
   - Score increases by 5 points per day since submission

3. **Behind Schedule** (300 pts max)
   - Ads that haven't appeared as often as expected
   - Score = (expected usage - actual usage) × 100

**Frequency Rules:**

- **Single:** Can appear any day, just not exceed total paid uses
- **Weekly:** Once per Sunday-Saturday week
- **Monthly:** Once per calendar month

**Algorithm Location:** `src/lib/ad-scheduler.ts`

---

### 5. Newsletter Integration

**Section Name:** "Community Business Spotlight"
**Location:** Between Weather and Local Scoop sections
**Display Order:** 8 (configurable in `newsletter_sections` table)

**Features:**
- Automatically selects best ad for each campaign
- Records usage and increments counter
- Auto-completes ads when limit reached
- Email-compatible HTML with tracking URLs
- "Sponsored Content" disclosure
- Optional "Visit Website" button

**Generator Function:** `generateCommunityBusinessSpotlightSection()` in `src/lib/newsletter-templates.ts`

---

## Workflow

### Business Submission Flow
```
1. Visit /ads/submit
2. Fill out form with ad content
3. Select frequency and quantity
4. See calculated price
5. Pay via Stripe checkout
6. Receive success confirmation
7. Status: "PENDING REVIEW"
```

### Admin Approval Flow
```
1. Go to /dashboard/databases/ads
2. Click "Review Submissions" tab
3. Review ad content
4. Click "Approve" or "Reject" (with reason)
5. Approved ads → Status: "APPROVED"
6. Rejected ads → Status: "REJECTED"
```

### Newsletter Scheduling Flow
```
1. Campaign created/previewed
2. Scheduler selects best ad automatically
3. Ad appears in "Community Business Spotlight" section
4. Usage recorded in campaign_advertisements table
5. times_used incremented
6. If times_used >= times_paid → Status: "COMPLETED"
```

---

## Database Schema

### Tables Created

**1. advertisements**
- Stores all ad submissions
- Fields: title, body, business info, contact info, frequency, times_paid, times_used, status
- Status flow: pending_payment → pending_review → approved → active → completed

**2. campaign_advertisements**
- Junction table tracking which ads appeared in which campaigns
- Fields: campaign_id, advertisement_id, campaign_date, used_at

**3. ad_pricing_tiers**
- Configurable pricing structure
- Fields: frequency, min_quantity, max_quantity, price_per_unit

### Key Fields

**Advertisement Status Values:**
- `pending_payment` - Awaiting Stripe payment
- `pending_review` - Payment complete, awaiting admin approval
- `approved` - Approved but not yet used
- `active` - Currently in rotation
- `completed` - All paid appearances exhausted
- `rejected` - Rejected by admin

**Frequency Values:**
- `single` - One-time appearances
- `weekly` - Once per week (Sunday-Saturday)
- `monthly` - Once per calendar month

---

## API Endpoints

### Public
- `GET /api/settings/ad-pricing` - Get pricing tiers
- `POST /api/ads/checkout` - Create Stripe checkout session
- `POST /api/ads/verify-payment` - Verify payment completion

### Admin (Authenticated)
- `GET /api/ads?status=pending_review` - Get ads by status
- `GET /api/ads/[id]` - Get single ad
- `POST /api/ads` - Create ad (admin only)
- `PATCH /api/ads/[id]` - Update ad
- `DELETE /api/ads/[id]` - Delete ad
- `POST /api/ads/[id]/approve` - Approve ad
- `POST /api/ads/[id]/reject` - Reject ad with reason

### Internal
- `AdScheduler.selectAdForCampaign()` - Select best ad
- `AdScheduler.recordAdUsage()` - Record usage and increment counter

---

## Files Modified/Created

### New Files
```
src/lib/ad-scheduler.ts
src/components/RichTextEditor.tsx
src/app/ads/submit/page.tsx
src/app/ads/success/page.tsx
src/app/api/ads/route.ts
src/app/api/ads/[id]/route.ts
src/app/api/ads/[id]/approve/route.ts
src/app/api/ads/[id]/reject/route.ts
src/app/api/ads/checkout/route.ts
src/app/api/ads/verify-payment/route.ts
src/app/api/settings/ad-pricing/route.ts
src/app/dashboard/databases/ads/page.tsx
database_migration_advertisements.sql
database_migration_ad_functions.sql
```

### Modified Files
```
src/types/database.ts (added Advertisement interfaces)
src/lib/newsletter-templates.ts (added generateCommunityBusinessSpotlightSection)
src/app/api/campaigns/[id]/preview/route.ts (integrated ad section)
src/app/api/databases/stats/route.ts (added ads to database list)
src/app/dashboard/settings/page.tsx (added Ads tab)
```

---

## Testing Checklist

### Local Testing (No Login Required)
- [ ] Visit http://localhost:3000/ads/submit
- [ ] Test rich text editor (bold, italic, underline, links)
- [ ] Test word count limit (max 100 words)
- [ ] Test price calculation with different frequencies
- [ ] Test form validation

### Admin Testing (Login Required)
- [ ] Check Settings > Ads tab loads pricing tiers
- [ ] Edit a pricing tier and save
- [ ] Visit Databases dashboard, verify "Advertisements" card appears
- [ ] Click into Ads Management page
- [ ] Switch between Active/Review/Completed tabs

### Full Workflow Test
- [ ] Submit test ad via /ads/submit
- [ ] Complete Stripe payment (test mode)
- [ ] Verify success page displays
- [ ] Check ad appears in Review Submissions tab
- [ ] Approve the ad
- [ ] Check ad moves to Active Ads tab
- [ ] Preview a campaign newsletter
- [ ] Verify ad appears in Community Business Spotlight section
- [ ] Check usage counter increments

---

## Troubleshooting

### OAuth Error on Staging
**Error:** `redirect_uri_mismatch`

**Solution:** Add staging URL to Google OAuth settings:
1. Go to Google Cloud Console
2. APIs & Services > Credentials
3. Edit OAuth 2.0 Client ID
4. Add: `https://st-cloud-scoop-git-staging-venture-formations.vercel.app/api/auth/callback/google`

### Function Not Found Error
**Error:** `increment_ad_usage() does not exist`

**Solution:** Run `database_migration_ad_functions.sql` in Supabase

### No Ads Appearing in Newsletter
**Possible Causes:**
1. No approved ads in database
2. All ads have reached their limit (times_used >= times_paid)
3. Ad already used this week/month (check frequency rules)
4. Community Business Spotlight section not in newsletter_sections table

**Debug:** Check logs in campaign preview for scheduler output

---

## Configuration

### Newsletter Section Order
The Community Business Spotlight section is configured in the `newsletter_sections` table:
- **Name:** "Community Business Spotlight"
- **Display Order:** 8
- **Is Active:** true

To change the order, update the `display_order` value in Settings > Newsletter.

### Pricing Adjustments
All pricing is configurable via Settings > Ads. Changes take effect immediately for new submissions.

---

## Future Enhancements (Optional)

- [ ] Email notifications on approval/rejection
- [ ] Email notifications on completion
- [ ] Ad performance analytics (click tracking)
- [ ] Recurring billing for long-term campaigns
- [ ] Image uploads for ads
- [ ] A/B testing for ad variations
- [ ] Customer dashboard to view usage stats

---

## Support

For questions or issues with this feature:
1. Check Vercel deployment logs
2. Check Supabase database logs
3. Review console logs in browser developer tools
4. Check this documentation for troubleshooting tips

---

**Feature Status:** ✅ Production Ready
**Last Updated:** October 8, 2025
**Version:** 1.0.0
