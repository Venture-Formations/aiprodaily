# AI Applications Database - Implementation Guide

_Last updated: 2025-11-28_
_Status: Implementation Complete ✅_

> **Note:** This document describes the completed AI Apps implementation. For current usage, see the AI Apps section in [claude.md](../../claude.md) and the settings UI at `/dashboard/[slug]/settings` → AI Apps tab.

## Summary of Features

1. ✅ **Database Schema** - `ai_applications` table with categories and tool types
2. ✅ **Categories** - Payroll, HR, Accounting System, Finance, Productivity, Client Management, Banking
3. ✅ **CSV Upload** - Bulk import with "Home Page" → `app_url` mapping
4. ✅ **App Selection** - Automatic selection on issue creation with category rotation
5. ✅ **Settings API** - API endpoint for managing category counts
6. ✅ **Affiliate Support** - 3x priority weighting and cooldown periods

---

## How To Use

### Adding Apps via CSV

1. Go to **Databases → AI Applications**
2. Click "📤 Upload CSV" button
3. CSV format:
   ```
   Tool Name,Category,Tool Type,Home Page,Description,Tagline,Affiliate
   QuickBooks AI,Accounting System,Firm,https://quickbooks.com,AI-powered accounting assistant,Automate your bookkeeping,yes
   ```

**Column Mappings:**
- `Tool Name` → app_name
- `Category` → category (must match predefined list)
- `Tool Type` → tool_type (Client or Firm)
- `Home Page` → app_url
- `Description` → description
- `Tagline` → tagline (optional)
- `Affiliate` → is_affiliate (yes/true = affiliate)

### Configuring Category Counts

1. Go to **Settings → AI Apps** tab
2. Set "Total Apps Per Newsletter" (default: 6)
3. Set counts for each category:
   - **Payroll:** 2 (required)
   - **Accounting System:** 2 (required)
   - **HR:** 1 (required)
   - **Banking:** 1 (required)
   - **Finance, Productivity, Client Management:** 0 (fillers)
4. Click "Save Settings"

### App Selection Logic

When a new issue is created:
1. System selects apps based on category counts
2. **Affiliate apps:** 3x selection priority + cooldown period (configurable)
3. **Non-affiliate apps:** Cycle through all in category before repeating
4. Fills remaining slots with filler categories
5. Updates `last_used_date` for tracking

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/app-selector.ts` | Core selection logic with rotation |
| `src/app/api/ai-apps/upload/route.ts` | CSV upload endpoint |
| `src/app/api/settings/ai-apps/route.ts` | Settings API |
| `src/app/dashboard/[slug]/databases/ai-apps/page.tsx` | Admin UI |
| `src/types/database.ts` | TypeScript types (AIApplication, AIAppCategory) |

## Database Tables

### `ai_applications`
- `id`, `app_name`, `category`, `tool_type`
- `app_url`, `description`, `tagline`
- `is_active`, `is_featured`, `is_affiliate`
- `last_used_date`, `times_used`
- `publication_id`

### `issue_ai_app_selections`
- `id`, `issue_id`, `app_id`
- `selection_order`, `selected_at`

### `publication_settings`
- `ai_apps_per_newsletter` (default: 6)
- `ai_apps_{category}_count` (per category)
- `affiliate_cooldown_days` (default: 7)

---

## Troubleshooting

**CSV Upload Errors:**
- Check column names match exactly (case-sensitive)
- Category must be one of: Payroll, HR, Accounting System, Finance, Productivity, Client Management, Banking
- Tool Type must be either "Client" or "Firm"

**No Apps Selected on Issue Creation:**
- Verify `publication_settings` table has ai_apps_* entries
- Check that apps have `is_active = true`
- Run: `SELECT * FROM publication_settings WHERE key LIKE 'ai_apps_%'`

**Apps Repeating Too Often:**
- For affiliates: Check `affiliate_cooldown_days` setting
- For non-affiliates: Verify all apps in category have been used (check `last_used_date`)
- Use `/api/debug/(ai)/ai-apps-status` to view current rotation state

---

**Original Implementation Date:** 2025-01-04
**Last Review:** 2025-11-28
