# Affiliate Apps Feature - Implementation Guide

_Last updated: 2025-11-28_
_Status: Implementation Complete ✅_

> **Note:** This document describes the completed affiliate app implementation. For current behavior, see `src/lib/app-selector.ts`.

---

## Overview

Affiliate app functionality with the following capabilities:
- Mark apps as affiliate or non-affiliate
- Affiliates receive 3x priority in selection (more likely to appear)
- Configurable cooldown period for affiliates (default: 7 days)
- Non-affiliates cycle through all before repeating (no cooldown)

---

## Current Behavior

### Affiliate Apps
1. **3x Selection Priority** - Appear 3 times in the weighted selection pool
2. **Cooldown Period** - Cannot be selected again within `affiliate_cooldown_days` (configurable in Settings → AI Apps)
3. **Tracked via** `last_used_date` column

### Non-Affiliate Apps
1. **Normal Priority** - Appear 1 time in the selection pool
2. **No Cooldown** - Can be selected again immediately
3. **Cycle Through All** - All non-affiliates in a category must be used before any repeats

---

## Database Schema

### `ai_applications` table
```sql
is_affiliate BOOLEAN DEFAULT false
```

### `publication_settings` table
```sql
-- Key: affiliate_cooldown_days
-- Default value: 7
```

---

## Selection Algorithm

**For each category:**
```
1. Get all active apps in category
2. Separate into affiliates and non-affiliates
3. Filter out affiliates in cooldown (last_used_date < cooldown days)
4. Get unused non-affiliates (not selected this cycle)
5. Create weighted pool:
   - Affiliate: Add 3 copies (3x weight)
   - Non-affiliate: Add 1 copy (1x weight)
6. Random select from weighted pool
7. If all affiliates in cooldown → select from non-affiliates only
```

**Example:**
```
Available apps in category:
- App A (affiliate, eligible) → [A, A, A]
- App B (affiliate, in cooldown) → filtered out
- App C (non-affiliate, unused) → [C]
- App D (non-affiliate, unused) → [D]

Weighted pool: [A, A, A, C, D]
Selection probability: App A = 60%, App C = 20%, App D = 20%
```

---

## Admin UI

### Settings Page (`/dashboard/[slug]/settings` → AI Apps tab)
- **Affiliate App Cooldown (Days)** - Input field (min: 1, max: 90, default: 7)
- Saves to `publication_settings.affiliate_cooldown_days`

### AI Apps Database Page
- **Add Form:** "Affiliate" checkbox
- **Edit Form:** "Affiliate" checkbox in status column
- **Display:** "$ Affiliate" badge in blue for affiliate apps

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/app-selector.ts` | Selection logic with cooldown and weighting |
| `src/app/dashboard/[slug]/settings/page.tsx` | Cooldown setting UI |
| `src/app/dashboard/[slug]/databases/ai-apps/page.tsx` | Affiliate checkbox |
| `src/app/api/ai-apps/upload/route.ts` | CSV "Affiliate" column support |

---

## CSV Upload Support

**Column:** `Affiliate` (optional)
- Accepts: `yes`, `true`, `1`, `y` (case-insensitive) → marks as affiliate
- Anything else or blank → non-affiliate (default)

**CSV Format:**
```csv
Tool Name,Category,Tool Type,Link,Description,Tagline,Affiliate
QuickBooks AI,Accounting System,Client,https://example.com,"AI tool","Smart bookkeeping",yes
Payroll Pro,Payroll,Firm,https://example2.com,"Payroll tool","Easy payroll",no
```

---

## Configuration Reference

### `publication_settings` keys

| Key | Default | Description |
|-----|---------|-------------|
| `affiliate_cooldown_days` | 7 | Days before same affiliate app can repeat |
| `ai_apps_per_newsletter` | 6 | Total apps per newsletter |

### `ai_applications` flags

| Flag | Type | Purpose |
|------|------|---------|
| `is_active` | boolean | App is available for selection |
| `is_featured` | boolean | App is highlighted (visual only) |
| `is_affiliate` | boolean | App has affiliate priority and cooldown |

---

## Debug Endpoint

**`/api/debug/(ai)/ai-apps-status`**

Returns current rotation state including:
- Recent selections per issue
- Apps in cooldown
- Non-affiliate cycling status
- Next eligible apps per category

---

**Original Implementation Date:** 2025-01-24
**Last Review:** 2025-11-28
