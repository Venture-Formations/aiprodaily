# Deduplication Historical Fix

**Date:** 2025-11-18
**Issue:** Duplicate articles appearing across consecutive issues
**Root Cause:** Historical posts only checked in Stage 0 (hash matching), not in Stages 1-3

## Problem Analysis

### Timeline of Issue
- **Nov 17 (Issue f546382b):** Created at 1:40 AM, included article "Why We Need an AI Tax..."
- **Nov 18 (Issue d8679cfd):** Created at 3:27 AM, RSS feed had same article again
- **Result:** Both issues published the same content

### Why Deduplication Failed

**Before the fix:**
1. **Stage 0 (Historical Hash):** Checked historical articles via MD5 hash
   - Nov 18 post had hash: `c1e7ae6240ce30c18a89536fbbb8a7b2`
   - Nov 17 post had hash: `436a7ae16a3fa83f00ad3724f31d00f6`
   - **Different hashes** → no match (RSS feed had slightly different HTML)

2. **Stage 1 (Exact Hash):** Only checked current issue posts against each other
   - Historical posts NOT included

3. **Stage 2 (Title Similarity):** Only checked current issue posts against each other
   - Historical posts NOT included
   - **This would have caught it!** Both had identical titles

4. **Stage 3 (AI Semantic):** Only checked current issue posts against each other
   - Historical posts NOT included

**The gap:** Once a post failed Stage 0 hash matching, historical posts were discarded and never checked in later stages.

## The Fix

### Changes Made to `src/lib/deduplicator.ts`

#### 1. New Method: `fetchHistoricalPosts()`
- Extracts historical post fetching into separate method
- Called once at beginning of `detectAllDuplicates()`
- Returns full RSS post objects for comparison

#### 2. Stage 0: Simplified
- Now receives pre-fetched historical posts as parameter
- Only performs hash comparison (as before)

#### 3. Stage 1: Enhanced (Exact Hash)
- **No change needed** - already compares all current posts
- Note: Could be enhanced later to check historical, but low value since Stage 0 already does this

#### 4. Stage 2: Enhanced (Title Similarity)
- **NEW:** Accepts `historicalPosts` parameter
- **First:** Checks each current post against ALL historical posts for title similarity
- **Second:** Checks current posts against each other (within-issue duplicates)
- **Catches cases like:** Same article title, different HTML/content

#### 5. Stage 3: Enhanced (AI Semantic)
- **NEW:** Accepts `historicalPosts` parameter
- **Combines:** `[...currentPosts, ...historicalPosts]` into single array for AI
- **AI analyzes:** All posts together, finds semantic duplicates
- **Smart filtering:** Only marks CURRENT posts as duplicates
  - If primary is historical → marks current duplicates
  - If primary is current → marks current duplicates

## How It Works Now

### Flow for Nov 18 Issue (with fix)

```
1. Fetch historical posts from sent issues (last 3 days)
   → Gets Nov 17 posts: ["AI Tax article", "Zeni article", ...]

2. Stage 0: Hash check
   → Different hashes, no match

3. Stage 1: Exact duplicates (current only)
   → No exact duplicates

4. Stage 2: Title similarity
   → Checks "Why We Need an AI Tax..." (Nov 18)
   → Against "Why We Need an AI Tax..." (Nov 17 historical)
   → **MATCH FOUND!** (100% title similarity)
   → Marks Nov 18 post as duplicate

5. Article generation skips duplicate post
   → Issue averted!
```

## Testing Scenarios

### Scenario 1: Exact same article (same hash)
- **Stage 0** catches it → Marked as duplicate ✅

### Scenario 2: Same article, different HTML (our case)
- **Stage 0** misses (different hash)
- **Stage 2** catches it (title match) ✅

### Scenario 3: Similar topic, different wording
- **Stages 0-2** miss
- **Stage 3** catches it (AI semantic) ✅

### Scenario 4: Within-issue duplicates
- **Stages 1-3** still catch these ✅
- No regression

## Performance Impact

### Before
- 1 query to fetch historical posts (in Stage 0)
- Historical posts discarded after Stage 0

### After
- 1 query to fetch historical posts (once at start)
- Historical posts reused across all stages
- **Stage 2:** O(N * H) title comparisons (N=current, H=historical)
- **Stage 3:** AI processes (N + H) posts instead of just N

### Estimated Impact
- Typical: 12 current posts + 18 historical posts = 30 total
- Stage 2: 12 * 18 = 216 comparisons (fast string operations)
- Stage 3: AI call with 30 posts instead of 12 (may hit token limits if historical pool is large)

## Configuration

No new configuration needed. Uses existing settings:
- `dedup_historical_lookback_days` (default: 3)
- `dedup_strictness_threshold` (default: 0.80)

## Deployment Notes

1. This fix requires NO database changes
2. This fix requires NO migration
3. Existing duplicate_groups and duplicate_posts tables work as-is
4. Next workflow run will use new logic automatically

## Monitoring

After deployment, monitor:
- Deduplication logs: `[DEDUP] Fetched X historical posts`
- Stage 2 matches: `Historical title match: "..."`
- Stage 3 matches: `Historical AI match: "..."`

## Related Files

- `src/lib/deduplicator.ts` - Main fix
- `src/lib/rss-processor.ts` - Orchestrates deduplication (unchanged)
- `src/lib/workflows/process-rss-workflow.ts` - Calls deduplication (unchanged)
