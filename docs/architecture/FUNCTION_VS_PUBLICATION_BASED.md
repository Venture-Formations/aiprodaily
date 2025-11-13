# Function-Based vs. Publication-Based Architecture

**Document Version:** 1.0
**Date:** 2025-11-12
**Purpose:** Compare function-based and publication-based file organization

---

## Executive Summary

This document compares two organizational approaches:

1. **Publication-Based** (Previously Recommended)
   - Organize by business domain first (publication)
   - Then by technical function (workflows, ads, content)

2. **Function-Based** (This Document)
   - Organize by technical function first (workflows, ads, content)
   - Then by publication

**Key Decision:** Which dimension matters more for your navigation and mental model?

---

## Table of Contents

1. [Function-Based Structure](#1-function-based-structure)
2. [Core Functions Defined](#2-core-functions-defined)
3. [Detailed Comparison](#3-detailed-comparison)
4. [Code Examples](#4-code-examples)
5. [Navigation Patterns](#5-navigation-patterns)
6. [Hybrid Approach](#6-hybrid-approach)
7. [Recommendation](#7-recommendation)

---

## 1. Function-Based Structure

### 1.1 Complete File Tree

```
AI_Pros_Newsletter/
│
├── 📁 platform/                    # Shared infrastructure (same as before)
│   ├── database/
│   ├── ai/
│   ├── email/
│   └── ...
│
├── 📁 functions/                   # 🆕 Function-based organization
│   │
│   ├── 📁 workflows/               # All workflow implementations
│   │   ├── 📁 ai-news-daily/
│   │   │   ├── ingest.ts
│   │   │   ├── process.ts
│   │   │   ├── publish.ts
│   │   │   └── breaking-news.ts
│   │   │
│   │   ├── 📁 local-digest/
│   │   │   ├── scrape.ts          # Different workflow entirely
│   │   │   ├── geocode.ts
│   │   │   ├── process.ts
│   │   │   └── publish.ts
│   │   │
│   │   ├── 📁 _shared/             # Shared workflow utilities
│   │   │   ├── base-workflow.ts
│   │   │   └── workflow-helpers.ts
│   │   │
│   │   └── 📄 index.ts             # Export workflow loader
│   │
│   ├── 📁 ads/                     # All ad management
│   │   ├── 📁 ai-news-daily/
│   │   │   ├── scheduler.ts       # Position-based rotation
│   │   │   ├── pricing.ts
│   │   │   └── tracking.ts
│   │   │
│   │   ├── 📁 local-digest/
│   │   │   ├── scheduler.ts       # Monthly sponsor model
│   │   │   └── pricing.ts
│   │   │
│   │   ├── 📁 _shared/
│   │   │   ├── base-scheduler.ts  # Platform base class
│   │   │   └── ad-types.ts
│   │   │
│   │   └── 📄 index.ts
│   │
│   ├── 📁 content/                 # All content strategy
│   │   ├── 📁 ai-news-daily/
│   │   │   ├── scoring.ts         # Novelty + relevance
│   │   │   ├── selection.ts       # Top 5 articles
│   │   │   ├── templates.ts       # Email HTML
│   │   │   └── generators/
│   │   │       ├── summary.ts
│   │   │       ├── headline.ts
│   │   │       └── advertorial.ts
│   │   │
│   │   ├── 📁 local-digest/
│   │   │   ├── scoring.ts         # Locality + timeliness
│   │   │   ├── selection.ts       # Top 10 articles
│   │   │   └── templates.ts
│   │   │
│   │   ├── 📁 _shared/
│   │   │   ├── base-scorer.ts
│   │   │   └── template-helpers.ts
│   │   │
│   │   └── 📄 index.ts
│   │
│   ├── 📁 sources/                 # All content sources
│   │   ├── 📁 ai-news-daily/
│   │   │   ├── rss-feeds.ts       # AI/ML feeds
│   │   │   └── api-sources.ts
│   │   │
│   │   ├── 📁 local-digest/
│   │   │   ├── local-sites.ts     # Local news sites
│   │   │   └── scrapers.ts
│   │   │
│   │   └── 📁 _shared/
│   │       └── source-types.ts
│   │
│   ├── 📁 configuration/           # All publication configs
│   │   ├── 📁 ai-news-daily/
│   │   │   ├── config.ts          # All settings
│   │   │   ├── features.ts        # Feature flags
│   │   │   └── branding.ts        # Brand assets
│   │   │
│   │   ├── 📁 local-digest/
│   │   │   ├── config.ts
│   │   │   └── branding.ts
│   │   │
│   │   ├── 📁 _shared/
│   │   │   ├── config-schema.ts   # Config validation
│   │   │   └── defaults.ts
│   │   │
│   │   └── 📄 loader.ts            # Config loader utility
│   │
│   ├── 📁 analytics/               # All analytics implementations
│   │   ├── 📁 ai-news-daily/
│   │   │   ├── metrics.ts
│   │   │   └── reports.ts
│   │   │
│   │   ├── 📁 local-digest/
│   │   │   └── metrics.ts
│   │   │
│   │   └── 📁 _shared/
│   │       └── analytics-base.ts
│   │
│   ├── 📁 notifications/           # All notification logic
│   │   ├── 📁 ai-news-daily/
│   │   │   ├── email-triggers.ts
│   │   │   └── slack-alerts.ts
│   │   │
│   │   └── 📁 _shared/
│   │       └── notification-base.ts
│   │
│   └── 📁 _templates/              # Templates for new publications
│       ├── workflows/
│       ├── ads/
│       ├── content/
│       └── configuration/
│
├── 📁 src/app/                     # Next.js application
│   ├── 📁 api/
│   │   ├── 📁 publications/[pubId]/
│   │   │   ├── 📁 workflows/
│   │   │   │   └── 📁 [workflowName]/
│   │   │   │       └── route.ts
│   │   │   ├── 📁 ads/
│   │   │   └── 📁 content/
│   │   │
│   │   └── 📁 cron/
│   │       └── 📁 [pubId]/
│   │           └── 📁 [functionName]/
│   │               └── route.ts
│   │
│   └── 📁 dashboard/[pubId]/
│
└── 📁 shared/                      # Shared UI (same as before)
    ├── components/
    ├── hooks/
    └── utils/
```

### 1.2 Visual Comparison

```
┌─────────────────────────────────────────────────────────────────┐
│ PUBLICATION-BASED (Previously Proposed)                         │
└─────────────────────────────────────────────────────────────────┘

publications/
  ├─ ai-news-daily/                 ← Group by PUBLICATION
  │   ├─ workflows/
  │   │   ├─ ingest.ts
  │   │   ├─ process.ts
  │   │   └─ publish.ts
  │   ├─ ads/
  │   │   └─ scheduler.ts
  │   ├─ content/
  │   │   ├─ scoring.ts
  │   │   └─ templates.ts
  │   └─ config.ts
  │
  └─ local-digest/
      ├─ workflows/
      ├─ ads/
      └─ content/


┌─────────────────────────────────────────────────────────────────┐
│ FUNCTION-BASED (This Document)                                  │
└─────────────────────────────────────────────────────────────────┘

functions/
  ├─ workflows/                     ← Group by FUNCTION
  │   ├─ ai-news-daily/
  │   │   ├─ ingest.ts
  │   │   ├─ process.ts
  │   │   └─ publish.ts
  │   └─ local-digest/
  │       ├─ scrape.ts
  │       └─ process.ts
  │
  ├─ ads/
  │   ├─ ai-news-daily/
  │   │   └─ scheduler.ts
  │   └─ local-digest/
  │       └─ scheduler.ts
  │
  └─ content/
      ├─ ai-news-daily/
      │   ├─ scoring.ts
      │   └─ templates.ts
      └─ local-digest/
          └─ scoring.ts
```

---

## 2. Core Functions Defined

### 2.1 Primary Functions

These are the main business capabilities that publications implement:

#### 1. **Workflows** (`functions/workflows/`)

**Purpose:** Orchestrate how content moves through the system

**Sub-functions:**
- **Ingest:** How to get content into the system
- **Process:** How to select and prepare content
- **Publish:** How to send newsletters
- **Breaking News:** How to handle urgent content (optional)
- **Manual Review:** How to handle human-in-the-loop (optional)

**Why separate:**
- Most complex function (multi-step processes)
- Most publication-specific variation
- Core business logic

**Example variations:**
```typescript
// AI News Daily: RSS-based workflow
workflows/ai-news-daily/ingest.ts

// Local Digest: Scraping-based workflow
workflows/local-digest/scrape.ts
```

---

#### 2. **Ads** (`functions/ads/`)

**Purpose:** Manage advertisement selection and placement

**Sub-functions:**
- **Scheduling:** Which ads appear in which positions
- **Rotation:** How ads rotate over time
- **Pricing:** Cost per position/period
- **Tracking:** Click tracking and reporting
- **Payment:** Payment processing (optional per pub)

**Why separate:**
- Complex monetization logic
- Different models per publication
- Financial implications

**Example variations:**
```typescript
// AI News Daily: Position-based rotation (3 positions)
ads/ai-news-daily/scheduler.ts

// Local Digest: Monthly sponsor model (1 position)
ads/local-digest/scheduler.ts
```

---

#### 3. **Content** (`functions/content/`)

**Purpose:** Content strategy (scoring, selection, generation)

**Sub-functions:**
- **Scoring:** How to rank/score articles
- **Selection:** How many articles, which ones
- **Templates:** Email HTML templates
- **Generators:** AI content generation (summaries, headlines)
- **Validation:** Content quality checks

**Why separate:**
- Editorial logic separate from workflows
- Different criteria per publication
- Content is the product

**Example variations:**
```typescript
// AI News Daily: Novelty + relevance scoring
content/ai-news-daily/scoring.ts

// Local Digest: Locality + timeliness scoring
content/local-digest/scoring.ts
```

---

#### 4. **Sources** (`functions/sources/`)

**Purpose:** Define where content comes from

**Sub-functions:**
- **RSS Feeds:** Feed URLs and configurations
- **Scrapers:** Web scraping configurations
- **APIs:** Third-party API integrations
- **Manual:** Manual submission handling

**Why separate:**
- Source definitions are data, not logic
- Easier to add/remove sources
- Can be managed by non-developers

**Example variations:**
```typescript
// AI News Daily: 20+ AI/ML RSS feeds
sources/ai-news-daily/rss-feeds.ts

// Local Digest: 10 local news sites to scrape
sources/local-digest/local-sites.ts
```

---

#### 5. **Configuration** (`functions/configuration/`)

**Purpose:** All publication settings in one place

**Sub-functions:**
- **Core Config:** Basic settings (name, schedule, features)
- **Branding:** Colors, logos, domains
- **Features:** Feature flags per publication
- **Limits:** Rate limits, quotas, budgets
- **Integrations:** API keys, service configs

**Why separate:**
- Settings used across multiple functions
- Clear place to find "how is this pub configured?"
- Can validate against schema

**Example structure:**
```typescript
// configuration/ai-news-daily/config.ts
export const config = {
  id: 'ai-news-daily',
  name: 'AI News Daily',
  schedule: { ingest: '0 */4 * * *', ... },
  content: { articlesPerIssue: 5, ... },
  ads: { positions: ['top', 'middle', 'bottom'], ... },
  branding: { primaryColor: '#2563eb', ... },
  features: { breakingNews: true, polls: true, ... },
};
```

---

#### 6. **Analytics** (`functions/analytics/`)

**Purpose:** Track and report publication performance

**Sub-functions:**
- **Metrics:** What to measure (opens, clicks, conversions)
- **Reports:** How to present data
- **Dashboards:** Custom dashboard views
- **Alerts:** Performance alerts (drop in opens, etc.)

**Why separate:**
- Different KPIs per publication
- Custom reporting needs
- Separate concern from content logic

---

#### 7. **Notifications** (`functions/notifications/`)

**Purpose:** How to notify team about events

**Sub-functions:**
- **Email Triggers:** When to send internal emails
- **Slack Alerts:** Slack notifications
- **SMS:** SMS alerts (optional)
- **Webhooks:** External webhooks

**Why separate:**
- Different notification preferences per pub
- Not core business logic
- Easy to add/modify

---

### 2.2 Supporting Functions

These are less publication-specific but still organized by function:

#### 8. **API Handlers** (`functions/api/`)

**Purpose:** Publication-specific API endpoints

**Why separate:** Custom endpoints per publication

---

#### 9. **Jobs** (`functions/jobs/`)

**Purpose:** Background job definitions

**Why separate:** Different job schedules per publication

---

#### 10. **Validators** (`functions/validators/`)

**Purpose:** Publication-specific validation rules

**Why separate:** Different data requirements per publication

---

### 2.3 Function Hierarchy

```
Functions (Business Capabilities)
  └─ Publications (Implementations)
      └─ Sub-modules (Specific behaviors)

Example:
functions/
  └─ workflows/                    ← Function
      └─ ai-news-daily/            ← Publication
          ├─ ingest.ts             ← Sub-module
          ├─ process.ts
          └─ publish.ts
```

---

## 3. Detailed Comparison

### 3.1 Side-by-Side

| Aspect | Publication-Based | Function-Based |
|--------|------------------|----------------|
| **Top-level organization** | By publication | By function |
| **Mental model** | "All code for AI News" | "All workflows across pubs" |
| **Navigation** | "Go to ai-news-daily/" | "Go to workflows/" |
| **Adding publication** | Create new pub folder | Add to each function folder |
| **Comparing implementations** | Harder (different folders) | Easier (same folder) |
| **Code reuse discovery** | Harder | Easier |
| **Team ownership** | Publication teams | Function teams |
| **File path length** | `publications/ai-news/workflows/ingest.ts` | `functions/workflows/ai-news/ingest.ts` |
| **Shared utilities** | In each publication | In `_shared/` subfolder |

---

### 3.2 Navigation Scenarios

#### Scenario 1: "I need to update the scoring algorithm for AI News Daily"

**Publication-Based:**
```
1. Go to publications/ai-news-daily/
2. See all AI News code
3. Navigate to content/scoring.ts
4. Edit scoring.ts

Path: publications/ai-news-daily/content/scoring.ts
Steps: 2 directory levels
```

**Function-Based:**
```
1. Go to functions/content/
2. See all scoring implementations
3. Navigate to ai-news-daily/scoring.ts
4. Edit scoring.ts

Path: functions/content/ai-news-daily/scoring.ts
Steps: 2 directory levels
```

**Winner:** Tie (same steps, different mental model)

---

#### Scenario 2: "I need to see all workflows for AI News Daily"

**Publication-Based:**
```
1. Go to publications/ai-news-daily/workflows/
2. See: ingest.ts, process.ts, publish.ts, breaking-news.ts

All AI News workflows in one folder ✅
```

**Function-Based:**
```
1. Go to functions/workflows/ai-news-daily/
2. See: ingest.ts, process.ts, publish.ts, breaking-news.ts

All AI News workflows in one folder ✅
```

**Winner:** Tie (identical)

---

#### Scenario 3: "How does scoring work across all publications?"

**Publication-Based:**
```
1. Open publications/ai-news-daily/content/scoring.ts
2. Open publications/local-digest/content/scoring.ts
3. Compare in side-by-side editors

Must navigate to multiple publications ❌
```

**Function-Based:**
```
1. Go to functions/content/
2. See:
   - ai-news-daily/scoring.ts
   - local-digest/scoring.ts
3. Compare in same folder

All scoring implementations visible together ✅
```

**Winner:** Function-Based

---

#### Scenario 4: "I want to understand everything about AI News Daily"

**Publication-Based:**
```
1. Go to publications/ai-news-daily/
2. See entire folder structure:
   - workflows/
   - ads/
   - content/
   - sources/
   - config.ts

Everything in one place ✅
Clear boundary ✅
```

**Function-Based:**
```
1. Search for "ai-news-daily" across codebase
2. Find in:
   - functions/workflows/ai-news-daily/
   - functions/ads/ai-news-daily/
   - functions/content/ai-news-daily/
   - functions/sources/ai-news-daily/
   - functions/configuration/ai-news-daily/

Scattered across folders ❌
No single place to see everything ❌
```

**Winner:** Publication-Based

---

#### Scenario 5: "I'm building a new 'Ad Scheduler' and want to see existing patterns"

**Publication-Based:**
```
1. Open publications/ai-news-daily/ads/scheduler.ts
2. Open publications/local-digest/ads/scheduler.ts
3. Scattered across publications
4. Have to know which publications exist

Must search multiple folders ❌
```

**Function-Based:**
```
1. Go to functions/ads/
2. See:
   - ai-news-daily/scheduler.ts
   - local-digest/scheduler.ts
   - _shared/base-scheduler.ts
3. All ad schedulers in one place
4. Immediately see patterns and base class

All examples together ✅
Discover shared base class ✅
```

**Winner:** Function-Based

---

#### Scenario 6: "Which publications use breaking news?"

**Publication-Based:**
```
1. Search for "breaking-news" in publications/
2. Check each publication's config
3. No single view

Must search ❌
```

**Function-Based:**
```
1. Go to functions/workflows/
2. See which folders have breaking-news.ts:
   - ai-news-daily/breaking-news.ts ✓
   - local-digest/ (no breaking-news) ✗

Visual scan of one folder ✅
```

**Winner:** Function-Based

---

### 3.3 Pros & Cons

#### Publication-Based

**Pros:**
- ✅ **Clear ownership boundaries:** Each publication = one team
- ✅ **Easy to understand publication:** Everything in one place
- ✅ **Isolated changes:** Changes to one pub don't touch others
- ✅ **Easy to delete:** Remove entire publication = delete one folder
- ✅ **Mental model alignment:** Matches business structure (publications)
- ✅ **Deployment independence:** (If you implement per-pub deploy)

**Cons:**
- ❌ **Harder to compare implementations:** Must navigate between pubs
- ❌ **Harder to find patterns:** Shared patterns scattered
- ❌ **Code reuse discovery:** Don't know what's reusable
- ❌ **Function team coordination:** If you have a "workflows team", they touch many folders

---

#### Function-Based

**Pros:**
- ✅ **Easy to compare implementations:** All in one function folder
- ✅ **Easy to find patterns:** Patterns visible together
- ✅ **Code reuse obvious:** Shared code in `_shared/` subfolder
- ✅ **Function team coordination:** Workflows team owns one folder
- ✅ **Feature consistency:** Easier to ensure all pubs implement function similarly

**Cons:**
- ❌ **Scattered publication code:** AI News code across many folders
- ❌ **Harder to understand publication:** No single place to see everything
- ❌ **Ownership boundaries unclear:** Who owns `workflows/`?
- ❌ **Harder to delete publication:** Must remove from each function folder
- ❌ **Mental model mismatch:** Doesn't match business structure

---

### 3.4 Team Structure Implications

#### Publication Teams

If your team is organized by **publication** (AI News team, Local Digest team):

**Publication-Based:** ✅ **Perfect fit**
- Each team owns one top-level folder
- Clear boundaries
- Minimal coordination

**Function-Based:** ❌ **Awkward**
- Each team touches many top-level folders
- More coordination needed
- Less clear ownership

---

#### Function Teams

If your team is organized by **function** (Workflows team, Ads team, Content team):

**Publication-Based:** ❌ **Awkward**
- Workflows team touches every publication folder
- Less clear ownership
- More scattered

**Function-Based:** ✅ **Perfect fit**
- Each team owns one top-level folder
- Clear boundaries
- Easy to see all their work

---

#### Hybrid/Small Team

If you have a **small team** wearing multiple hats:

**Either works**, choose based on **primary navigation pattern**:
- If you think "I need to work on AI News today" → Publication-Based
- If you think "I need to work on workflows today" → Function-Based

---

## 4. Code Examples

### 4.1 Function-Based Implementation

#### Workflow Implementation

```typescript
// functions/workflows/ai-news-daily/ingest.ts
import { RSSParser, Deduplicator } from '@/platform/content';
import { loadConfig } from '@/functions/configuration';
import { getFeeds } from '@/functions/sources/ai-news-daily/rss-feeds';

export async function ingestWorkflow(pubId: string) {
  console.log(`[Workflow] Starting ingest for ${pubId}`);

  // Load configuration
  const config = await loadConfig(pubId);

  // Get RSS feeds for this publication
  const feeds = await getFeeds();

  // Use platform tools
  const parser = new RSSParser();
  const deduper = new Deduplicator(pubId);

  // Implementation...
  for (const feed of feeds) {
    const articles = await parser.parse(feed.url);
    const newArticles = await deduper.filter(articles);
    // ... store articles
  }

  return { articlesIngested: newArticles.length };
}
```

```typescript
// functions/workflows/local-digest/scrape.ts
import { WebScraper, Geocoder } from '@/platform/content';
import { loadConfig } from '@/functions/configuration';
import { getSites } from '@/functions/sources/local-digest/local-sites';

export async function scrapeWorkflow(pubId: string) {
  console.log(`[Workflow] Starting scrape for ${pubId}`);

  // Different implementation for Local Digest
  const config = await loadConfig(pubId);
  const sites = await getSites();

  const scraper = new WebScraper();
  const geocoder = new Geocoder();

  for (const site of sites) {
    const articles = await scraper.scrape(site.url, site.selectors);
    const geocoded = await geocoder.geocodeArticles(articles);
    // ... store articles
  }

  return { articlesScraped: articles.length };
}
```

#### Workflow Loader (Dynamic)

```typescript
// functions/workflows/index.ts
export async function loadWorkflow(pubId: string, workflowName: string) {
  try {
    // Dynamic import based on publication and workflow name
    const workflow = await import(`./${pubId}/${workflowName}`);
    return workflow[`${workflowName}Workflow`];
  } catch (error) {
    throw new Error(`Workflow ${workflowName} not found for ${pubId}`);
  }
}

// Usage in API route
// app/api/publications/[pubId]/workflows/[workflowName]/route.ts
import { loadWorkflow } from '@/functions/workflows';

export async function POST(req: Request, { params }) {
  const { pubId, workflowName } = params;

  const workflow = await loadWorkflow(pubId, workflowName);
  const result = await workflow(pubId);

  return Response.json(result);
}
```

---

#### Ad Scheduling

```typescript
// functions/ads/ai-news-daily/scheduler.ts
import { AdSchedulerBase } from '@/functions/ads/_shared/base-scheduler';
import { loadConfig } from '@/functions/configuration';

export class AINewsAdScheduler extends AdSchedulerBase {
  async assignAds(campaignId: string): Promise<AdAssignment[]> {
    const config = await loadConfig('ai-news-daily');

    // Position-based rotation
    const positions = config.ads.positions; // ['top', 'middle', 'bottom']
    const activeAds = await this.getActiveAds('ai-news-daily');

    return positions.map((position, index) => ({
      position,
      ad: activeAds[index % activeAds.length],
    }));
  }
}
```

```typescript
// functions/ads/local-digest/scheduler.ts
import { AdSchedulerBase } from '@/functions/ads/_shared/base-scheduler';

export class LocalDigestAdScheduler extends AdSchedulerBase {
  async assignAds(campaignId: string): Promise<AdAssignment[]> {
    // Monthly sponsor model
    const sponsor = await this.getMonthSponsor('local-digest');

    return [
      { position: 'sponsor', ad: sponsor }
    ];
  }
}
```

```typescript
// functions/ads/_shared/base-scheduler.ts
export abstract class AdSchedulerBase {
  abstract assignAds(campaignId: string): Promise<AdAssignment[]>;

  protected async getActiveAds(pubId: string) {
    // Shared logic
    return db.from('advertisements')
      .select('*')
      .eq('newsletter_id', pubId)
      .eq('status', 'active');
  }

  protected async getMonthSponsor(pubId: string) {
    // Shared logic
    return db.from('advertisements')
      .select('*')
      .eq('newsletter_id', pubId)
      .eq('type', 'monthly_sponsor')
      .single();
  }
}
```

#### Ad Loader

```typescript
// functions/ads/index.ts
export async function loadAdScheduler(pubId: string) {
  const module = await import(`./${pubId}/scheduler`);

  // Get the scheduler class (naming convention)
  const className = pubId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('') + 'AdScheduler';

  return new module[className]();
}

// Usage
const scheduler = await loadAdScheduler('ai-news-daily');
const ads = await scheduler.assignAds(campaignId);
```

---

#### Content Scoring

```typescript
// functions/content/ai-news-daily/scoring.ts
import { BaseScoringStrategy } from '@/functions/content/_shared/base-scorer';
import { loadConfig } from '@/functions/configuration';

export class AINewsScoring extends BaseScoringStrategy {
  async scoreArticles(articles: Article[]): Promise<ScoredArticle[]> {
    const config = await loadConfig('ai-news-daily');
    const weights = config.content.scoringWeights;

    return articles.map(article => {
      const noveltyScore = this.calculateNovelty(article);
      const relevanceScore = this.calculateRelevance(article);
      const engagementScore = this.calculateEngagement(article);

      const score =
        noveltyScore * weights.novelty +
        relevanceScore * weights.relevance +
        engagementScore * weights.engagement;

      return { ...article, score, noveltyScore, relevanceScore, engagementScore };
    });
  }

  private calculateNovelty(article: Article): number {
    // AI News specific: how recent is the article?
    const ageHours = (Date.now() - new Date(article.publishedAt).getTime()) / (1000 * 60 * 60);
    return Math.max(0, 1 - (ageHours / 24));
  }

  private calculateRelevance(article: Article): number {
    // AI News specific: contains AI keywords?
    const keywords = ['AI', 'machine learning', 'deep learning', 'neural network'];
    const text = `${article.title} ${article.content}`.toLowerCase();
    const matches = keywords.filter(kw => text.includes(kw.toLowerCase())).length;
    return Math.min(1, matches / 3);
  }
}
```

```typescript
// functions/content/local-digest/scoring.ts
import { BaseScoringStrategy } from '@/functions/content/_shared/base-scorer';

export class LocalDigestScoring extends BaseScoringStrategy {
  async scoreArticles(articles: Article[]): Promise<ScoredArticle[]> {
    return articles.map(article => {
      const localityScore = this.calculateLocality(article);
      const timelinessScore = this.calculateTimeliness(article);
      const communityScore = this.calculateCommunityImpact(article);

      const score =
        localityScore * 0.5 +
        timelinessScore * 0.3 +
        communityScore * 0.2;

      return { ...article, score, localityScore, timelinessScore, communityScore };
    });
  }

  private calculateLocality(article: Article): number {
    // Local Digest specific: proximity to user's location
    // (Assumes article has geocoded location)
    const userLocation = { lat: 40.7128, lng: -74.0060 }; // NYC
    const distance = this.haversineDistance(userLocation, article.location);
    return Math.max(0, 1 - (distance / 50)); // 50 mile radius
  }
}
```

```typescript
// functions/content/_shared/base-scorer.ts
export abstract class BaseScoringStrategy {
  abstract scoreArticles(articles: Article[]): Promise<ScoredArticle[]>;

  // Shared utility methods
  protected calculateEngagement(article: Article): number {
    const shares = article.socialShares || 0;
    const comments = article.comments || 0;
    return Math.min(1, (shares + comments * 2) / 100);
  }

  protected haversineDistance(point1: Location, point2: Location): number {
    // Shared distance calculation
    // ... haversine formula
  }
}
```

---

#### Configuration

```typescript
// functions/configuration/ai-news-daily/config.ts
export const config = {
  id: 'ai-news-daily',
  name: 'AI News Daily',

  schedule: {
    ingest: '0 */4 * * *',
    process: '0 6 * * 1-5',
    sendReview: '0 7 * * 1-5',
    sendFinal: '0 8 * * 1-5',
  },

  content: {
    articlesPerIssue: 5,
    secondaryArticles: 3,
    pollsPerIssue: 1,
    advertorialsPerIssue: 2,
    scoringWeights: {
      novelty: 0.3,
      relevance: 0.4,
      engagement: 0.3,
    },
  },

  ads: {
    enabled: true,
    positions: ['top', 'middle', 'bottom'],
    pricing: { top: 500, middle: 300, bottom: 200 },
    rotationStrategy: 'position-based',
  },

  branding: {
    primaryColor: '#2563eb',
    secondaryColor: '#60a5fa',
    logo: '/logos/ai-news-daily.png',
    domain: 'ainewsdaily.com',
  },

  email: {
    fromName: 'AI News Daily',
    fromEmail: 'newsletter@ainewsdaily.com',
    mailerliteGroupId: '123456789',
  },

  features: {
    rss: true,
    breakingNews: true,
    ads: true,
    polls: true,
    manualSubmissions: false,
    aiApps: true,
  },
};
```

```typescript
// functions/configuration/loader.ts
import { validateConfig } from './_shared/config-schema';

export async function loadConfig(pubId: string) {
  // Load config from code
  const configModule = await import(`./${pubId}/config`);
  let config = configModule.config;

  // Validate
  config = validateConfig(config);

  // Override with database values (for runtime changes)
  const dbSettings = await db
    .from('app_settings')
    .select('*')
    .eq('newsletter_id', pubId);

  for (const setting of dbSettings) {
    config[setting.key] = JSON.parse(setting.value);
  }

  return config;
}
```

---

### 4.2 API Routes with Function-Based

```typescript
// app/api/publications/[pubId]/workflows/[workflowName]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { loadWorkflow } from '@/functions/workflows';
import { WorkflowExecutor } from '@/platform/workflow-engine';

export async function POST(
  req: NextRequest,
  { params }: { params: { pubId: string; workflowName: string } }
) {
  const { pubId, workflowName } = params;

  // Load workflow dynamically
  const workflow = await loadWorkflow(pubId, workflowName);

  // Execute
  const executor = new WorkflowExecutor();
  const result = await executor.execute(pubId, workflowName, workflow);

  return NextResponse.json(result);
}
```

```typescript
// app/api/publications/[pubId]/ads/assign/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { loadAdScheduler } from '@/functions/ads';

export async function POST(
  req: NextRequest,
  { params }: { params: { pubId: string } }
) {
  const { pubId } = params;
  const { campaignId } = await req.json();

  // Load ad scheduler dynamically
  const scheduler = await loadAdScheduler(pubId);
  const ads = await scheduler.assignAds(campaignId);

  return NextResponse.json({ ads });
}
```

---

## 5. Navigation Patterns

### 5.1 Developer Mental Models

#### "I work on AI News Daily" (Publication mindset)

**Publication-Based:** ✅ **Natural**
```
Today I'm working on AI News Daily.

1. Open publications/ai-news-daily/
2. See everything I need:
   - workflows/
   - ads/
   - content/
3. Stay in this folder all day
```

**Function-Based:** ❌ **Awkward**
```
Today I'm working on AI News Daily.

1. Need to update workflow → functions/workflows/ai-news-daily/
2. Need to update ads → functions/ads/ai-news-daily/
3. Need to update scoring → functions/content/ai-news-daily/
4. Jump between many top-level folders
```

---

#### "I work on workflows" (Function mindset)

**Publication-Based:** ❌ **Awkward**
```
Today I'm working on workflows.

1. Need to see all workflows:
   - publications/ai-news-daily/workflows/
   - publications/local-digest/workflows/
   - publications/pub-3/workflows/
2. Jump between many top-level folders
```

**Function-Based:** ✅ **Natural**
```
Today I'm working on workflows.

1. Open functions/workflows/
2. See all workflow implementations:
   - ai-news-daily/
   - local-digest/
   - pub-3/
3. Stay in this folder all day
```

---

### 5.2 Common Tasks

#### Task: "Add a new publication"

**Publication-Based:**
```bash
# 1. Copy template
cp -r publications/_template/ publications/new-pub/

# 2. Customize in one place
cd publications/new-pub/
# Edit config.ts, workflows/, ads/, content/

# 3. Done!
# All new pub code is in one folder
```

**Function-Based:**
```bash
# 1. Add to each function
mkdir functions/workflows/new-pub/
mkdir functions/ads/new-pub/
mkdir functions/content/new-pub/
mkdir functions/sources/new-pub/
mkdir functions/configuration/new-pub/

# 2. Copy templates
cp functions/workflows/_template/* functions/workflows/new-pub/
cp functions/ads/_template/* functions/ads/new-pub/
cp functions/content/_template/* functions/content/new-pub/
# ... repeat for each function

# 3. Customize each
# Navigate to each function folder and edit

# New pub code is scattered
```

**Winner:** Publication-Based (simpler)

---

#### Task: "Compare how all publications handle ads"

**Publication-Based:**
```bash
# Open multiple folders
publications/ai-news-daily/ads/scheduler.ts
publications/local-digest/ads/scheduler.ts
publications/pub-3/ads/scheduler.ts

# Must know which publications exist
# Must navigate to each one
```

**Function-Based:**
```bash
# Open one folder
functions/ads/
  ├─ ai-news-daily/scheduler.ts
  ├─ local-digest/scheduler.ts
  └─ pub-3/scheduler.ts

# All ad implementations visible at once
# Easy to see patterns
```

**Winner:** Function-Based (easier comparison)

---

#### Task: "Refactor shared workflow logic"

**Publication-Based:**
```bash
# 1. Create shared utility (where?)
publications/_shared/workflow-helpers.ts  # Awkward

# Or
src/lib/workflow-helpers.ts  # Also awkward

# 2. Update each publication
publications/ai-news-daily/workflows/ingest.ts
publications/local-digest/workflows/scrape.ts
# ... update imports in each
```

**Function-Based:**
```bash
# 1. Create shared utility (natural location)
functions/workflows/_shared/workflow-helpers.ts  # Clear!

# 2. Update each publication workflow
functions/workflows/ai-news-daily/ingest.ts
functions/workflows/local-digest/scrape.ts
# All in same parent folder - easy to see what needs updating
```

**Winner:** Function-Based (clearer shared code location)

---

#### Task: "Delete a publication"

**Publication-Based:**
```bash
# Simple!
rm -rf publications/ai-news-daily/

# All gone
```

**Function-Based:**
```bash
# Must delete from each function
rm -rf functions/workflows/ai-news-daily/
rm -rf functions/ads/ai-news-daily/
rm -rf functions/content/ai-news-daily/
rm -rf functions/sources/ai-news-daily/
rm -rf functions/configuration/ai-news-daily/
rm -rf functions/analytics/ai-news-daily/
# ... must remember all locations
# Risk of orphaned code
```

**Winner:** Publication-Based (simpler)

---

## 6. Hybrid Approach

### 6.1 The Best of Both Worlds?

Can we combine publication-based and function-based?

**Hybrid Structure:**

```
publications/
  ├─ ai-news-daily/
  │   ├─ config.ts              # Entry point
  │   └─ index.ts               # Exports everything
  │
  └─ local-digest/
      ├─ config.ts
      └─ index.ts

functions/
  ├─ workflows/
  │   ├─ ai-news-daily/
  │   └─ local-digest/
  ├─ ads/
  │   ├─ ai-news-daily/
  │   └─ local-digest/
  └─ content/
      ├─ ai-news-daily/
      └─ local-digest/
```

**How it works:**

```typescript
// publications/ai-news-daily/index.ts
// Acts as "facade" - imports from functions
export { ingestWorkflow } from '@/functions/workflows/ai-news-daily/ingest';
export { processWorkflow } from '@/functions/workflows/ai-news-daily/process';
export { AINewsAdScheduler } from '@/functions/ads/ai-news-daily/scheduler';
export { AINewsScoring } from '@/functions/content/ai-news-daily/scoring';
export { config } from '@/functions/configuration/ai-news-daily/config';

// Now you can import from publication
import { ingestWorkflow, config } from '@/publications/ai-news-daily';
```

**Benefits:**
- ✅ Can import from either location (flexibility)
- ✅ Publications act as "aggregators"
- ✅ Functions still organized for comparison

**Drawbacks:**
- ❌ Two ways to do everything (confusing)
- ❌ More folders and files
- ❌ Duplication (index.ts files)
- ❌ Not clear which is "source of truth"

**Verdict:** ❌ **Don't do this**
- Too complex
- Cognitive overhead
- "There should be one-- and preferably only one --obvious way to do it" (Zen of Python)

---

### 6.2 Pragmatic Middle Ground

Instead of duplicating structure, create **navigation helpers**:

```typescript
// lib/publication-index.ts
// Single file that helps navigate to publication code
export const publicationIndex = {
  'ai-news-daily': {
    config: () => import('@/functions/configuration/ai-news-daily/config'),
    workflows: {
      ingest: () => import('@/functions/workflows/ai-news-daily/ingest'),
      process: () => import('@/functions/workflows/ai-news-daily/process'),
    },
    ads: () => import('@/functions/ads/ai-news-daily/scheduler'),
    content: () => import('@/functions/content/ai-news-daily/scoring'),
  },
  'local-digest': {
    config: () => import('@/functions/configuration/local-digest/config'),
    workflows: {
      scrape: () => import('@/functions/workflows/local-digest/scrape'),
      process: () => import('@/functions/workflows/local-digest/process'),
    },
    ads: () => import('@/functions/ads/local-digest/scheduler'),
    content: () => import('@/functions/content/local-digest/scoring'),
  },
};

// Usage
const config = await publicationIndex['ai-news-daily'].config();
const workflow = await publicationIndex['ai-news-daily'].workflows.ingest();
```

**Benefits:**
- ✅ Single source of truth (function-based structure)
- ✅ Helper for "publication view"
- ✅ Type-safe navigation
- ✅ Easy to see what a publication implements

---

## 7. Recommendation

### 7.1 Choose Based On

#### Choose **Publication-Based** if:

- [x] Your team is organized by **publication** (AI News team, Local team)
- [x] You think in terms of "work on AI News today"
- [x] Publications are **very different** from each other
- [x] You want **clear ownership boundaries**
- [x] You want to **easily delete publications**
- [x] You want **independent deployment per publication** (future)
- [x] You have **3-10 publications**

**Your situation matches:** You have CLAUDE.md that's publication-centric, multi-tenant filtering suggests publication-first thinking

---

#### Choose **Function-Based** if:

- [ ] Your team is organized by **function** (Workflows team, Ads team)
- [ ] You think in terms of "work on workflows today"
- [ ] Publications are **similar** to each other (mostly same features)
- [ ] You want to **easily compare implementations**
- [ ] You want to **discover reusable patterns**
- [ ] You have **10+ publications** (patterns matter more)
- [ ] You have **function experts** who work across publications

---

### 7.2 Our Specific Recommendation

**For your project: Publication-Based** ✅

**Reasoning:**

1. **Your docs are publication-centric**
   - CLAUDE.md refers to "publications" as the main concept
   - Task router is by publication area
   - Multi-tenant filtering by `newsletter_id`

2. **Your mental model is publication-first**
   - "AI News Daily" is a product
   - Each publication is a business entity
   - Different publications may have different business models

3. **Small team initially**
   - Likely one team per publication
   - Clear ownership matters

4. **Publications are different enough**
   - AI News (RSS) vs Local (scraping) show different workflows
   - Different ad models mentioned
   - Different content strategies

5. **Future independence**
   - May want to deploy publications separately
   - May want to sell publications individually
   - Publication-based structure supports this

---

### 7.3 When to Reconsider

**Switch to Function-Based when:**

1. **You have 15+ publications** that are mostly the same
2. **You reorganize team by function** (Workflows team, Ads team, Content team)
3. **Most publications use same features** (less variation)
4. **You need to enforce consistency** across publications
5. **Function experts** work across many publications regularly

**Indicators it's time to switch:**
- "I'm the workflow expert and work on workflows across 10 publications"
- "Our publications are 90% identical, just different data"
- "I need to compare implementations constantly"
- "We reorganized into function teams"

---

### 7.4 Migration Path

If you start Publication-Based and need to switch to Function-Based:

```bash
# Automated refactor script
# scripts/refactor-to-function-based.sh

#!/bin/bash

# Move workflows
mkdir -p functions/workflows
for pub in publications/*/; do
  pub_name=$(basename "$pub")
  mv "$pub/workflows" "functions/workflows/$pub_name"
done

# Move ads
mkdir -p functions/ads
for pub in publications/*/; do
  pub_name=$(basename "$pub")
  mv "$pub/ads" "functions/ads/$pub_name"
done

# Continue for each function...

# Update all imports
find . -name "*.ts" -exec sed -i 's|@/publications/\([^/]*\)/workflows|@/functions/workflows/\1|g' {} +
find . -name "*.ts" -exec sed -i 's|@/publications/\([^/]*\)/ads|@/functions/ads/\1|g' {} +
```

**Effort:** ~1-2 days with automated refactoring

---

## 8. Summary Comparison Table

| Criteria | Publication-Based | Function-Based |
|----------|------------------|----------------|
| **Best for** | Publication-focused teams | Function-focused teams |
| **Mental model** | "Work on AI News" | "Work on workflows" |
| **Ownership** | Clear (one folder per pub) | Distributed (pub code scattered) |
| **Adding publication** | Easy (one folder) | Tedious (many folders) |
| **Deleting publication** | Easy (delete one folder) | Tedious (delete from each function) |
| **Comparing implementations** | Hard (multiple locations) | Easy (same folder) |
| **Finding patterns** | Hard (scattered) | Easy (visible together) |
| **Code reuse** | Less obvious | More obvious |
| **Independent deployment** | Easier to implement | Harder to implement |
| **Learning curve** | Lower (matches business) | Higher (technical organization) |
| **File path length** | Medium | Medium |
| **Best for 3-10 pubs** | ✅ Yes | Maybe |
| **Best for 10+ pubs** | Maybe | ✅ Yes |
| **Our recommendation** | ✅ **Choose this** | Reconsider later if needed |

---

## Final Verdict

**Use Publication-Based** for your newsletter platform because:

1. ✅ Matches your business structure (publications as products)
2. ✅ Better for small teams organized by publication
3. ✅ Clearer ownership boundaries
4. ✅ Easier to add/remove publications
5. ✅ Supports future independent deployment
6. ✅ Lower cognitive overhead

**Consider Function-Based** only if:
- You have 15+ publications that are very similar
- You reorganize team by function (unlikely)
- You need constant cross-publication comparison (unlikely early on)

**Hybrid Approach:** ❌ Don't do it - too complex

---

**Questions to finalize decision:**

1. How do you think about your day? "Work on AI News" or "Work on workflows"?
2. How is your team organized? By publication or by function?
3. How many publications in 2 years? 5? 20? 50?
4. Are publications very different or mostly the same?
5. Do you want to deploy publications independently someday?

If you answered "AI News", "publication", "5-20", "different", "yes" → **Publication-Based** ✅

---

**Document maintained by:** Architecture Team
**Related docs:**
- `PUBLICATION_AS_APP_ARCHITECTURE.md` - Main architecture doc
- `ARCHITECTURE_TREE_DIAGRAM.md` - Visual tree diagrams
- `BEST_PRACTICES_REVIEW.md` - Best practices analysis
