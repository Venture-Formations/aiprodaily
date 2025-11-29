# RSS Ingestion System Implementation Guide

_Last updated: 2025-11-28_

**Original Implementation:** 2025-01-03
**Status:** Implementation Complete ✅

> **Note:** This guide documents the hybrid RSS processing implementation. The system is now live and running.

---

## Overview

### What We're Building

**Current System:**
- One batch job at 8:30 PM
- Fetches → Extracts → Scores → Generates 24 articles (12 primary + 12 secondary)
- **Problem:** With GPT-5, takes ~22 minutes (timeout at 10 min)

**New System:**
- **Ingestion cron** (every 15 min): Fetch → Extract → Score posts
- **Nightly batch** (8:30 PM): Generate only 12 articles (6 primary + 6 secondary)
- **Result:** Nightly batch takes ~7 minutes ✅

---

## Pre-Implementation Checklist

- [ ] Read this entire document first
- [ ] Backup database (or verify RDS automated backups are working)
- [ ] Create a test branch: `git checkout -b feature/rss-ingestion`
- [ ] Have access to Vercel logs
- [ ] Have Supabase studio open for monitoring

---

## Step 1: Database Changes

### 1.1 Make `issue_id` Nullable

**Run in Supabase SQL Editor:**

```sql
-- Make issue_id nullable in rss_posts
ALTER TABLE rss_posts
ALTER COLUMN issue_id DROP NOT NULL;

-- Verify
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'rss_posts'
AND column_name = 'campaign_id';
-- Should show: is_nullable = 'YES'
```

### 1.2 Add Unique Constraint (Prevent Duplicate Ingestion)

```sql
-- Add unique constraint on external_id to prevent race conditions
-- First check for existing duplicates
SELECT external_id, COUNT(*)
FROM rss_posts
GROUP BY external_id
HAVING COUNT(*) > 1;

-- If duplicates exist, clean them up first:
-- (Keep the oldest post for each external_id)
DELETE FROM rss_posts
WHERE id NOT IN (
  SELECT MIN(id)
  FROM rss_posts
  GROUP BY external_id
);

-- Now add the constraint
ALTER TABLE rss_posts
ADD CONSTRAINT unique_external_id UNIQUE (external_id);
```

**✅ Checkpoint:** Verify no errors in SQL execution

---

## Step 2: Create Ingestion Cron Endpoint

### 2.1 Create File

**Path:** `src/app/api/cron/ingest-rss/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { RSSProcessor } from '@/lib/rss-processor'

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('[Ingest] Starting RSS ingestion...')

    const processor = new RSSProcessor()
    const result = await processor.ingestNewPosts()

    console.log(`[Ingest] Complete: ${result.fetched} fetched, ${result.scored} scored`)

    return NextResponse.json({
      success: true,
      fetched: result.fetched,
      scored: result.scored,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[Ingest] Error:', error)
    return NextResponse.json({
      error: 'Ingestion failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// For manual testing
export async function GET() {
  return NextResponse.json({
    message: 'RSS ingestion endpoint is active',
    timestamp: new Date().toISOString(),
    schedule: 'Every 15 minutes'
  })
}

export const maxDuration = 300 // 5 minutes
```

**✅ Checkpoint:** File created

---

## Step 3: Add Ingestion Methods to RSSProcessor

### 3.1 Add Three New Methods

**File:** `src/lib/rss-processor.ts`

**Location:** Add after the existing `processAllFeeds()` method (around line 180)

```typescript
/**
 * Ingest and score new posts (runs every 15 minutes)
 * Does NOT generate articles or assign to campaigns
 */
async ingestNewPosts(): Promise<{ fetched: number; scored: number }> {
  let totalFetched = 0
  let totalScored = 0

  // Get all active feeds
  const { data: allFeeds } = await supabaseAdmin
    .from('rss_feeds')
    .select('*')
    .eq('active', true)

  if (!allFeeds || allFeeds.length === 0) {
    return { fetched: 0, scored: 0 }
  }

  // Process each feed
  for (const feed of allFeeds) {
    try {
      const result = await this.ingestFeedPosts(feed)
      totalFetched += result.fetched
      totalScored += result.scored
    } catch (error) {
      console.error(`[Ingest] Feed ${feed.name} failed:`, error instanceof Error ? error.message : 'Unknown')
    }
  }

  return { fetched: totalFetched, scored: totalScored }
}

/**
 * Ingest posts from a single feed
 */
private async ingestFeedPosts(feed: RssFeed): Promise<{ fetched: number; scored: number }> {
  const rssFeed = await parser.parseURL(feed.url)

  // Filter posts from last 6 hours (safety margin)
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)

  const recentPosts = rssFeed.items.filter(item => {
    if (!item.pubDate) return true // Include if no date
    const pubDate = new Date(item.pubDate)
    return pubDate >= sixHoursAgo
  })

  const newPosts: any[] = []

  // Check which posts are actually new
  for (const item of recentPosts) {
    const externalId = item.guid || item.link || ''

    // Check if already exists (any campaign or no campaign)
    const { data: existing } = await supabaseAdmin
      .from('rss_posts')
      .select('id')
      .eq('external_id', externalId)
      .maybeSingle()

    if (existing) continue

    // Get excluded sources
    const { data: excludedSettings } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'excluded_rss_sources')
      .single()

    const excludedSources: string[] = excludedSettings?.value
      ? JSON.parse(excludedSettings.value)
      : []

    const author = item.creator || (item as any)['dc:creator'] || null
    const blockImages = excludedSources.includes(author)

    // Extract image URL (same logic as current)
    let imageUrl = this.extractImageUrl(item)

    // Re-host Facebook images
    if (!blockImages && imageUrl && imageUrl.includes('fbcdn.net')) {
      try {
        const githubUrl = await this.githubStorage.uploadImage(imageUrl, item.title || 'Untitled')
        if (githubUrl) imageUrl = githubUrl
      } catch (error) {
        // Silent failure
      }
    }

    if (blockImages) imageUrl = null

    // Insert new post (campaign_id = null)
    const { data: newPost, error: insertError } = await supabaseAdmin
      .from('rss_posts')
      .insert([{
        feed_id: feed.id,
        campaign_id: null, // ← Not assigned to campaign yet
        external_id: externalId,
        title: item.title || '',
        description: item.contentSnippet || item.content || '',
        content: item.content || '',
        author,
        publication_date: item.pubDate,
        source_url: item.link,
        image_url: imageUrl,
      }])
      .select('id, source_url')
      .single()

    if (insertError || !newPost) continue

    newPosts.push(newPost)
  }

  // Extract full text for new posts (parallel, batch of 10)
  if (newPosts.length > 0) {
    const urls = newPosts
      .filter(p => p.source_url)
      .map(p => p.source_url)

    try {
      const extractionResults = await this.articleExtractor.extractBatch(urls, 10)

      // Update posts with full text
      for (const post of newPosts) {
        if (!post.source_url) continue

        const result = extractionResults.get(post.source_url)
        if (result?.success && result.fullText) {
          await supabaseAdmin
            .from('rss_posts')
            .update({ full_article_text: result.fullText })
            .eq('id', post.id)
        }
      }
    } catch (error) {
      console.error('[Ingest] Extraction failed:', error instanceof Error ? error.message : 'Unknown')
    }
  }

  // Score new posts (batch of 5)
  let scoredCount = 0

  if (newPosts.length > 0) {
    // Get full post data for scoring
    const { data: fullPosts } = await supabaseAdmin
      .from('rss_posts')
      .select('*')
      .in('id', newPosts.map(p => p.id))

    if (fullPosts && fullPosts.length > 0) {
      // Score in batches of 5
      const BATCH_SIZE = 5
      const BATCH_DELAY = 2000

      for (let i = 0; i < fullPosts.length; i += BATCH_SIZE) {
        const batch = fullPosts.slice(i, i + BATCH_SIZE)

        // Process batch in parallel
        const results = await Promise.allSettled(
          batch.map(post => this.scoreAndStorePost(post))
        )

        scoredCount += results.filter(r => r.status === 'fulfilled').length

        // Delay between batches
        if (i + BATCH_SIZE < fullPosts.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY))
        }
      }
    }
  }

  return { fetched: newPosts.length, scored: scoredCount }
}

/**
 * Score a single post and store rating
 */
private async scoreAndStorePost(post: RssPost): Promise<void> {
  const evaluation = await this.evaluatePost(post)

  if (typeof evaluation.interest_level !== 'number' ||
      typeof evaluation.local_relevance !== 'number' ||
      typeof evaluation.community_impact !== 'number') {
    throw new Error('Invalid score types')
  }

  const ratingRecord: any = {
    post_id: post.id,
    interest_level: evaluation.interest_level,
    local_relevance: evaluation.local_relevance,
    community_impact: evaluation.community_impact,
    ai_reasoning: evaluation.reasoning,
    total_score: (evaluation as any).total_score ||
      ((evaluation.interest_level + evaluation.local_relevance + evaluation.community_impact) / 30 * 100)
  }

  const criteriaScores = (evaluation as any).criteria_scores
  if (criteriaScores && Array.isArray(criteriaScores)) {
    for (let k = 0; k < criteriaScores.length && k < 5; k++) {
      const criterionNum = k + 1
      ratingRecord[`criteria_${criterionNum}_score`] = criteriaScores[k].score
      ratingRecord[`criteria_${criterionNum}_reason`] = criteriaScores[k].reason
      ratingRecord[`criteria_${criterionNum}_weight`] = criteriaScores[k].weight
    }
  }

  const { error } = await supabaseAdmin
    .from('post_ratings')
    .insert([ratingRecord])

  if (error) {
    throw new Error(`Rating insert failed: ${error.message}`)
  }
}

/**
 * Helper to extract image URL from RSS item
 */
private extractImageUrl(item: any): string | null {
  // Method 1: media:content
  if (item['media:content']) {
    if (Array.isArray(item['media:content'])) {
      const imageContent = item['media:content'].find((media: any) =>
        media.type?.startsWith('image/') || media.medium === 'image'
      )
      return imageContent?.url || imageContent?.$?.url || null
    } else {
      const mediaContent = item['media:content']
      return mediaContent.url ||
             mediaContent.$?.url ||
             (mediaContent.medium === 'image' ? mediaContent.url : null) ||
             (mediaContent.$?.medium === 'image' ? mediaContent.$?.url : null)
    }
  }

  // Method 2: enclosure
  if (item.enclosure) {
    if (Array.isArray(item.enclosure)) {
      const imageEnclosure = item.enclosure.find((enc: any) => enc.type?.startsWith('image/'))
      return imageEnclosure?.url || null
    } else if (item.enclosure.type?.startsWith('image/')) {
      return item.enclosure.url
    }
  }

  // Method 3: Look in content HTML
  if (item.content || item.contentSnippet) {
    const content = item.content || item.contentSnippet || ''
    const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
    if (imgMatch) return imgMatch[1]
  }

  // Method 4: thumbnail or image fields
  return item.thumbnail || item.image || item['media:thumbnail']?.url || null
}
```

**✅ Checkpoint:** Methods added without syntax errors

---

## Step 4: Modify generateArticlesForSection

**File:** `src/lib/rss-processor.ts`

**Find:** `async generateArticlesForSection(campaignId: string, section: 'primary' | 'secondary' = 'primary')`

**Replace signature with:**

```typescript
async generateArticlesForSection(
  campaignId: string,
  section: 'primary' | 'secondary' = 'primary',
  articleLimit: number = 6
): Promise<{ generated: number; errors: number }>
```

**Find:** `.slice(0, 12)` (around line 1061)

**Replace with:** `.slice(0, articleLimit)`

**Find:** `const BATCH_SIZE = 2` (around line 1112)

**Replace with:** `const BATCH_SIZE = 3`

**Find:** `await new Promise(resolve => setTimeout(resolve, 3000))` (around line 1136)

**Replace with:** `await new Promise(resolve => setTimeout(resolve, 2000))`

**Find the return statement at end of method and update to:**

```typescript
await this.processArticleImages(campaignId)

return { generated: processedCount, errors: errorCount }
```

**✅ Checkpoint:** All changes made, TypeScript compiles

---

## Step 5: Update Step 5 (Generate Headlines)

**File:** `src/app/api/rss/combined-steps/step5-generate-headlines.ts`

**Replace entire contents with:**

```typescript
import { supabaseAdmin } from '@/lib/supabase'
import { RSSProcessor } from '@/lib/rss-processor'

/**
 * Step 5: Generate Headlines and Bodies
 * Uses pre-scored posts from ingestion
 * Generates articles for top 6 primary + top 6 secondary
 */
export async function executeStep5(campaignId: string) {
  const processor = new RSSProcessor()

  // Get lookback window for pre-scored posts
  const { data: lookbackSetting } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', 'primary_article_lookback_hours')
    .single()

  const lookbackHours = lookbackSetting ? parseInt(lookbackSetting.value) : 72
  const lookbackDate = new Date()
  lookbackDate.setHours(lookbackDate.getHours() - lookbackHours)
  const lookbackTimestamp = lookbackDate.toISOString()

  // Assign top posts to this campaign before generating
  await assignTopPostsToCampaign(campaignId, lookbackTimestamp)

  // Generate articles for primary section (top 6 only)
  const primaryResult = await processor.generateArticlesForSection(campaignId, 'primary', 6)

  // Generate articles for secondary section (top 6 only)
  const secondaryResult = await processor.generateArticlesForSection(campaignId, 'secondary', 6)

  console.log(`[Step 5/8] Complete: ${primaryResult.generated} primary, ${secondaryResult.generated} secondary articles`)

  return {
    primary: primaryResult.generated,
    secondary: secondaryResult.generated
  }
}

/**
 * Assign top-scoring posts to the campaign
 */
async function assignTopPostsToCampaign(campaignId: string, lookbackTimestamp: string) {
  // Get feeds for primary section
  const { data: primaryFeeds } = await supabaseAdmin
    .from('rss_feeds')
    .select('id')
    .eq('active', true)
    .eq('use_for_primary_section', true)

  const primaryFeedIds = primaryFeeds?.map(f => f.id) || []

  // Get feeds for secondary section
  const { data: secondaryFeeds } = await supabaseAdmin
    .from('rss_feeds')
    .select('id')
    .eq('active', true)
    .eq('use_for_secondary_section', true)

  const secondaryFeedIds = secondaryFeeds?.map(f => f.id) || []

  // Get top primary posts (unassigned, within lookback window)
  const { data: topPrimary } = await supabaseAdmin
    .from('rss_posts')
    .select(`
      id,
      post_ratings(total_score)
    `)
    .in('feed_id', primaryFeedIds)
    .is('campaign_id', null)
    .gte('processed_at', lookbackTimestamp)
    .not('post_ratings', 'is', null)
    .order('processed_at', { ascending: false })
    .limit(20) // Get more than we need for deduplication

  // Get top secondary posts
  const { data: topSecondary } = await supabaseAdmin
    .from('rss_posts')
    .select(`
      id,
      post_ratings(total_score)
    `)
    .in('feed_id', secondaryFeedIds)
    .is('campaign_id', null)
    .gte('processed_at', lookbackTimestamp)
    .not('post_ratings', 'is', null)
    .order('processed_at', { ascending: false })
    .limit(20)

  // Assign to campaign
  const primaryIds = topPrimary?.map(p => p.id) || []
  const secondaryIds = topSecondary?.map(p => p.id) || []

  if (primaryIds.length > 0) {
    await supabaseAdmin
      .from('rss_posts')
      .update({ campaign_id: campaignId })
      .in('id', primaryIds)
  }

  if (secondaryIds.length > 0) {
    await supabaseAdmin
      .from('rss_posts')
      .update({ campaign_id: campaignId })
      .in('id', secondaryIds)
  }
}
```

**✅ Checkpoint:** File updated, TypeScript compiles

---

## Step 6: Update Nightly Batch Steps

**File:** `src/app/api/rss/process/route.ts`

**Find:** The `steps` array (around line 55)

**Replace with:**

```typescript
const steps = [
  { name: 'Archive', fn: () => executeStep1(campaign_id!) },
  // REMOVED: Fetch+Extract (done by ingestion)
  // REMOVED: Score (done by ingestion)
  { name: 'Deduplicate', fn: () => executeStep4(campaign_id!) },
  { name: 'Generate', fn: () => executeStep5(campaign_id!) },
  { name: 'Select+Subject', fn: () => executeStep6(campaign_id!) },
  { name: 'Welcome', fn: () => executeStep7(campaign_id!) },
  { name: 'Finalize', fn: () => executeStep8(campaign_id!) }
]
```

**✅ Checkpoint:** Steps updated

---

## Step 7: Update vercel.json

**File:** `vercel.json`

**Add to `crons` array:**

```json
{
  "path": "/api/cron/ingest-rss",
  "schedule": "*/15 * * * *"
}
```

**Add to `functions` object:**

```json
"app/api/cron/ingest-rss/route.ts": {
  "maxDuration": 300
}
```

**Full example:**

```json
{
  "crons": [
    {
      "path": "/api/cron/ingest-rss",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/populate-events",
      "schedule": "*/5 * * * *"
    },
    // ... other crons
  ],
  "functions": {
    "app/api/cron/ingest-rss/route.ts": {
      "maxDuration": 300
    },
    // ... other functions
  }
}
```

**✅ Checkpoint:** vercel.json updated

---

## Step 8: Test Locally

### 8.1 Build Check

```bash
npm run type-check
```

**Expected:** No errors

### 8.2 Manual Test Ingestion

```bash
# In browser or Postman:
# GET http://localhost:3000/api/cron/ingest-rss
# Should return: { message: "RSS ingestion endpoint is active", ... }
```

### 8.3 Test with Cron Secret

```bash
curl -X POST http://localhost:3000/api/cron/ingest-rss \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Expected response:**
```json
{
  "success": true,
  "fetched": 5,
  "scored": 5,
  "timestamp": "2025-01-04T..."
}
```

**Check database:**
```sql
SELECT COUNT(*) FROM rss_posts WHERE campaign_id IS NULL;
-- Should show newly ingested posts

SELECT COUNT(*) FROM post_ratings
WHERE post_id IN (
  SELECT id FROM rss_posts WHERE campaign_id IS NULL
);
-- Should match number of scored posts
```

**✅ Checkpoint:** Ingestion works locally

---

## Step 9: Deploy to Production

### 9.1 Commit Changes

```bash
git add .
git commit -m "Add RSS ingestion system to prevent GPT-5 timeouts"
git push origin feature/rss-ingestion
```

### 9.2 Create Pull Request

- Review diff on GitHub
- Merge to main

### 9.3 Monitor Deployment

- Watch Vercel deployment
- Check for build errors
- Verify deployment succeeds

**✅ Checkpoint:** Deployed successfully

---

## Step 10: Production Testing

### 10.1 Verify Cron is Scheduled

1. Go to Vercel Dashboard → Project → Settings → Cron Jobs
2. Verify `/api/cron/ingest-rss` is listed with schedule `*/15 * * * *`

### 10.2 Manual Trigger (Test First Run)

```bash
# Use production URL
curl -X POST https://YOUR_DOMAIN.com/api/cron/ingest-rss \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Check Vercel logs:**
- Should see `[Ingest] Starting RSS ingestion...`
- Should see `[Ingest] Complete: X fetched, Y scored`

### 10.3 Check Database (Production)

**In Supabase SQL Editor:**

```sql
-- Check for ingested posts
SELECT
  COUNT(*) as total_posts,
  COUNT(CASE WHEN campaign_id IS NULL THEN 1 END) as unassigned_posts,
  COUNT(CASE WHEN campaign_id IS NOT NULL THEN 1 END) as assigned_posts
FROM rss_posts;

-- Check recent ingested posts
SELECT
  id,
  title,
  campaign_id,
  processed_at,
  (SELECT COUNT(*) FROM post_ratings WHERE post_id = rss_posts.id) as has_rating
FROM rss_posts
WHERE processed_at > NOW() - INTERVAL '1 hour'
ORDER BY processed_at DESC
LIMIT 10;

-- Should show posts with campaign_id = NULL and has_rating = 1
```

**✅ Checkpoint:** Ingestion working in production

### 10.4 Wait for Nightly Batch

**At 8:30 PM CT:**

1. Watch Vercel logs for `/api/cron/process-rss`
2. Look for:
   - `[Step 5/8] Complete: X primary, Y secondary articles`
   - Total time should be < 10 minutes
3. Check that campaign has articles generated

**✅ Checkpoint:** Nightly batch completes successfully

---

## Step 11: Monitoring (First 24 Hours)

### Things to Watch

**Ingestion cron (every 15 min):**
- ✅ Should complete in < 60 seconds
- ✅ Should fetch 0-10 posts per run (depends on RSS activity)
- ✅ Should not throw errors

**Nightly batch (8:30 PM):**
- ✅ Should complete in < 10 minutes
- ✅ Should generate 12 articles (6 primary + 6 secondary)
- ✅ Campaign status should be `draft` at end

**Database growth:**
- ✅ `rss_posts` should grow by ~50-100 posts per day
- ✅ Most posts should have `campaign_id = NULL` (until assigned by nightly batch)
- ✅ `post_ratings` should grow at same rate as `rss_posts`

### Queries for Monitoring

```sql
-- Ingestion health check
SELECT
  DATE(processed_at) as date,
  COUNT(*) as posts_ingested,
  COUNT(CASE WHEN campaign_id IS NULL THEN 1 END) as unassigned
FROM rss_posts
WHERE processed_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(processed_at)
ORDER BY date DESC;

-- Rating coverage
SELECT
  COUNT(*) as total_posts,
  COUNT(CASE WHEN EXISTS (
    SELECT 1 FROM post_ratings WHERE post_id = rss_posts.id
  ) THEN 1 END) as posts_with_ratings,
  ROUND(100.0 * COUNT(CASE WHEN EXISTS (
    SELECT 1 FROM post_ratings WHERE post_id = rss_posts.id
  ) THEN 1 END) / COUNT(*), 2) as coverage_pct
FROM rss_posts
WHERE processed_at > NOW() - INTERVAL '24 hours';
-- Should be close to 100%

-- Recent campaigns
SELECT
  id,
  date,
  status,
  (SELECT COUNT(*) FROM articles WHERE campaign_id = newsletter_campaigns.id) as article_count,
  created_at
FROM newsletter_campaigns
ORDER BY date DESC
LIMIT 5;
```

---

## Troubleshooting

### Issue: Ingestion cron times out

**Symptoms:** Vercel shows timeout error after 5 minutes

**Causes:**
- Too many posts to score (> 30)
- GPT-5 is slower than expected

**Solutions:**
1. Increase batch delay: Change `BATCH_DELAY = 2000` to `3000` in `ingestFeedPosts()`
2. Reduce batch size: Change `BATCH_SIZE = 5` to `3`
3. Increase max duration: Change `maxDuration = 300` to `600` in route.ts

---

### Issue: Duplicate posts being created

**Symptoms:** Multiple posts with same title/URL

**Causes:**
- Unique constraint not applied
- Race condition between cron runs

**Solutions:**
1. Verify unique constraint exists:
   ```sql
   SELECT constraint_name
   FROM information_schema.table_constraints
   WHERE table_name = 'rss_posts'
   AND constraint_type = 'UNIQUE';
   ```
2. If missing, add it (see Step 1.2)
3. Clean up duplicates manually

---

### Issue: Nightly batch generates 0 articles

**Symptoms:** Step 5 completes but no articles created

**Causes:**
- No posts with `campaign_id = NULL` found
- Posts outside lookback window
- All posts filtered out (no full_article_text)

**Debug queries:**
```sql
-- Check for unassigned posts
SELECT COUNT(*)
FROM rss_posts
WHERE campaign_id IS NULL
AND processed_at > NOW() - INTERVAL '72 hours';

-- Check for ratings
SELECT COUNT(*)
FROM post_ratings pr
JOIN rss_posts rp ON pr.post_id = rp.id
WHERE rp.campaign_id IS NULL;

-- Check extraction success
SELECT
  COUNT(*) as total,
  COUNT(full_article_text) as extracted
FROM rss_posts
WHERE campaign_id IS NULL
AND processed_at > NOW() - INTERVAL '24 hours';
```

**Solutions:**
1. If no unassigned posts: Wait for next ingestion run
2. If no ratings: Check scoring step in ingestion
3. If no extraction: Check article extractor service

---

### Issue: Posts never get assigned to campaigns

**Symptoms:** `rss_posts.campaign_id` stays NULL forever

**Causes:**
- `assignTopPostsToCampaign()` not running
- Query filters too strict

**Debug:**
Add logging to Step 5:
```typescript
console.log('[Step 5] Primary IDs to assign:', primaryIds)
console.log('[Step 5] Secondary IDs to assign:', secondaryIds)
```

Check Vercel logs for these messages.

---

## Rollback Plan

### If Something Goes Wrong

**Option 1: Disable Ingestion Cron**

1. Go to Vercel Dashboard → Cron Jobs
2. Disable `/api/cron/ingest-rss`
3. System falls back to nightly batch doing everything
4. **Note:** Nightly batch will still timeout with GPT-5

**Option 2: Revert Code**

```bash
git revert HEAD
git push origin main
```

**Option 3: Hotfix**

1. Identify specific issue
2. Fix in new commit
3. Deploy immediately

---

## Success Criteria

After 24 hours, verify:

- [ ] Ingestion cron runs every 15 minutes without errors
- [ ] ~50-100 posts ingested per day
- [ ] All ingested posts have ratings
- [ ] Nightly batch completes in < 10 minutes
- [ ] Campaigns have 12 articles (6 primary + 6 secondary)
- [ ] No timeout errors in Vercel logs
- [ ] Newsletter sends successfully

---

## Additional Notes

### Future Optimizations

1. **Adjust ingestion frequency:** If 15 min is too frequent, change to 30 min
2. **Add metrics:** Track ingestion success rate, scoring accuracy
3. **Alert on failures:** Slack notification if ingestion fails 3 times in a row
4. **Parallel processing:** If still timing out, split article generation into multiple functions

### Cost Implications

**Before (all at 8:30 PM):**
- 50 posts × 5 scoring calls = 250 calls
- 24 articles × 3 calls = 72 calls
- **Total: 322 GPT-5 calls/day**

**After (distributed):**
- Same total calls, just spread over 96 ingestion runs + 1 nightly batch
- **No additional cost, just redistributed**

### Database Size

**Expected growth:**
- `rss_posts`: +50-100 rows/day
- `post_ratings`: +50-100 rows/day
- Posts get assigned to campaigns nightly
- Archive process still clears old data

---

## Questions to Consider After Implementation

1. **Is 15 minutes the right frequency?**
   - Too frequent: Waste of resources if RSS feeds don't update that often
   - Too infrequent: Less benefit from distributed processing

2. **Should we increase article count back to 12+12?**
   - Now that we have headroom (< 7 min vs 10 min limit)
   - Could go to 8+8 or 10+10 safely

3. **Should we add pre-filtering?**
   - If still approaching timeout, add heuristic filters
   - Could reduce scoring load by 40-60%

---

## Contact & Support

**If you run into issues:**
1. Check Vercel logs first
2. Run debug queries in Supabase
3. Check this document's Troubleshooting section
4. Ask me (Claude) for help with specific error messages

---

**Good luck with implementation! 🚀**
