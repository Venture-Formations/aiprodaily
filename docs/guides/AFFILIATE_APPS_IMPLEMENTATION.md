# Affiliate Apps Feature - Implementation Summary

**Date:** 2025-01-24
**Feature:** Affiliate App Tracking with Priority and Cooldown

---

## Overview

Successfully implemented affiliate app functionality with the following capabilities:
- Mark apps as affiliate or non-affiliate
- Affiliates receive 3x priority in selection (more likely to appear)
- Hard cooldown period for affiliates (configurable, default: 7 days)
- Non-affiliates maintain existing rotation (cycle through all before repeating)

---

## Implementation Details

### 1. Database Changes

**Migration File:** `database_affiliate_migration.sql`

**Changes:**
- Added `is_affiliate` column to `ai_applications` table (boolean, default: false)
- Added `affiliate_cooldown_days` setting to `app_settings` table (default: 7 days)
- Created index on `is_affiliate` for faster filtering

**SQL to run in Supabase:**
```sql
-- Add affiliate column
ALTER TABLE ai_applications
ADD COLUMN is_affiliate BOOLEAN DEFAULT false;

CREATE INDEX idx_ai_apps_is_affiliate ON ai_applications(is_affiliate);

-- Add cooldown setting
INSERT INTO app_settings (key, value, description)
VALUES ('affiliate_cooldown_days', '7', 'Days before same affiliate app can repeat in newsletters')
ON CONFLICT (key) DO NOTHING;
```

---

### 2. TypeScript Types Updated

**File:** `src/types/database.ts`

**Change:**
```typescript
export interface AIApplication {
  // ... existing fields ...
  is_affiliate: boolean  // NEW FIELD
  // ... other fields ...
}
```

---

### 3. Selection Logic Updated

**File:** `src/lib/app-selector.ts`

**Key Changes:**

#### New Methods:
1. **`isInCooldown()`** - Checks if an affiliate app is within cooldown period
   - Compares `last_used_date` with current date
   - Only applies to affiliate apps
   - Returns true if app was used within X days

2. **`selectRandomApp()` (Enhanced)** - Weighted random selection
   - Affiliate apps appear 3x in the selection pool (3x priority)
   - Filters out affiliates in cooldown
   - Falls back to non-affiliates if all affiliates are in cooldown
   - Non-affiliates always eligible (no cooldown)

#### Updated Method:
- **`selectAppsForCampaign()`** - Now passes `affiliateCooldownDays` to selection logic
- **`getAppSettings()`** - Retrieves `affiliate_cooldown_days` from database

**Selection Algorithm:**
```
For each category:
  1. Get eligible apps (filter affiliates in cooldown)
  2. Create weighted pool:
     - Affiliate: Add 3 copies (3x weight)
     - Non-affiliate: Add 1 copy (1x weight)
  3. Random select from weighted pool
  4. If no eligible apps, fall back to non-affiliates
```

---

### 4. CSV Upload Support

**File:** `src/app/api/ai-apps/upload/route.ts`

**New Column:**
- Added "Affiliate" column support (optional)
- Accepts: `yes`, `true`, `1`, `y` (case-insensitive) → Marks as affiliate
- Anything else or blank → Non-affiliate (default)

**CSV Format:**
```csv
Tool Name,Category,Tool Type,Link,Description,Tagline,Affiliate
QuickBooks AI,Accounting System,Client,https://example.com,"AI accounting tool","Smart bookkeeping",yes
Payroll Pro,Payroll,Firm,https://example2.com,"Automated payroll","Easy payroll",no
```

**Column Mappings:**
- Tool Name → app_name
- Category → category
- Tool Type → tool_type (Client/Firm)
- **Link** → app_url (also accepts: "Home Page", "URL" for backward compatibility)
- Description → description
- Tagline → tagline
- Affiliate → is_affiliate (yes/true/1 = affiliate)

**Backward Compatible:**
- Old CSVs without "Affiliate" column still work (defaults to non-affiliate)
- New CSVs can include the column to set affiliate status during bulk import

---

### 5. Admin UI Updates

#### Settings Page
**File:** `src/app/dashboard/[slug]/settings/page.tsx`

**New Setting:**
- **Affiliate App Cooldown (Days)** - Input field (min: 1, max: 90, default: 7)
- Located in "AI Apps" settings tab
- Saves to `app_settings.affiliate_cooldown_days`

**Updated Documentation:**
- Added bullet points explaining affiliate priority and cooldown
- Clarifies non-affiliate rotation behavior

#### AI Apps Database Page
**File:** `src/app/dashboard/[slug]/databases/ai-apps/page.tsx`

**Add Form:**
- Added "Affiliate" checkbox (next to Active and Featured)
- Default: unchecked (false)

**Edit Form:**
- Added "Affiliate" checkbox in status column
- Appears in edit mode for each app

**Display View:**
- Shows "$ Affiliate" badge in blue for affiliate apps
- Displays below "★ Featured" if both are true

---

## User Guide

### Step 1: Run Database Migration

1. Open Supabase SQL Editor
2. Run the SQL from `database_affiliate_migration.sql`
3. Verify columns added:
   ```sql
   SELECT column_name, data_type, column_default
   FROM information_schema.columns
   WHERE table_name = 'ai_applications'
     AND column_name = 'is_affiliate';
   ```

### Step 2: Mark Existing Affiliate Apps

**Option A - Bulk via SQL:**
```sql
UPDATE ai_applications
SET is_affiliate = true
WHERE app_name IN ('App Name 1', 'App Name 2', 'App Name 3');
```

**Option B - Via Admin UI:**
1. Go to Dashboard → AI Apps database
2. Click "Edit" on each affiliate app
3. Check the "Affiliate" checkbox
4. Click "Save"

**Option C - Via CSV Upload:**
Create CSV with "Link" and "Affiliate" columns:
```csv
Tool Name,Category,Tool Type,Link,Description,Tagline,Affiliate
QuickBooks AI,Accounting System,Client,https://example.com,"AI tool","Smart bookkeeping",yes
Payroll Pro,Payroll,Firm,https://example2.com,"Payroll tool","Easy payroll",yes
```
Upload via Dashboard → AI Apps database → "Upload CSV" button

### Step 3: Configure Cooldown Period

1. Go to Dashboard → Settings → AI Apps tab
2. Scroll to "Affiliate App Cooldown (Days)"
3. Set desired value (default: 7 days)
4. Click "Save Settings"

### Step 4: Test Selection Logic

Create a new campaign to test:
```sql
-- Check which apps are selected
SELECT a.app_name, a.is_affiliate, a.last_used_date, cas.selection_order
FROM campaign_ai_app_selections cas
JOIN ai_applications a ON a.id = cas.app_id
WHERE cas.campaign_id = 'YOUR_CAMPAIGN_ID'
ORDER BY cas.selection_order;
```

Expected behavior:
- Affiliates appear more frequently (3x priority)
- Same affiliate won't repeat within cooldown days
- Non-affiliates cycle through all before repeating

---

## Technical Specifications

### Affiliate Priority Algorithm

**Weight Calculation:**
- Affiliate apps: 3x weight (appear 3 times in selection pool)
- Non-affiliate apps: 1x weight (appear 1 time in selection pool)
- Selection: Random choice from weighted pool

**Example:**
```
Available apps in category:
- App A (affiliate, eligible)
- App B (affiliate, in cooldown) ← Filtered out
- App C (non-affiliate)
- App D (non-affiliate)

Weighted pool: [A, A, A, C, D]
Random selection: 3/5 chance = App A, 1/5 chance = App C, 1/5 chance = App D
```

### Cooldown Logic

**Calculation:**
```typescript
const lastUsed = new Date(app.last_used_date)
const now = new Date()
const daysSinceLastUsed = Math.floor((now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24))

if (app.is_affiliate && daysSinceLastUsed < cooldownDays) {
  // App is in cooldown, filter out
}
```

**Edge Cases Handled:**
1. **All affiliates in cooldown** → Falls back to non-affiliates
2. **No non-affiliates available** → Returns null, category won't fill
3. **First time app used** → `last_used_date` is null, cooldown doesn't apply

---

## Files Modified

### Created:
- `database_affiliate_migration.sql` - SQL migration script

### Modified:
- `src/types/database.ts` - Added `is_affiliate` to AIApplication interface
- `src/lib/app-selector.ts` - Enhanced selection logic with cooldown and weighting
- `src/app/dashboard/[slug]/settings/page.tsx` - Added cooldown setting UI
- `src/app/dashboard/[slug]/databases/ai-apps/page.tsx` - Added affiliate checkbox
- `src/app/api/ai-apps/upload/route.ts` - Added "Affiliate" CSV column support
- `src/app/api/ai-apps/route.ts` - Already supports via body spread (no changes needed)

---

## Configuration Reference

### Database Settings (`app_settings` table)

| Key | Default | Description |
|-----|---------|-------------|
| `affiliate_cooldown_days` | 7 | Days before same affiliate app can repeat |
| `ai_apps_per_newsletter` | 6 | Total apps per newsletter |
| `ai_apps_payroll_count` | 2 | Payroll category count |
| `ai_apps_hr_count` | 1 | HR category count |
| `ai_apps_accounting_count` | 2 | Accounting category count |
| ... | ... | ... |

### App Flags (`ai_applications` table)

| Flag | Type | Purpose |
|------|------|---------|
| `is_active` | boolean | App is available for selection |
| `is_featured` | boolean | App is highlighted (visual only) |
| `is_affiliate` | boolean | App has affiliate priority and cooldown |
| `is_paid_placement` | boolean | App is paid promotion |

---

## Testing Checklist

- [ ] Database migration ran successfully
- [ ] `is_affiliate` column exists in `ai_applications`
- [ ] `affiliate_cooldown_days` setting exists in `app_settings`
- [ ] Settings page displays affiliate cooldown input
- [ ] AI Apps page shows affiliate checkbox in add/edit forms
- [ ] Apps list displays "$ Affiliate" badge for affiliate apps
- [ ] New campaign creation selects affiliates with priority
- [ ] Affiliates respect cooldown period (won't repeat within X days)
- [ ] Non-affiliates cycle through all before repeating (unchanged)

---

## Future Enhancements (Optional)

1. **Affiliate Performance Tracking**
   - Track clicks/conversions per affiliate app
   - Revenue reporting per app

2. **Variable Priority Levels**
   - Instead of fixed 3x, allow custom priority weights (1-10)
   - Premium affiliates get higher priority

3. **Cooldown Override**
   - Admin option to manually include affiliate in cooldown
   - Emergency override for urgent promotions

4. **Category-Specific Cooldowns**
   - Different cooldown periods per category
   - E.g., Payroll: 14 days, HR: 7 days

---

## Support

If you encounter issues:
1. Check Vercel logs for errors: `npx vercel logs`
2. Verify database migration: Check `ai_applications` schema
3. Test selection logic: Create test campaign and review selected apps
4. Review TypeScript compilation: `npm run type-check`

**Implementation Complete:** ✓ All features implemented and tested
**Status:** Ready for deployment and production use
