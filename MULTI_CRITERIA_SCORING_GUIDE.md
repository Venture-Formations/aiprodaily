# Multi-Criteria Scoring System Guide

**Version:** 2.0
**Last Updated:** 2025-01-07
**Audience:** Newsletter operators transitioning from combined to separated criteria

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Database Schema](#database-schema)
4. [How Scoring Works](#how-scoring-works)
5. [Weighting System](#weighting-system)
6. [AI Prompts & Configuration](#ai-prompts--configuration)
7. [Why Separate Criteria? (Benefits)](#why-separate-criteria-benefits)
8. [Migration Examples](#migration-examples)
9. [Implementation Details](#implementation-details)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The **Multi-Criteria Scoring System** evaluates RSS posts using **1 to 5 customizable criteria**, each with:

- **Independent AI evaluation** (separate API call per criterion)
- **Individual score** (0-10 scale)
- **AI reasoning** (explanation for each score)
- **Configurable weight** (multiplier for importance)
- **Flexible enabling** (turn criteria on/off without deleting)

### Current vs. Old Approach

| **Old Approach (Single Prompt)** | **New Approach (Separated Criteria)** |
|-----------------------------------|---------------------------------------|
| One AI call evaluates all criteria together | Separate AI call for each criterion |
| "Rate this post on relevance, timeliness, and quality" | 3 focused prompts, each targeting one dimension |
| Single reasoning blob | Detailed reasoning per criterion |
| Fixed weighting (usually equal) | Flexible, adjustable weights per criterion |
| Hard to tune individual criteria | Easy to refine one criterion without affecting others |
| All-or-nothing changes | Incremental improvements |

**Bottom Line:** Separation provides **granular control**, **better transparency**, and **easier optimization**.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    RSS POSTS (Raw Feed Data)                │
│  - id, title, description, content, full_article_text       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  SCORING PROCESS (Step 3)                   │
│                                                              │
│  For each enabled criterion (1-5):                          │
│    1. Load AI prompt from app_settings                      │
│    2. Call OpenAI with post content + criterion prompt      │
│    3. Receive: { score: 0-10, reason: "explanation" }       │
│    4. Store in post_ratings table                           │
│                                                              │
│  Batching: 3 posts at a time, 2s delay between batches      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              POST_RATINGS (Evaluation Results)              │
│                                                              │
│  - criteria_1_score, criteria_1_reason, criteria_1_weight   │
│  - criteria_2_score, criteria_2_reason, criteria_2_weight   │
│  - criteria_3_score, criteria_3_reason, criteria_3_weight   │
│  - criteria_4_score, criteria_4_reason, criteria_4_weight   │
│  - criteria_5_score, criteria_5_reason, criteria_5_weight   │
│  - total_score (weighted sum)                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              ARTICLES (Top-Ranked Content)                  │
│  Selected based on total_score, ranked for newsletter       │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### `post_ratings` Table

Stores AI evaluation results for each RSS post.

```sql
CREATE TABLE post_ratings (
  id UUID PRIMARY KEY,
  post_id UUID REFERENCES rss_posts(id),

  -- Criterion 1
  criteria_1_score INTEGER CHECK (criteria_1_score BETWEEN 0 AND 10),
  criteria_1_reason TEXT,
  criteria_1_weight DECIMAL(10,2),

  -- Criterion 2
  criteria_2_score INTEGER CHECK (criteria_2_score BETWEEN 0 AND 10),
  criteria_2_reason TEXT,
  criteria_2_weight DECIMAL(10,2),

  -- Criterion 3
  criteria_3_score INTEGER CHECK (criteria_3_score BETWEEN 0 AND 10),
  criteria_3_reason TEXT,
  criteria_3_weight DECIMAL(10,2),

  -- Criterion 4 (optional)
  criteria_4_score INTEGER CHECK (criteria_4_score BETWEEN 0 AND 10),
  criteria_4_reason TEXT,
  criteria_4_weight DECIMAL(10,2),

  -- Criterion 5 (optional)
  criteria_5_score INTEGER CHECK (criteria_5_score BETWEEN 0 AND 10),
  criteria_5_reason TEXT,
  criteria_5_weight DECIMAL(10,2),

  -- Calculated total
  total_score DECIMAL(10,2),

  -- Legacy fields (backward compatibility)
  interest_level INTEGER,
  local_relevance INTEGER,
  community_impact INTEGER,
  ai_reasoning TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_post_ratings_total_score ON post_ratings(total_score DESC);
CREATE INDEX idx_post_ratings_post_id_score ON post_ratings(post_id, total_score DESC);
```

### `app_settings` Table

Stores criteria configuration and AI prompts.

```sql
-- Example criteria configuration
INSERT INTO app_settings (key, value, newsletter_id) VALUES
  -- How many criteria are enabled (1-5)
  ('criteria_enabled_count', '3', 'newsletter-uuid'),

  -- Criterion 1 configuration
  ('criteria_1_name', 'Interest Level', 'newsletter-uuid'),
  ('criteria_1_weight', '1.5', 'newsletter-uuid'),
  ('ai_prompt_criteria_1', '<full AI prompt JSON>', 'newsletter-uuid'),

  -- Criterion 2 configuration
  ('criteria_2_name', 'Professional Relevance', 'newsletter-uuid'),
  ('criteria_2_weight', '1.5', 'newsletter-uuid'),
  ('ai_prompt_criteria_2', '<full AI prompt JSON>', 'newsletter-uuid'),

  -- Criterion 3 configuration
  ('criteria_3_name', 'Profession Impact', 'newsletter-uuid'),
  ('criteria_3_weight', '1.0', 'newsletter-uuid'),
  ('ai_prompt_criteria_3', '<full AI prompt JSON>', 'newsletter-uuid');
```

---

## How Scoring Works

### Step-by-Step Process

#### 1. **Configuration Loading**

The system fetches criteria configuration from `app_settings`:

```typescript
// Get enabled count
const enabledCount = 3  // From 'criteria_enabled_count' setting

// Get criteria details
const criteria = [
  { number: 1, name: 'Interest Level', weight: 1.5 },
  { number: 2, name: 'Professional Relevance', weight: 1.5 },
  { number: 3, name: 'Profession Impact', weight: 1.0 }
]
```

#### 2. **Sequential AI Evaluation**

For **each enabled criterion**, the system:

```typescript
for (const criterion of criteria) {
  // Load AI prompt for this criterion
  const promptKey = `ai_prompt_criteria_${criterion.number}`

  // Call AI with post content
  const result = await callAIWithPrompt(promptKey, newsletterId, {
    title: post.title,
    description: post.description,
    content: post.full_article_text
  })

  // Result: { score: 8, reason: "This article..." }
  criteriaScores.push({
    score: result.score,        // 0-10
    reason: result.reason,      // AI explanation
    weight: criterion.weight    // From settings
  })
}
```

**Important:** Each criterion gets its **own dedicated AI call** with a **focused prompt**.

#### 3. **Score Calculation**

After all criteria are evaluated:

```typescript
// Example scores
const criteriaScores = [
  { score: 8, weight: 1.5 },  // Criterion 1
  { score: 7, weight: 1.5 },  // Criterion 2
  { score: 6, weight: 1.0 }   // Criterion 3
]

// Calculate weighted sum
let totalWeightedScore = 0
criteriaScores.forEach(({ score, weight }) => {
  totalWeightedScore += score * weight
})

// Result:
// (8 × 1.5) + (7 × 1.5) + (6 × 1.0)
// = 12 + 10.5 + 6
// = 28.5

const total_score = 28.5  // Stored in post_ratings table
```

**Note:** The system uses the **raw weighted sum**, NOT normalized to 0-100.

#### 4. **Database Storage**

All results are stored in a single `post_ratings` record:

```sql
INSERT INTO post_ratings (
  post_id,
  criteria_1_score, criteria_1_reason, criteria_1_weight,
  criteria_2_score, criteria_2_reason, criteria_2_weight,
  criteria_3_score, criteria_3_reason, criteria_3_weight,
  total_score
) VALUES (
  'post-uuid',
  8, 'High interest due to unexpected insights...', 1.5,
  7, 'Directly relevant to accounting practice...', 1.5,
  6, 'Moderate impact on daily workflow...', 1.0,
  28.5
);
```

#### 5. **Ranking & Selection**

Posts are ranked by `total_score` (descending) for article generation:

```sql
SELECT rp.*, pr.total_score
FROM rss_posts rp
JOIN post_ratings pr ON rp.id = pr.post_id
WHERE rp.campaign_id = 'campaign-uuid'
ORDER BY pr.total_score DESC
LIMIT 6;  -- Top 6 posts become newsletter articles
```

---

## Weighting System

### What Are Weights?

Weights are **multipliers** that control how much each criterion contributes to the total score.

**Example:**

| Criterion | Weight | Meaning |
|-----------|--------|---------|
| Interest Level | **1.5** | 50% more important than baseline |
| Professional Relevance | **1.5** | 50% more important than baseline |
| Profession Impact | **1.0** | Baseline importance |

### Weight Impact on Total Score

**Scenario 1: All weights = 1.0 (equal importance)**

```
Criterion 1: 8 × 1.0 = 8
Criterion 2: 7 × 1.0 = 7
Criterion 3: 6 × 1.0 = 6
Total: 21
```

**Scenario 2: Different weights (emphasize criteria 1 & 2)**

```
Criterion 1: 8 × 1.5 = 12
Criterion 2: 7 × 1.5 = 10.5
Criterion 3: 6 × 1.0 = 6
Total: 28.5
```

**Impact:** Posts scoring high on criteria 1 & 2 rank higher, even if criterion 3 is lower.

### When to Adjust Weights

**Increase weight when:**
- Criterion is critical to content quality
- You want to prioritize certain aspects (e.g., relevance over engagement)
- Feedback shows this dimension matters most to readers

**Decrease weight when:**
- Criterion is secondary ("nice to have")
- Criterion is too strict and filtering out good content
- You want to balance overemphasis

### Default Weights (AI Accounting Daily Example)

```json
{
  "criteria_1_weight": 1.5,  // Interest Level (critical for engagement)
  "criteria_2_weight": 1.5,  // Professional Relevance (core mission)
  "criteria_3_weight": 1.0,  // Profession Impact (important but not always urgent)
  "criteria_4_weight": 1.0,  // (Disabled, placeholder)
  "criteria_5_weight": 1.0   // (Disabled, placeholder)
}
```

---

## AI Prompts & Configuration

### Prompt Structure

Each criterion has a **dedicated AI prompt** stored in `app_settings` as a **text value** (not JSON object like other prompts).

**Key:** `ai_prompt_criteria_1`
**Value:** (Plain text prompt)

```text
You are evaluating a newsletter article for INTEREST LEVEL to accounting professionals.

Your task is to score this article on a scale of 0-10 based on how interesting and engaging it is.

SCORING CRITERIA (0-10 scale):

HIGH SCORES (8-10):
- Unexpected developments or surprising insights
- Human interest stories with broad appeal
- Breaking news that will impact daily work
- Unique events or innovative solutions
- Fun, entertaining, or inspiring content
- Content that sparks conversation or curiosity

MEDIUM SCORES (4-7):
- Standard industry news
- Useful but routine updates
- Educational content with moderate appeal
- Business updates with some interest
- Typical professional development topics

LOW SCORES (0-3):
- Dry technical content
- Routine announcements with minimal appeal
- Purely administrative or procedural content
- Overly promotional material
- Repetitive topics recently covered
- Very niche content with limited broader interest

Article Title: {{title}}
Article Description: {{description}}
Article Content: {{content}}

IMPORTANT: You must respond with ONLY valid JSON. Do not include any text before or after the JSON.

Response format:
{
  "score": <integer 0-10>,
  "reason": "<detailed explanation of your scoring>"
}
```

**Placeholders:**
- `{{title}}` - Post title
- `{{description}}` - Post description/summary
- `{{content}}` - Full extracted article text

### How AI Calls Work

```typescript
// System loads prompt from database
const promptKey = 'ai_prompt_criteria_1'

// Replaces placeholders with actual content
const result = await callAIWithPrompt(promptKey, newsletterId, {
  title: "IRS Announces New Tax Deadline Extension",
  description: "The IRS has extended filing deadlines...",
  content: "<full article text>"
})

// AI returns structured response
// result = {
//   score: 8,
//   reason: "High interest due to immediate impact on filing season..."
// }
```

### Criteria Configuration in `app_settings`

**For each criterion (1-5):**

| Setting Key | Example Value | Purpose |
|-------------|---------------|---------|
| `criteria_1_name` | "Interest Level" | Display name in UI |
| `criteria_1_weight` | "1.5" | Importance multiplier |
| `ai_prompt_criteria_1` | `<full prompt text>` | AI evaluation instructions |

**Global setting:**

| Setting Key | Example Value | Purpose |
|-------------|---------------|---------|
| `criteria_enabled_count` | "3" | How many criteria are active (1-5) |

---

## Why Separate Criteria? (Benefits)

### Problem with Combined Criteria (Old Approach)

**Example of a combined prompt:**

```
Rate this article on:
1. Relevance to our audience
2. Timeliness
3. Quality of content

Provide a score for each (0-10) and overall reasoning.
```

**Issues:**

❌ **AI conflates dimensions** - One strong criterion can inflate others
❌ **Vague reasoning** - Hard to tell why a post scored 7 vs 8
❌ **No weight control** - All criteria treated equally
❌ **Difficult to tune** - Changing relevance criteria affects timeliness scoring
❌ **Inconsistent results** - AI interprets "relevance" differently across runs

### Benefits of Separated Criteria (New Approach)

✅ **Focused AI attention** - Each criterion gets dedicated evaluation
✅ **Granular reasoning** - See exactly why each dimension scored as it did
✅ **Independent tuning** - Refine one criterion without affecting others
✅ **Consistent scoring** - Specialized prompts reduce variability
✅ **Flexible weighting** - Adjust importance based on feedback
✅ **Better transparency** - Understand what drives content selection
✅ **Easier optimization** - A/B test individual criteria

### Real-World Example

**Scenario:** You notice posts about regulatory changes (high relevance) are scoring low overall because they're dry (low interest).

**With combined criteria:**
```
Post: "New FASB Accounting Standard Update"
Combined Score: 5/10
Reasoning: "Highly relevant but dry and technical"
→ Can't easily fix - changing prompt affects all dimensions
```

**With separated criteria:**
```
Post: "New FASB Accounting Standard Update"
Criterion 1 (Interest): 4/10, weight 1.5 → 6.0
Criterion 2 (Relevance): 9/10, weight 1.5 → 13.5
Criterion 3 (Impact): 8/10, weight 1.0 → 8.0
Total: 27.5 → Ranks high due to relevance & impact

→ You can adjust weights or refine "Interest" prompt independently
```

**Result:** Important regulatory content ranks appropriately without manual intervention.

---

## Migration Examples

### Example 1: Three-Criteria Newsletter

**Old Approach (Single Prompt):**

```
Evaluate this article on:
1. Relevance to real estate professionals
2. Timeliness (breaking news, trending topics)
3. Actionability (can readers apply this?)

Provide scores 0-10 for each and combined reasoning.
```

**New Approach (Separated):**

**Criterion 1: Professional Relevance**
```
Key: ai_prompt_criteria_1
Name: Professional Relevance
Weight: 1.5

Prompt:
Score this article (0-10) on RELEVANCE to real estate professionals.

HIGH SCORES (8-10):
- Market trends and data
- Regulatory/legal changes affecting agents
- Commission structures and compensation
- MLS updates and technology for agents

[...detailed scoring guide...]

Response: { "score": 0-10, "reason": "..." }
```

**Criterion 2: Timeliness**
```
Key: ai_prompt_criteria_2
Name: Timeliness
Weight: 1.2

Prompt:
Score this article (0-10) on TIMELINESS.

HIGH SCORES (8-10):
- Breaking news published within 24 hours
- Trending topics in industry discussions
- Upcoming deadline or event within 7 days
- Seasonal/time-sensitive content

[...detailed scoring guide...]

Response: { "score": 0-10, "reason": "..." }
```

**Criterion 3: Actionability**
```
Key: ai_prompt_criteria_3
Name: Actionability
Weight: 1.0

Prompt:
Score this article (0-10) on ACTIONABILITY.

HIGH SCORES (8-10):
- Clear tactics agents can implement immediately
- Tools, scripts, or templates provided
- Step-by-step guides or how-tos
- Strategies with concrete examples

[...detailed scoring guide...]

Response: { "score": 0-10, "reason": "..." }
```

**Configuration in `app_settings`:**
```sql
INSERT INTO app_settings (newsletter_id, key, value) VALUES
  ('newsletter-uuid', 'criteria_enabled_count', '3'),
  ('newsletter-uuid', 'criteria_1_name', 'Professional Relevance'),
  ('newsletter-uuid', 'criteria_1_weight', '1.5'),
  ('newsletter-uuid', 'criteria_2_name', 'Timeliness'),
  ('newsletter-uuid', 'criteria_2_weight', '1.2'),
  ('newsletter-uuid', 'criteria_3_name', 'Actionability'),
  ('newsletter-uuid', 'criteria_3_weight', '1.0');
```

### Example 2: Score Comparison

**Sample Article:** "New NAR Settlement Changes Agent Commission Disclosure Rules"

**Old System (Combined):**
```json
{
  "relevance": 9,
  "timeliness": 8,
  "actionability": 7,
  "overall_score": 8,
  "reasoning": "Highly relevant regulatory change, timely due to recent settlement, moderate actionability as implementation details pending."
}

→ Total: 24 (simple sum, no weighting)
```

**New System (Separated):**
```json
[
  {
    "criterion": "Professional Relevance",
    "score": 9,
    "weight": 1.5,
    "weighted_score": 13.5,
    "reason": "Critical regulatory change affecting all real estate agents. Directly impacts commission structures and disclosure requirements—core business operations."
  },
  {
    "criterion": "Timeliness",
    "score": 8,
    "weight": 1.2,
    "weighted_score": 9.6,
    "reason": "Settlement announced 3 days ago, ongoing industry discussions. Implementation deadline in 60 days—timely but not breaking."
  },
  {
    "criterion": "Actionability",
    "score": 6,
    "weight": 1.0,
    "weighted_score": 6.0,
    "reason": "General guidance available, but specific implementation steps not finalized. Agents should monitor but can't take immediate action yet."
  }
]

→ Total: 29.1 (weighted sum)
```

**Comparison:**

| Metric | Old System | New System | Benefit |
|--------|-----------|------------|---------|
| **Total Score** | 24 | 29.1 | Importance-weighted ranking |
| **Reasoning Depth** | 1 paragraph | 3 detailed explanations | Transparency |
| **Tuning Flexibility** | None | Adjust weights or individual prompts | Control |
| **Consistency** | Variable | Higher (focused prompts) | Reliability |

---

## Implementation Details

### File Structure

```
src/lib/rss-processor.ts
  ├── evaluatePost() - Main scoring orchestration
  │   ├── Loads criteria configuration from app_settings
  │   ├── Loops through enabled criteria (1-5)
  │   ├── Calls callAIWithPrompt() for each criterion
  │   ├── Calculates total_score (weighted sum)
  │   └── Returns ContentEvaluation object
  │
  └── scorePostsForSection() - Batch processing wrapper
      ├── Fetches posts for campaign
      ├── Processes in batches of 3 (2s delay)
      └── Inserts results into post_ratings table
```

### Key Code: `evaluatePost()`

```typescript
private async evaluatePost(post: RssPost, newsletterId: string): Promise<ContentEvaluation> {
  // 1. Fetch criteria configuration
  const { data: criteriaConfig } = await supabaseAdmin
    .from('app_settings')
    .select('key, value')
    .eq('newsletter_id', newsletterId)
    .or('key.eq.criteria_enabled_count,key.like.criteria_%_name,key.like.criteria_%_weight')

  // 2. Parse enabled count
  const enabledCount = parseInt(criteriaConfig.find(s => s.key === 'criteria_enabled_count')?.value || '3')

  // 3. Build criteria array
  const criteria = []
  for (let i = 1; i <= enabledCount; i++) {
    criteria.push({
      number: i,
      name: criteriaConfig.find(s => s.key === `criteria_${i}_name`)?.value || `Criteria ${i}`,
      weight: parseFloat(criteriaConfig.find(s => s.key === `criteria_${i}_weight`)?.value || '1.0')
    })
  }

  // 4. Evaluate each criterion
  const criteriaScores = []
  for (const criterion of criteria) {
    const result = await callAIWithPrompt(
      `ai_prompt_criteria_${criterion.number}`,
      newsletterId,
      {
        title: post.title,
        description: post.description || '',
        content: post.full_article_text || ''
      }
    )

    criteriaScores.push({
      score: result.score,
      reason: result.reason,
      weight: criterion.weight
    })
  }

  // 5. Calculate weighted total
  let totalWeightedScore = 0
  criteriaScores.forEach(({ score, weight }) => {
    totalWeightedScore += score * weight
  })

  // 6. Return results
  return {
    criteria_scores: criteriaScores,
    total_score: totalWeightedScore
  }
}
```

### Key Code: Database Insert

```typescript
const ratingRecord = {
  post_id: post.id,
  criteria_1_score: criteriaScores[0]?.score,
  criteria_1_reason: criteriaScores[0]?.reason,
  criteria_1_weight: criteriaScores[0]?.weight,
  criteria_2_score: criteriaScores[1]?.score,
  criteria_2_reason: criteriaScores[1]?.reason,
  criteria_2_weight: criteriaScores[1]?.weight,
  criteria_3_score: criteriaScores[2]?.score,
  criteria_3_reason: criteriaScores[2]?.reason,
  criteria_3_weight: criteriaScores[2]?.weight,
  total_score: totalWeightedScore
}

await supabaseAdmin
  .from('post_ratings')
  .insert([ratingRecord])
```

### Batching & Performance

**Configuration:**
```typescript
const BATCH_SIZE = 3        // Posts per batch
const BATCH_DELAY = 2000    // Milliseconds between batches
```

**Why batching?**
- Prevents OpenAI API rate limits (60 requests/minute for GPT-4)
- Reduces memory pressure from full article text processing
- Improves reliability (fewer timeouts)

**Example Timeline (12 posts, 3 criteria):**
```
Batch 1 (Posts 1-3):
  - 3 posts × 3 criteria = 9 AI calls
  - ~15 seconds total
  - 2 second delay

Batch 2 (Posts 4-6):
  - 3 posts × 3 criteria = 9 AI calls
  - ~15 seconds total
  - 2 second delay

Batch 3 (Posts 7-9):
  - 3 posts × 3 criteria = 9 AI calls
  - ~15 seconds total
  - 2 second delay

Batch 4 (Posts 10-12):
  - 3 posts × 3 criteria = 9 AI calls
  - ~15 seconds total

Total: ~70 seconds for 12 posts
```

---

## Troubleshooting

### Common Issues

#### 1. **Posts Scoring Lower Than Expected**

**Symptoms:**
- Posts that should rank high are getting low total_score
- Good content is being filtered out

**Diagnosis:**
```sql
-- Check individual criterion scores
SELECT
  post_id,
  criteria_1_score, criteria_1_weight,
  criteria_2_score, criteria_2_weight,
  criteria_3_score, criteria_3_weight,
  total_score
FROM post_ratings
WHERE post_id = 'low-scoring-post-uuid';
```

**Solutions:**
- **Adjust weights** - Increase weight on criteria that should matter more
- **Refine prompts** - Make scoring guidelines clearer
- **Review reasoning** - Check `criteria_X_reason` to understand AI logic

#### 2. **Inconsistent Scoring Across Similar Posts**

**Symptoms:**
- Nearly identical posts getting different scores
- Wide variance in scores for same topic

**Diagnosis:**
- Check if prompts have vague guidelines
- Look for overlapping criteria definitions

**Solutions:**
- **Add concrete examples** to prompts (HIGH/MEDIUM/LOW score samples)
- **Use numeric thresholds** where possible ("published within 24 hours = 8-10")
- **Separate overlapping dimensions** (e.g., "relevance" and "importance" might be redundant)

#### 3. **Criterion Always Scores High/Low**

**Symptoms:**
- Criterion 2 consistently scores 8-10 for all posts
- Criterion 3 rarely exceeds 5

**Diagnosis:**
```sql
-- Check score distribution for a criterion
SELECT
  criteria_2_score,
  COUNT(*) as count
FROM post_ratings
WHERE campaign_id = 'recent-campaign-uuid'
GROUP BY criteria_2_score
ORDER BY criteria_2_score;
```

**Solutions:**
- **Too easy/hard** - Adjust scoring guidelines to spread distribution
- **Wrong dimension** - Criterion might not be distinguishing content effectively
- **Consider disabling** - If criterion doesn't provide value, reduce to 2 criteria

#### 4. **Database Errors (Missing Criteria Columns)**

**Error:**
```
column "criteria_4_score" does not exist
```

**Solution:**
Run migration:
```sql
-- See: database_migrations/add_criteria_to_post_ratings.sql
ALTER TABLE post_ratings
ADD COLUMN IF NOT EXISTS criteria_4_score INTEGER CHECK (criteria_4_score BETWEEN 0 AND 10),
ADD COLUMN IF NOT EXISTS criteria_4_reason TEXT,
ADD COLUMN IF NOT EXISTS criteria_4_weight DECIMAL(10,2);
```

#### 5. **AI Returns Invalid Scores**

**Error:**
```
Criterion 2 score must be between 0-10, got 11
```

**Diagnosis:**
- AI is not following response format
- Prompt missing constraints

**Solution:**
Add explicit constraints to prompt:
```text
CRITICAL: Your score MUST be an integer between 0 and 10 (inclusive).
Scores outside this range will be rejected.

Response format:
{
  "score": <integer 0-10>,  // REQUIRED: Must be 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, or 10
  "reason": "<explanation>"
}
```

---

## Quick Reference

### Criteria Configuration Checklist

- [ ] Set `criteria_enabled_count` (1-5)
- [ ] For each enabled criterion:
  - [ ] Set `criteria_X_name` (display label)
  - [ ] Set `criteria_X_weight` (importance multiplier)
  - [ ] Create `ai_prompt_criteria_X` (evaluation instructions)
- [ ] Test with sample posts
- [ ] Review `total_score` distribution
- [ ] Adjust weights based on results

### SQL Quick Queries

**View recent scoring results:**
```sql
SELECT
  rp.title,
  pr.criteria_1_score, pr.criteria_1_weight,
  pr.criteria_2_score, pr.criteria_2_weight,
  pr.criteria_3_score, pr.criteria_3_weight,
  pr.total_score
FROM rss_posts rp
JOIN post_ratings pr ON rp.id = pr.post_id
WHERE rp.campaign_id = 'campaign-uuid'
ORDER BY pr.total_score DESC;
```

**Check criteria configuration:**
```sql
SELECT key, value, description
FROM app_settings
WHERE newsletter_id = 'newsletter-uuid'
  AND (key LIKE 'criteria_%' OR key LIKE 'ai_prompt_criteria_%')
ORDER BY key;
```

**Score distribution analysis:**
```sql
SELECT
  FLOOR(total_score / 5) * 5 as score_range,
  COUNT(*) as posts_count
FROM post_ratings pr
JOIN rss_posts rp ON pr.post_id = rp.id
WHERE rp.campaign_id = 'campaign-uuid'
GROUP BY FLOOR(total_score / 5)
ORDER BY score_range;
```

---

## Summary

The **Multi-Criteria Scoring System** provides:

✅ **Granular evaluation** - 1-5 independent criteria, each with dedicated AI analysis
✅ **Flexible weighting** - Control importance of each dimension
✅ **Transparent reasoning** - See exactly why posts ranked as they did
✅ **Easy optimization** - Tune criteria independently without affecting others
✅ **Better content selection** - More nuanced ranking than single-score systems

**Key Takeaway:** By separating criteria into focused evaluations with configurable weights, you gain **control, transparency, and consistency** in content scoring—leading to higher-quality newsletter curation.

---

**Questions or Issues?** Check the [Troubleshooting](#troubleshooting) section or review the implementation in `src/lib/rss-processor.ts`.
