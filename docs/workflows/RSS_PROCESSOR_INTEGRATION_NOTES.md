# RSS Processor Integration for Secondary Articles

## Overview
This document outlines the changes needed to `src/lib/rss-processor.ts` to support secondary article generation.

## Key Changes Required

### 1. Modify `processFeed()` Method
**Location**: Lines 297-478

**Changes Needed**:
- Update to check both `use_for_primary_section` and `use_for_secondary_section` flags
- Tag posts with section information when inserting into `rss_posts` table
- **Option A** (Recommended): Add a `section` field to `rss_posts` table
- **Option B**: Create separate processing loops for each section

### 2. Modify `processPostsWithAI()` Method
**Location**: Lines 480-599

**Changes Needed**:
- Process posts separately by section
- Call different AI prompts based on section:
  - Primary: `AI_PROMPTS.criteria1Evaluator` through `criteria5Evaluator`
  - Secondary: `AI_PROMPTS.criteria1Evaluator` → needs new `secondaryCriteria1Evaluator`

**Implementation Approach**:
```typescript
// Get posts for each section
const primaryPosts = posts.filter(p => p.section === 'primary')
const secondaryPosts = posts.filter(p => p.section === 'secondary')

// Process primary section
await this.processPostsForSection(primaryPosts, campaignId, 'primary')

// Process secondary section
await this.processPostsForSection(secondaryPosts, campaignId, 'secondary')
```

### 3. Create `processPostsForSection()` Method
**New Method**

```typescript
private async processPostsForSection(
  posts: RssPost[],
  campaignId: string,
  section: 'primary' | 'secondary'
) {
  // Similar to current processPostsWithAI logic
  // But uses section-specific AI prompts
  const promptPrefix = section === 'secondary' ? 'secondary' : ''

  // Call appropriate evaluators:
  // Primary: criteria1Evaluator, criteria2Evaluator, etc.
  // Secondary: secondaryCriteria1Evaluator, secondaryCriteria2Evaluator, etc.
}
```

### 4. Modify `generateNewsletterArticles()` Method
**Location**: Lines 782-877

**Changes Needed**:
- Duplicate logic for secondary articles
- Insert into `secondary_articles` table instead of `articles` table
- Call `selectTop3SecondaryArticles()` instead of `selectTop5Articles()`

### 5. Create `selectTop3SecondaryArticles()` Method
**New Method** (similar to `selectTop5Articles()` at line 879)

```typescript
private async selectTop3SecondaryArticles(campaignId: string) {
  // Get max_secondary_articles setting (defaults to 3)
  const { data: maxSecondaryArticlesSetting } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', 'max_secondary_articles')
    .single()

  const finalArticleCount = maxSecondaryArticlesSetting
    ? parseInt(maxSecondaryArticlesSetting.value)
    : 3

  // Query secondary_articles table
  const { data: articles, error } = await supabaseAdmin
    .from('secondary_articles')
    .select(`
      id,
      fact_check_score,
      rss_post:rss_posts(
        post_rating:post_ratings(total_score)
      )
    `)
    .eq('campaign_id', campaignId)
    .gte('fact_check_score', 15)

  // Sort and activate top N
  const sortedArticles = articles
    .map((article: any) => ({
      id: article.id,
      score: article.rss_post?.post_rating?.[0]?.total_score || 0
    }))
    .sort((a, b) => b.score - a.score)

  const topArticles = sortedArticles.slice(0, finalArticleCount)

  for (let i = 0; i < topArticles.length; i++) {
    await supabaseAdmin
      .from('secondary_articles')
      .update({
        is_active: true,
        rank: i + 1
      })
      .eq('id', topArticles[i].id)
  }

  // Note: Secondary articles do NOT generate subject line
  console.log(`Activated top ${topArticles.length} secondary articles`)
}
```

### 6. Update RSS Feed Query
**Location**: Line 114-121 in `processAllFeedsForCampaign()`

**Current**:
```typescript
const { data: feeds, error: feedsError } = await supabaseAdmin
  .from('rss_feeds')
  .select('*')
  .eq('active', true)
```

**New**:
```typescript
const { data: feeds, error: feedsError } = await supabaseAdmin
  .from('rss_feeds')
  .select('*')
  .eq('active', true)
  // Note: Will need to track which section each feed is for
```

## Alternative Approach: Simpler Implementation

Instead of modifying the existing `processFeed()` method, we can:

1. **Keep primary processing as-is**
2. **Add a new parallel flow for secondary**:

```typescript
async processAllFeedsForCampaign(campaignId: string) {
  // ... existing archive and clear logic ...

  // SECTION 1: Process PRIMARY articles (existing code)
  const { data: primaryFeeds } = await supabaseAdmin
    .from('rss_feeds')
    .select('*')
    .eq('active', true)
    .eq('use_for_primary_section', true)

  for (const feed of primaryFeeds) {
    await this.processFeed(feed, campaignId)
  }

  await this.processPostsWithAI(campaignId) // Existing method

  // SECTION 2: Process SECONDARY articles (new code)
  const { data: secondaryFeeds } = await supabaseAdmin
    .from('rss_feeds')
    .select('*')
    .eq('active', true)
    .eq('use_for_secondary_section', true)

  for (const feed of secondaryFeeds) {
    await this.processFeed(feed, campaignId)
    // Posts from secondary feeds processed differently
  }

  await this.processSecondaryPostsWithAI(campaignId) // New method

  // ... existing event population and completion logic ...
}
```

## Database Schema Updates Needed

### Option 1: Add section field to rss_posts
```sql
ALTER TABLE rss_posts ADD COLUMN section TEXT DEFAULT 'primary';
CREATE INDEX idx_rss_posts_section ON rss_posts(section);
```

### Option 2: Process feeds separately (No schema change needed)
- Query feeds twice (once for primary, once for secondary)
- Process each set separately
- Insert into appropriate articles table

## Implementation Priority

**Recommended Order**:
1. Add `processSecondaryPostsWithAI()` method (parallel to existing)
2. Add `generateSecondaryNewsletterArticles()` method
3. Add `selectTop3SecondaryArticles()` method
4. Update `processAllFeedsForCampaign()` to call secondary methods
5. Update OpenAI prompts to support secondary section

## Testing Checklist

- [ ] RSS feeds with `use_for_secondary_section=true` are processed
- [ ] Secondary posts evaluated with separate AI prompts
- [ ] Secondary articles inserted into `secondary_articles` table
- [ ] Top 3 secondary articles activated (configurable)
- [ ] Primary and secondary sections don't interfere with each other
- [ ] Subject line only uses primary section
- [ ] Newsletter preview shows both sections

---

*Created: 2025-10-15*
*Status: Implementation pending*
