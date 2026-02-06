# SparkLoop Tracking System Summary

## Overview

Custom SparkLoop Upscribe implementation with comprehensive tracking, scoring, and analytics.

---

## Key Components

### 1. Database Tables

| Table | Purpose |
|-------|---------|
| `sparkloop_recommendations` | Stores all SparkLoop recommendations with our metrics |
| `sparkloop_events` | Tracks all popup and sync events for analytics |

### 2. Key Metrics Tracked

| Metric | Source | Description |
|--------|--------|-------------|
| `impressions` | Our tracking | Times shown in popup |
| `submissions` | Our tracking | Times submitted to SparkLoop |
| `sparkloop_confirmed` | SparkLoop API | Confirmed referrals |
| `sparkloop_pending` | SparkLoop API | Pending referrals |
| `sparkloop_rejected` | SparkLoop API | Rejected referrals |
| `sparkloop_earnings` | SparkLoop API | Total earnings (cents) |

### 3. Calculated Metrics

| Metric | Formula | Threshold |
|--------|---------|-----------|
| `our_cr` (Conversion Rate) | submissions / impressions | Needs 20+ impressions |
| `our_rcr` (Referral Confirmation Rate) | confirms / (confirms + rejections) | Needs 20+ outcomes |
| `calculated_score` | CR × CPA × RCR | Expected revenue per impression |

---

## Scoring System

### Formula: CR × CPA × RCR

- **CR (Conversion Rate)**: % of impressions that become submissions
  - Uses our data if 20+ impressions, otherwise 10% default

- **CPA (Cost Per Acquisition)**: Payout per confirmed referral
  - Stored in cents, converted to dollars for scoring

- **RCR (Referral Confirmation Rate)**: % of referrals that get confirmed
  - Priority: Our data (20+ outcomes) → SparkLoop's 30-day rate → 25% default

### Score Interpretation
Higher score = better expected revenue per impression. Top-scoring recommendations are shown first in the popup.

---

## Data Flow

### Popup Flow
```
User submits email → Modal opens → Fetch recommendations
    → Sort by score → Show top 5 → User selects
    → Submit to SparkLoop → Update MailerLite field → Redirect
```

### Tracking Events (stored in `sparkloop_events`)

| Event Type | When | Data |
|------------|------|------|
| `popup_opened` | Modal appears | email, recommendation_count |
| `popup_skipped` | User skips | email |
| `subscriptions_success` | User subscribes | email, refCodes, selectedCount |
| `recommendations_not_selected` | At submit | refCodes not selected |
| `sync_confirm_delta` | Cron sync | delta, previous, current, ref_code |
| `sync_rejection_delta` | Cron sync | delta, previous, current, ref_code |

---

## Cron Jobs

### `/api/cron/sync-sparkloop` (Every 15 minutes)
- Syncs all recommendations from SparkLoop API
- Updates budget info and screening periods
- Auto-excludes recommendations when `remaining_budget < 5 × CPA`
- Auto-reactivates when budget is restored
- **Tracks deltas**: Logs confirm/rejection changes for timeframe-based RCR

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sparkloop/recommendations` | GET | Fetch recommendations for popup |
| `/api/sparkloop/subscribe` | POST | Subscribe user to selected newsletters |
| `/api/sparkloop/track` | POST | Log popup events |
| `/api/sparkloop/admin` | GET/PATCH/POST | Admin management |
| `/api/sparkloop/sync` | POST | Manual sync trigger |
| `/api/sparkloop/stats` | GET | Chart data and statistics |

---

## Dashboard Features

### Location: `/dashboard/[slug]/sparkloop`

### Summary Cards
- **Pending Referrals**: Total awaiting confirmation
- **Confirmed Referrals**: Total confirmed
- **Total Earnings**: Actual earnings from SparkLoop
- **Projected (Pending)**: Estimated earnings from pending (avg CPA × 25% RCR)

### Chart
- Bar chart showing daily pending/confirmed referrals
- Timeframe selector: 7, 30, 90 days
- Tooltip: date, pending, confirmed, projected earnings

### Top Earners
- Top 9 recommendations by total earnings
- Shows logo, name, referral count, earnings

### Recommendations Table
- Newsletter name, logo, ref_code
- CPA, Screening Period, RCR, CR, Score
- Our stats (impressions, submissions, confirmed, pending)
- Status (Active/Paused/Excluded)
- Bulk actions (exclude/reactivate)

---

## Auto-Exclusion Rules

1. **Budget Used Up**: When `remaining_budget < 5 × CPA`
   - Auto-excluded with reason `budget_used_up`
   - Auto-reactivated when budget restored

2. **Manual Exclusion**: Via dashboard with custom reason

---

## MailerLite Integration

When user subscribes through popup:
1. SparkLoop API called with selections
2. MailerLite `sparkloop` field set to `"true"`
3. Retry with 2s delay if subscriber not found (timing issue)

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/sparkloop-client.ts` | SparkLoop API client and scoring logic |
| `src/components/SparkLoopModal.tsx` | Popup UI component |
| `src/app/dashboard/[slug]/sparkloop/page.tsx` | Admin dashboard |
| `src/app/api/sparkloop/` | All API routes |
| `src/app/api/cron/sync-sparkloop/route.ts` | Cron job |
| `src/types/sparkloop.ts` | TypeScript types |

---

## Environment Variables

```bash
SPARKLOOP_API_KEY=<from SparkLoop dashboard>
SPARKLOOP_UPSCRIBE_ID=<upscribe identifier>
```

---

## Timeframe-Based RCR

Delta tracking enables calculating RCR for specific time periods:

```typescript
// Calculate RCR for last 30 days
const rcr = await SparkLoopService.calculateRCRForTimeframe(refCode, 30)

// Get all RCRs for last 7 days
const rcrMap = await SparkLoopService.getRCRsForTimeframe(7)
```

Requires 5+ outcomes in the timeframe for meaningful calculation.

---

## Webhook Support

SparkLoop webhooks can be received at:
- `/api/webhooks/sparkloop` (existing endpoint)

Supported events:
- `new_offer_lead` - New referral submitted
- `referral_confirmed` - Referral confirmed
- `referral_rejected` - Referral rejected

Note: Currently configured for aiaccountingdaily.com - update if needed.

---

## Troubleshooting

### Chart shows no data
- Delta tracking started recently, needs time to accumulate
- Summary totals come from current SparkLoop data (immediate)

### MailerLite field not updating
- Check subscriber exists in MailerLite
- Field name is `sparkloop` (lowercase)
- Retry logic handles timing issues with new subscribers

### Recommendations not showing in popup
- Check if excluded in dashboard
- Check if status is `active` in SparkLoop
- Verify API key and upscribe ID are set

### Scoring seems wrong
- Default CR is 10% until 20+ impressions
- Default RCR is 25% until 20+ outcomes or SparkLoop provides rate
- Check `cr_source` and `rcr_source` in table to see data origin
