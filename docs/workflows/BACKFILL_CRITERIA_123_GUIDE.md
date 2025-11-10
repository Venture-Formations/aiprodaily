# Backfill Criteria 1-3 Guide

This guide explains how to backfill updated criteria 1-3 scores for posts from the past 6-36 hours.

**Production Details:**
- Domain: https://www.aiprodaily.com
- Newsletter ID: `eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf`
- CRON_SECRET: `60NkupzhvNpuExfyl0aa9wzzVVnfWGWWPsr3gfvchTg=`

## Endpoints

### 1. Check Endpoint (Run First)
**URL:** `/api/backfill/criteria-1-2-3/check`

Checks how many posts need backfilling and provides recommendations.

```bash
curl -X POST "https://www.aiprodaily.com/api/backfill/criteria-1-2-3/check?secret=60NkupzhvNpuExfyl0aa9wzzVVnfWGWWPsr3gfvchTg=" \
  -H "Content-Type: application/json" \
  -d '{
    "newsletterId": "eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf"
  }'
```

**Response:**
```json
{
  "success": true,
  "newsletterId": "accounting",
  "windows": {
    "6-36_hours": { "count": 45, "timeRange": {...} },
    "6-24_hours": { "count": 30, "timeRange": {...} },
    "24-36_hours": { "count": 15, "timeRange": {...} }
  },
  "recommendation": "Run with timeWindow: \"all\" - processes all posts in one batch",
  "totalPosts": 45,
  "shouldSplit": false
}
```

### 2. Backfill Endpoint
**URL:** `/api/backfill/criteria-1-2-3`

Performs the actual backfilling of criteria 1-3 scores.

#### Parameters:
- `newsletterId` (required): Newsletter ID (e.g., "accounting")
- `timeWindow` (optional): "all" (default), "6-24", "24-36", or "36-60"
- `dryRun` (optional): true/false (default: false) - test without updating database

## Usage Scenarios

### Scenario 1: Small Dataset (≤75 posts)

1. **Check the count:**
```bash
curl -X POST "https://www.aiprodaily.com/api/backfill/criteria-1-2-3/check?secret=60NkupzhvNpuExfyl0aa9wzzVVnfWGWWPsr3gfvchTg=" \
  -H "Content-Type: application/json" \
  -d '{"newsletterId": "eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf"}'
```

2. **Run backfill with all posts at once:**
```bash
curl -X POST "https://www.aiprodaily.com/api/backfill/criteria-1-2-3?secret=60NkupzhvNpuExfyl0aa9wzzVVnfWGWWPsr3gfvchTg=" \
  -H "Content-Type: application/json" \
  -d '{
    "newsletterId": "eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf",
    "timeWindow": "all"
  }'
```

**Expected Duration:** ~3-5 minutes for 50 posts

### Scenario 2: Large Dataset (>75 posts)

1. **Check the count:**
```bash
curl -X POST "https://www.aiprodaily.com/api/backfill/criteria-1-2-3/check?secret=60NkupzhvNpuExfyl0aa9wzzVVnfWGWWPsr3gfvchTg=" \
  -H "Content-Type: application/json" \
  -d '{"newsletterId": "eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf"}'
```

2. **First batch (6-24 hours ago):**
```bash
curl -X POST "https://www.aiprodaily.com/api/backfill/criteria-1-2-3?secret=60NkupzhvNpuExfyl0aa9wzzVVnfWGWWPsr3gfvchTg=" \
  -H "Content-Type: application/json" \
  -d '{
    "newsletterId": "eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf",
    "timeWindow": "6-24"
  }'
```

3. **Second batch (24-36 hours ago):**
```bash
curl -X POST "https://www.aiprodaily.com/api/backfill/criteria-1-2-3?secret=60NkupzhvNpuExfyl0aa9wzzVVnfWGWWPsr3gfvchTg=" \
  -H "Content-Type: application/json" \
  -d '{
    "newsletterId": "eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf",
    "timeWindow": "24-36"
  }'
```

**Expected Duration:** ~5-8 minutes per batch

### Scenario 3: Dry Run (Test First)

Test without making database changes:

```bash
curl -X POST "https://www.aiprodaily.com/api/backfill/criteria-1-2-3?secret=60NkupzhvNpuExfyl0aa9wzzVVnfWGWWPsr3gfvchTg=" \
  -H "Content-Type: application/json" \
  -d '{
    "newsletterId": "eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf",
    "timeWindow": "all",
    "dryRun": true
  }'
```

## How It Works

### Processing Flow

1. **Fetches PRIMARY feed posts only** (6-36 hours ago, or specified window)
2. **Gets existing ratings** for those posts
3. **Processes each criteria sequentially:**
   - Criteria 1: All posts
   - Criteria 2: All posts
   - Criteria 3: All posts
4. **AI evaluation** with batching (3 posts at a time, 2s delay)
5. **Updates ratings** with new scores and recalculated total_score

### Performance

- **Batching:** 3 posts per batch
- **Delay:** 2 seconds between batches
- **Timeout:** 600 seconds (10 minutes)
- **Estimated Time:**
  - 25 posts: ~2 minutes per criteria (~6 min total)
  - 50 posts: ~4 minutes per criteria (~12 min total - may timeout!)
  - 75 posts: ~6 minutes per criteria (~18 min total - will timeout!)

**Note:** For >50 posts, use split batches (6-24 and 24-36) to avoid timeout.

### What Gets Updated

For each post, the following fields in `post_ratings` are updated:
- `criteria_1_score` - New AI evaluation
- `criteria_1_weight` - Current weight from settings
- `criteria_1_reason` - AI reasoning
- `criteria_2_score` - New AI evaluation
- `criteria_2_weight` - Current weight from settings
- `criteria_2_reason` - AI reasoning
- `criteria_3_score` - New AI evaluation
- `criteria_3_weight` - Current weight from settings
- `criteria_3_reason` - AI reasoning
- `total_score` - Recalculated: (c1×w1 + c2×w2 + c3×w3 + c4×w4 + c5×w5)

**Note:** Criteria 4 and 5 scores are preserved (not updated).

## Response Format

```json
{
  "success": true,
  "message": "Backfill completed",
  "stats": {
    "totalPosts": 45,
    "postsWithRatings": 42,
    "criteria1Updated": 42,
    "criteria2Updated": 42,
    "criteria3Updated": 42,
    "errors": 0,
    "dryRun": false,
    "timeWindow": "all"
  }
}
```

## Troubleshooting

### "No posts found"
- Posts may have been archived
- Check if feeds are marked as `use_for_primary_section = true`
- Verify time window is correct

### Timeout (600s exceeded)
- Split into smaller batches using "6-24" and "24-36" windows
- Check Vercel logs for progress before timeout

### "Invalid AI response"
- Check that criteria prompts exist in app_settings
- Verify OpenAI API key is valid
- Check OpenAI rate limits

### Some posts skipped
- Posts without ratings are skipped (expected)
- Check logs for specific skip reasons

## Quick Commands (Ready to Copy-Paste)

### Check how many posts need backfilling:
```bash
curl -X POST "https://www.aiprodaily.com/api/backfill/criteria-1-2-3/check?secret=60NkupzhvNpuExfyl0aa9wzzVVnfWGWWPsr3gfvchTg=" \
  -H "Content-Type: application/json" \
  -d '{"newsletterId": "eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf"}'
```

### Run backfill (all posts 6-36 hours):
```bash
curl -X POST "https://www.aiprodaily.com/api/backfill/criteria-1-2-3?secret=60NkupzhvNpuExfyl0aa9wzzVVnfWGWWPsr3gfvchTg=" \
  -H "Content-Type: application/json" \
  -d '{
    "newsletterId": "eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf",
    "timeWindow": "all"
  }'
```

### Run backfill (6-24 hours only):
```bash
curl -X POST "https://www.aiprodaily.com/api/backfill/criteria-1-2-3?secret=60NkupzhvNpuExfyl0aa9wzzVVnfWGWWPsr3gfvchTg=" \
  -H "Content-Type: application/json" \
  -d '{
    "newsletterId": "eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf",
    "timeWindow": "6-24"
  }'
```

### Run backfill (24-36 hours only):
```bash
curl -X POST "https://www.aiprodaily.com/api/backfill/criteria-1-2-3?secret=60NkupzhvNpuExfyl0aa9wzzVVnfWGWWPsr3gfvchTg=" \
  -H "Content-Type: application/json" \
  -d '{
    "newsletterId": "eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf",
    "timeWindow": "24-36"
  }'
```

### Run backfill (36-60 hours only):
```bash
curl -X POST "https://www.aiprodaily.com/api/backfill/criteria-1-2-3?secret=60NkupzhvNpuExfyl0aa9wzzVVnfWGWWPsr3gfvchTg=" \
  -H "Content-Type: application/json" \
  -d '{
    "newsletterId": "eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf",
    "timeWindow": "36-60"
  }'
```
