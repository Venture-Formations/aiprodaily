# Publication-as-App Architecture: Comprehensive Analysis

**Document Version:** 1.0
**Date:** 2025-11-12
**Status:** Proposal
**Author:** Architecture Review

---

## Executive Summary

This document proposes a fundamental architectural shift from a **multi-tenant shared workflow** approach to a **publication-as-app** architecture. The goal is to enable independent evolution of each publication while maintaining shared infrastructure, reducing risk, and enabling team scaling.

**Key Decision:** Treat each publication as an isolated mini-application that uses shared platform services, rather than all publications sharing the same workflow logic.

**Expected Benefits:**
- Independent publication iteration and deployment
- Reduced risk of cascading failures
- Flexibility to support diverse publication types
- Clear ownership boundaries for team scaling
- Ability to experiment with different approaches per publication

**Migration Timeline:** 6 weeks for initial implementation and pattern establishment

---

## Table of Contents

1. [Core Architectural Philosophy](#1-core-architectural-philosophy)
2. [Layered Architecture Breakdown](#2-layered-architecture-breakdown)
3. [Migration Strategy](#3-migration-strategy)
4. [Branching Strategy](#4-branching-strategy)
5. [Implementation Examples](#5-implementation-examples)
6. [Decision Matrix](#6-decision-matrix)
7. [Appendix](#7-appendix)

---

## 1. Core Architectural Philosophy

### 1.1 The Fundamental Question

**Should publications share workflows or have independent implementations?**

This is the core architectural decision that affects everything else.

#### Option A: Multi-Tenant Shared Workflows (Current State)

```
One codebase → All publications use same logic → Filter by newsletter_id
```

**How it works:**
- Single workflow implementation
- All publications execute the same steps
- Differentiation via configuration and `newsletter_id` filtering
- Conditional logic for publication-specific behavior

**Example:**
```typescript
// Single workflow for all publications
async function processRSSWorkflow(newsletterId: string) {
  const articles = await fetchRSS(newsletterId);

  // Special case logic starts appearing
  if (newsletterId === 'ai-news-daily') {
    // AI News specific logic
  } else if (newsletterId === 'local-digest') {
    // Local Digest specific logic
  }

  await saveArticles(newsletterId, articles);
}
```

**Pros:**
- ✅ Less code duplication
- ✅ Bug fixes apply to all publications automatically
- ✅ Easier to understand (one workflow implementation)
- ✅ Faster development initially
- ✅ Single deployment pipeline
- ✅ Consistent behavior across publications

**Cons:**
- ❌ Inflexible: all publications must work the same way
- ❌ Feature flags proliferate: `if (pubId === 'special-case')`
- ❌ Breaking changes affect all publications simultaneously
- ❌ Can't experiment with different approaches per publication
- ❌ Coupling: publications can't evolve independently
- ❌ Testing complexity: must test all publication variations
- ❌ Performance: can't optimize per publication
- ❌ Deployment risk: one bad deploy breaks everything

**When to use:**
- Publications are truly variations (same workflow, different data)
- Small team, few publications (< 5)
- Publications will never diverge significantly
- Speed to market is priority over flexibility

---

#### Option B: Publication-as-App (Proposed)

```
Platform provides tools → Each publication defines its own workflows
```

**How it works:**
- Platform provides stable, reusable services (database, email, AI)
- Each publication implements its own workflows using platform tools
- Publications are isolated from each other
- Platform is infrastructure, publications are business logic

**Example:**
```typescript
// AI News Daily workflow
// publications/ai-news-daily/workflows/process.ts
export async function processWorkflow(pubId: string) {
  const rssParser = new RSSParser(); // Platform tool
  const articles = await rssParser.parse(myFeeds); // My feeds

  // My scoring logic
  const scored = await scoreByNovelty(articles);

  // My selection logic
  const selected = selectTop5(scored);

  return selected;
}

// Local Digest workflow (completely different)
// publications/local-digest/workflows/process.ts
export async function processWorkflow(pubId: string) {
  const scraper = new WebScraper(); // Platform tool
  const articles = await scraper.scrape(localSites); // My sites

  // My scoring logic (different criteria)
  const scored = await scoreByLocality(articles);

  // My selection logic (different count)
  const selected = selectTop10(scored);

  return selected;
}
```

**Pros:**
- ✅ Flexibility: each publication can work differently
- ✅ Isolation: changes don't cascade
- ✅ Experimentation: try new workflows per publication
- ✅ Team scaling: different teams own different publications
- ✅ Clearer boundaries: all pub code in one place
- ✅ Performance: optimize per publication
- ✅ Deployment: can deploy publications independently (advanced)
- ✅ Risk reduction: one publication breaking doesn't affect others
- ✅ Business model flexibility: different monetization per pub

**Cons:**
- ❌ More code (workflows duplicated across publications)
- ❌ Bug fixes must be applied per publication
- ❌ More complex initial setup
- ❌ Requires discipline to maintain patterns
- ❌ Harder to make platform-wide changes
- ❌ Can lead to inconsistency if not managed
- ❌ More files/folders to navigate

**When to use:**
- Publications will diverge over time
- Multiple teams or growing team
- Want to experiment with different content strategies
- Need independent deployment/iteration
- Building a platform, not just a product
- Supporting diverse publication types

---

### 1.2 Our Recommendation

**Choose Publication-as-App** based on:

- ✅ Complex workflows (RSS, AI scoring, advertorials, breaking news)
- ✅ Potential for diverse publication types in future
- ✅ Need for experimentation and iteration
- ✅ Growing team that needs ownership boundaries
- ✅ Building a platform that supports multiple publications
- ✅ Risk reduction requirements

---

## 2. Layered Architecture Breakdown

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│                  (Next.js App Router)                        │
│         Thin routing layer - delegates to publications       │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐   ┌────────▼────────┐   ┌──────▼──────┐
│ Publication 1  │   │ Publication 2    │   │ Publication N│
│                │   │                  │   │              │
│ • Workflows    │   │ • Workflows      │   │ • Workflows  │
│ • Ad Logic     │   │ • Ad Logic       │   │ • Ad Logic   │
│ • Content      │   │ • Content        │   │ • Content    │
│ • Config       │   │ • Config         │   │ • Config     │
└───────┬────────┘   └────────┬─────────┘   └──────┬───────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
        ┌─────────────────────▼─────────────────────┐
        │          Platform Layer                    │
        │        (Shared Infrastructure)             │
        │                                            │
        │  • Database      • Email    • Workflow    │
        │  • AI Services   • Auth     • Integrations│
        │  • Content Tools • Admin    • Monitoring  │
        └────────────────────────────────────────────┘
```

---

### 2.2 Layer 1: Platform (Shared Infrastructure)

**Purpose:** Provide stable, reusable services that all publications use

**Why separate:** These are infrastructure concerns that change infrequently, need to be rock-solid, and are expensive to duplicate.

```
platform/
├── database/           # Database clients & shared queries
├── ai/                 # AI service clients (OpenAI, Anthropic)
├── email/              # Email infrastructure (MailerLite, template engine)
├── workflow-engine/    # Workflow runtime & scheduler
├── content/            # Content processing tools
├── ads/                # Ad platform components
├── integrations/       # External services (Slack, GitHub)
└── admin/              # Admin dashboard framework
```

#### A. Database Layer (`platform/database/`)

**What goes here:**
- Database connection management
- Shared query builders
- Multi-tenant filtering enforcement
- Transaction handling

**Example:**
```typescript
// platform/database/supabase.ts
export function getSupabaseClient() {
  // Single connection pool
  // Service role key protection
}

// platform/database/queries/campaigns.ts
export async function getCampaign(pubId: string, campaignId: string) {
  const db = getSupabaseClient();
  return db
    .from('campaigns')
    .select('*')
    .eq('newsletter_id', pubId)  // Enforced at platform level
    .eq('id', campaignId)
    .single();
}
```

**Why here:**
- Single connection pool (performance)
- Consistent error handling
- Security: service role key protected in one place
- Multi-tenant filtering enforced at platform level
- Easy to switch database providers

**Pros:**
- ✅ One place to fix database bugs
- ✅ Connection pooling optimization
- ✅ Enforced security patterns
- ✅ Consistent query patterns

**Cons:**
- ❌ Publications can't customize database access deeply
- ❌ Must support all publication needs

---

#### B. AI Layer (`platform/ai/`)

**What goes here:**
- AI provider clients (OpenAI, Anthropic)
- Prompt loading and rendering
- Rate limiting
- Cost tracking
- Retry logic

**Example:**
```typescript
// platform/ai/openai-client.ts
export class OpenAIClient {
  async generateContent(prompt: string, schema: any) {
    // Rate limiting
    // Retry logic
    // Cost tracking
    // Error handling
  }
}

// platform/ai/prompt-engine.ts
export class PromptEngine {
  async loadPrompt(pubId: string, key: string) {
    // Load from database
  }

  async renderPrompt(template: string, variables: any) {
    // Template rendering
  }
}
```

**Why here:**
- API keys protected
- Rate limiting centralized
- Cost tracking per publication
- Retry logic standardized
- Provider abstraction (OpenAI today, Anthropic tomorrow)

**Pros:**
- ✅ Single point for AI provider changes
- ✅ Cost monitoring across all publications
- ✅ Rate limit management
- ✅ Consistent error handling

**Cons:**
- ❌ All publications use same AI provider
- ❌ Can't optimize API calls per publication easily

**Key distinction:**
- **Platform provides:** AI client infrastructure
- **Publications provide:** Prompts and schemas

---

#### C. Email Layer (`platform/email/`)

**What goes here:**
- Email service provider clients
- Template rendering engine
- Deliverability monitoring
- Bounce/complaint handling

**Example:**
```typescript
// platform/email/mailerlite-client.ts
export class MailerLiteClient {
  async sendCampaign(pubId: string, campaign: Campaign) {
    // Send via MailerLite
    // Track deliverability
    // Handle bounces
  }
}

// platform/email/template-engine.ts
export class TemplateEngine {
  async render(template: string, data: any): Promise<string> {
    // Render HTML email
    // Inline CSS
    // Add tracking pixels
  }
}
```

**Why here:**
- Email provider abstraction (MailerLite → SendGrid is one change)
- Deliverability monitoring centralized
- Bounce/complaint handling consistent

**Pros:**
- ✅ Switch email providers without touching publications
- ✅ Centralized deliverability metrics
- ✅ Consistent error handling

**Cons:**
- ❌ All publications use same provider
- ❌ Can't A/B test different email services per pub

---

#### D. Content Tools (`platform/content/`)

**What goes here:**
- RSS parser
- Article extractor (full text from URL)
- Deduplicator
- Web scraper
- Image processor

**Example:**
```typescript
// platform/content/rss-parser.ts
export class RSSParser {
  async parse(feedUrl: string): Promise<Article[]> {
    // Parse RSS feed
    // Normalize data
    // Extract metadata
  }
}

// platform/content/article-extractor.ts
export class ArticleExtractor {
  async extractFullText(url: string): Promise<string> {
    // Fetch URL
    // Extract main content
    // Clean HTML
  }
}
```

**Why here:**
- Reusable tools, not workflows
- No business logic (just utilities)
- Expensive operations optimized once

**Key distinction:**
- **Platform provides:** RSS parsing mechanism
- **Publication decides:** Which feeds to parse, how often, what to do with results

**Example usage:**
```typescript
// publications/ai-news/workflows/ingest.ts
import { RSSParser } from '@/platform/content';

export async function ingestWorkflow(pubId: string) {
  const myFeeds = ['feed1.com', 'feed2.com']; // Publication-specific
  const parser = new RSSParser();              // Platform tool

  for (const feed of myFeeds) {
    const articles = await parser.parse(feed);
    // Publication decides what to do next
  }
}
```

---

#### E. Workflow Engine (`platform/workflow-engine/`)

**What goes here:**
- Workflow execution runtime
- Logging and monitoring
- Error handling and retries
- Timeout management
- Workflow scheduling

**Example:**
```typescript
// platform/workflow-engine/executor.ts
export class WorkflowExecutor {
  async execute(pubId: string, workflowFn: Function) {
    // Logging with [Workflow] prefix
    // Error handling and retries
    // Timeout management
    // Performance tracking
  }
}

// platform/workflow-engine/scheduler.ts
export class WorkflowScheduler {
  async schedule(pubId: string, cron: string, workflowName: string) {
    // Register with Vercel workflow
  }
}
```

**Why here:**
- Runtime concerns (logging, retries) are infrastructure
- All workflows need these capabilities
- Vercel workflow integration centralized

**Key distinction:**
- **Platform provides:** How to run workflows (runtime)
- **Publications define:** What workflows do (business logic)

---

### 2.3 Layer 2: Publications (Business Logic)

**Purpose:** Define how THIS specific publication works

**Why separate per publication:**
- Each publication has different content strategy
- Business rules differ (scoring, ad placement, schedule)
- Need to iterate independently
- Failures should be isolated

```
publications/
├── ai-news-daily/
│   ├── workflows/       # How content flows through system
│   ├── ads/            # Ad scheduling & pricing rules
│   ├── content/        # Scoring, templates, generators
│   ├── sources/        # Where content comes from
│   ├── api/            # Pub-specific API endpoints
│   └── config.ts       # All publication settings
├── local-digest/
│   └── ... (same structure)
└── _template/          # Template for new publications
```

#### A. Workflows (`publications/{pub}/workflows/`)

**What goes here:**
- Ingestion workflow (how to get content)
- Processing workflow (how to select/generate content)
- Publishing workflow (how to send newsletter)

**Example: AI News Daily**
```typescript
// publications/ai-news-daily/workflows/ingest.ts
export async function ingestWorkflow(pubId: string) {
  // 1. Fetch from THIS pub's RSS feeds
  const feeds = await db.getRSSFeeds(pubId);

  // 2. Use platform tool to parse
  const parser = new RSSParser();
  const articles = await parser.parseBatch(feeds);

  // 3. Deduplicate against THIS pub's history
  const deduper = new Deduplicator(pubId);
  const newArticles = await deduper.filter(articles);

  // 4. Extract full content
  const extractor = new ArticleExtractor();
  const fullArticles = await extractor.extractBatch(newArticles);

  // 5. Store with THIS pub's newsletter_id
  await db.saveArticles(pubId, fullArticles);
}

// publications/ai-news-daily/workflows/process.ts
export async function processWorkflow(pubId: string, date: string) {
  // 1. Load articles for THIS pub
  const articles = await db.getArticles(pubId, date);

  // 2. Score using THIS pub's criteria
  const scored = await scoreArticles(articles);

  // 3. Select top 5 (THIS pub's strategy)
  const selected = selectTopN(scored, 5);

  // 4. Generate content using THIS pub's prompts
  const generated = await generateContent(selected);

  // 5. Assign ads using THIS pub's rules
  const withAds = await assignAds(generated);

  return withAds;
}
```

**Example: Local Digest (Different)**
```typescript
// publications/local-digest/workflows/ingest.ts
export async function ingestWorkflow(pubId: string) {
  // Different approach: web scraping instead of RSS
  const scraper = new WebScraper();
  const articles = await scraper.scrape(localNewsSites);

  // Custom: geocode articles for locality
  const geocoder = new Geocoder();
  const geocoded = await geocodeArticles(articles);

  await db.saveArticles(pubId, geocoded);
}
```

**Why here:**
- Workflow steps are business decisions
- Each publication may want different steps or order
- Can experiment with different approaches

**Comparison:**
| Aspect | AI News Daily | Local Digest |
|--------|---------------|--------------|
| **Ingestion** | RSS feeds | Web scraping |
| **Scoring** | Novelty + relevance | Locality + timeliness |
| **Selection** | Top 5 articles | Top 10 articles |
| **Extra Steps** | Breaking news check | Geocoding |
| **Schedule** | 4x daily | 1x daily |

---

#### B. Ad Logic (`publications/{pub}/ads/`)

**What goes here:**
- Ad scheduling algorithm
- Position definitions
- Pricing rules
- Rotation strategy

**Example: AI News Daily**
```typescript
// publications/ai-news-daily/ads/scheduler.ts
import { AdSchedulerBase } from '@/platform/ads';

export class AINewsAdScheduler extends AdSchedulerBase {
  async assignAds(campaignId: string): Promise<AdAssignment[]> {
    // THIS pub's logic:
    // - 3 ad positions: top, middle, bottom
    // - Rotation: position-based (different ads each position)
    // - Pricing: top=$500, middle=$300, bottom=$200

    const activeAds = await this.getActiveAds('ai-news-daily');

    return [
      { position: 'top', ad: activeAds[0] },
      { position: 'middle', ad: activeAds[1] },
      { position: 'bottom', ad: activeAds[2] },
    ];
  }
}
```

**Example: Local Digest (Different)**
```typescript
// publications/local-digest/ads/scheduler.ts
export class LocalDigestAdScheduler extends AdSchedulerBase {
  async assignAds(campaignId: string): Promise<AdAssignment[]> {
    // THIS pub's logic:
    // - 1 ad position: sponsor
    // - Rotation: monthly (same sponsor all month)
    // - Pricing: flat $2000/month

    const monthSponsor = await this.getMonthSponsor('local-digest');

    return [
      { position: 'sponsor', ad: monthSponsor }
    ];
  }
}
```

**Why here:**
- Ad strategies differ significantly between publications
- Pricing models are business decisions
- Position names/counts vary

---

#### C. Content Strategy (`publications/{pub}/content/`)

**What goes here:**
- Article scoring logic
- Email templates
- Content generators (AI prompts)
- Section definitions

**Example: Scoring**
```typescript
// publications/ai-news-daily/content/scoring.ts
export async function scoreArticles(articles: Article[]) {
  return articles.map(article => ({
    ...article,
    score:
      article.noveltyScore * 0.3 +      // Breaking news important
      article.relevanceScore * 0.4 +    // Must be AI-related
      article.engagementScore * 0.3     // Social signals
  }));
}

// publications/local-digest/content/scoring.ts
export async function scoreArticles(articles: Article[]) {
  return articles.map(article => ({
    ...article,
    score:
      article.localityScore * 0.5 +     // Proximity is key
      article.timelinesScore * 0.3 +    // Recent events
      article.communityScore * 0.2      // Community impact
  }));
}
```

**Why here:**
- Scoring criteria are editorial decisions
- Each publication has different content philosophy
- Weights and factors differ significantly

---

#### D. Configuration (`publications/{pub}/config.ts`)

**What goes here:**
- Publication metadata
- Feature flags
- Schedules
- Content strategy settings
- Ad configuration
- Branding
- Email settings

**Example:**
```typescript
// publications/ai-news-daily/config.ts
export const config = {
  id: 'ai-news-daily',
  name: 'AI News Daily',

  // Feature flags
  features: {
    rss: true,
    breakingNews: true,
    ads: true,
    polls: true,
    manualSubmissions: false,
    aiApps: true,
  },

  // Schedule (when things run)
  schedule: {
    ingest: '0 */4 * * *',      // Every 4 hours
    process: '0 6 * * 1-5',     // 6am weekdays
    sendReview: '0 7 * * 1-5',  // 7am weekdays
    sendFinal: '0 8 * * 1-5',   // 8am weekdays
  },

  // Content strategy
  content: {
    articlesPerIssue: 5,
    secondaryArticles: 3,
    pollsPerIssue: 1,
    advertorialsPerIssue: 2,
  },

  // Ad configuration
  ads: {
    enabled: true,
    positions: ['top', 'middle', 'bottom'],
    pricing: { top: 500, middle: 300, bottom: 200 },
    rotationStrategy: 'position-based',
  },

  // Branding
  branding: {
    primaryColor: '#2563eb',
    secondaryColor: '#60a5fa',
    logo: '/logos/ai-news-daily.png',
    domain: 'ainewsdaily.com',
  },

  // Email settings
  email: {
    fromName: 'AI News Daily',
    fromEmail: 'newsletter@ainewsdaily.com',
    replyTo: 'hello@ainewsdaily.com',
    mailerliteGroupId: '123456789',
  },
};
```

**Why here:**
- Single source of truth for publication settings
- Type-safe (TypeScript)
- Version controlled
- Easily auditable

---

### 2.4 Layer 3: Application (Next.js Routing)

**Purpose:** Thin routing layer that delegates to publications

**Why thin:** Routes should just call publication code, no business logic

```
app/
├── api/
│   ├── publications/
│   │   └── [pubId]/           # Dynamic publication routes
│   │       ├── ingest/
│   │       ├── process/
│   │       └── publish/
│   ├── cron/
│   │   └── [pubId]/           # Per-publication cron
│   └── admin/                  # Platform admin
└── dashboard/
    └── [pubId]/               # Publication dashboard
```

**Example:**
```typescript
// app/api/publications/[pubId]/ingest/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { loadPublication } from '@/platform/publications';
import { WorkflowExecutor } from '@/platform/workflow-engine';

export async function POST(
  req: NextRequest,
  { params }: { params: { pubId: string } }
) {
  const { pubId } = params;

  // Load publication module
  const pub = await loadPublication(pubId);

  // Execute publication's workflow
  const executor = new WorkflowExecutor();
  await executor.execute(pubId, pub.workflows.ingest);

  return NextResponse.json({ success: true });
}
```

**Why this approach:**
- Route is dumb (just delegates)
- Publication owns the logic
- Easy to test publication workflows in isolation
- One route handles all publications

---

### 2.5 Layer 4: Shared UI/Utilities

**Purpose:** Cross-cutting concerns that aren't publication-specific

```
shared/
├── components/        # Reusable UI components
│   ├── Button.tsx
│   ├── Card.tsx
│   └── DataTable.tsx
├── hooks/            # Reusable React hooks
│   ├── useAuth.ts
│   └── useDebounce.ts
├── types/            # Shared TypeScript types
│   └── api.ts
└── utils/            # Utility functions
    └── dates.ts
```

**What goes here vs. platform:**
- **Shared:** UI components, frontend hooks, client-side utils
- **Platform:** Backend services, API clients, infrastructure

---

## 3. Migration Strategy

### 3.1 Approach: Incremental (Strangler Fig Pattern)

**Why incremental:**
- ✅ Low risk (system keeps running)
- ✅ Can test each phase
- ✅ Can roll back at any point
- ✅ Continue shipping features during migration
- ❌ Takes longer than big-bang
- ❌ Temporary duplication during transition

**Alternative rejected: Big Bang Rewrite**
- ❌ High risk (everything breaks at once)
- ❌ Can't ship features during migration
- ❌ Long deployment freeze
- ❌ Hard to roll back

---

### 3.2 Migration Phases

#### Phase 1: Create Platform Layer (Week 1)

**Goal:** Establish foundation and pattern

**Tasks:**
1. Create `platform/` directory structure
2. Move infrastructure files:
   ```
   src/lib/supabase.ts → platform/database/supabase.ts
   src/lib/mailerlite.ts → platform/email/mailerlite-client.ts
   src/lib/openai.ts → platform/ai/openai-client.ts
   src/lib/slack.ts → platform/integrations/slack.ts
   src/lib/github-storage.ts → platform/integrations/github.ts
   ```
3. Update imports throughout codebase
4. Run tests to verify nothing breaks
5. Deploy to staging, then production

**Success criteria:**
- All tests pass
- No behavior changes
- Production runs normally

**Risk:** Low (just moving files)

**Rollback:** Revert commit

---

#### Phase 2: Extract First Publication (Weeks 2-3)

**Goal:** Prove the publication-as-app pattern works

**Tasks:**
1. Create `publications/ai-news-daily/` directory
2. Create config.ts with current settings
3. Copy current workflows:
   ```
   src/lib/workflows/* → publications/ai-news-daily/workflows/
   src/lib/rss-processor.ts → publications/ai-news-daily/workflows/ingest.ts
   ```
4. Copy ad logic:
   ```
   src/lib/ad-scheduler.ts → publications/ai-news-daily/ads/scheduler.ts
   ```
5. Copy content logic:
   ```
   src/lib/newsletter-templates.ts → publications/ai-news-daily/content/templates.ts
   ```
6. Create new dynamic routes:
   ```typescript
   // app/api/publications/[pubId]/ingest/route.ts
   const pub = await loadPublication(params.pubId);
   await pub.workflows.ingest(params.pubId);
   ```
7. Run both old and new paths in parallel with feature flag
8. Compare outputs to verify identical behavior
9. Switch to new path, remove old code

**Success criteria:**
- Old and new workflows produce identical results
- Can run publication workflows independently
- Clear isolation of publication code

**Risk:** Medium (significant code changes)

**Rollback:** Toggle feature flag back to old path

---

#### Phase 3: Create Template & Tooling (Week 4)

**Goal:** Make it easy to add new publications

**Tasks:**
1. Create `publications/_template/` with:
   - Standard directory structure
   - Example workflows
   - Config template
   - README
2. Document publication creation process
3. Create CLI tool:
   ```bash
   npm run create:publication <name>
   ```
4. Test by creating dummy publication

**Success criteria:**
- Can create new publication in < 30 minutes
- Template includes all necessary boilerplate

---

#### Phase 4: Add Second Publication (Week 5)

**Goal:** Prove independence and identify shared code opportunities

**Tasks:**
1. Use template to create new publication
2. Customize workflows, config for different use case
3. Deploy alongside existing publication
4. Verify isolation: change new pub without touching first
5. Identify common patterns to extract to platform

**Success criteria:**
- Second publication works independently
- Changes to one don't affect the other
- Identified reusable patterns

---

#### Phase 5: Refine & Document (Week 6)

**Goal:** Polish and establish standards

**Tasks:**
1. Extract common publication patterns to base classes
2. Document architecture decisions
3. Create developer onboarding guide
4. Update CLAUDE.md with new structure
5. Clean up old code

**Success criteria:**
- Clear documentation
- Established patterns
- Easy onboarding for new developers

---

### 3.3 Backward Compatibility Strategy

**During migration, maintain both paths:**

```typescript
// Feature flag in environment
const USE_NEW_ARCHITECTURE = process.env.ENABLE_PUB_AS_APP === 'true';

// Old route (existing)
// app/api/cron/ingest-rss/route.ts
export async function GET(req: NextRequest) {
  if (!USE_NEW_ARCHITECTURE) {
    // Old monolithic workflow
    await processRSSWorkflow();
  } else {
    // Redirect to new route
    return NextResponse.redirect('/api/publications/ai-news-daily/ingest');
  }
}

// New route
// app/api/publications/[pubId]/ingest/route.ts
export async function GET(req: NextRequest, { params }) {
  const pub = await loadPublication(params.pubId);
  await pub.workflows.ingest(params.pubId);
}
```

**Vercel.json during migration:**
```json
{
  "crons": [
    // OLD (keep until verified)
    {
      "path": "/api/cron/ingest-rss",
      "schedule": "0 */4 * * *"
    },

    // NEW (run 5 minutes after old for comparison)
    {
      "path": "/api/publications/ai-news-daily/ingest",
      "schedule": "5 */4 * * *"
    }
  ]
}
```

**Process:**
1. Run both paths in parallel
2. Compare outputs (should be identical)
3. Monitor for 1 week
4. If identical, remove old path
5. If issues, fix new path and repeat

---

## 4. Branching Strategy

### 4.1 Current Problem

**Single branch (master) issues:**
- Can't work on multiple features in parallel
- Production risk with every commit
- No staging environment
- Can't test changes before merging
- Hard to coordinate team work

### 4.2 Proposed: Modified Git Flow

```
main (production)
  └─── develop (staging)
         ├─── publication/ai-news/feature-x
         ├─── publication/local/feature-y
         ├─── platform/new-tool
         └─── hotfix/urgent-bug
```

---

### 4.3 Branch Types

#### `main` (Protected, Production)

**Purpose:** Production code
**Deploys to:** Vercel production (all publications live)
**URL:** `yourdomain.com`

**Rules:**
- ❌ No direct commits
- ✅ Only merge from `develop` after testing
- ✅ All tests must pass
- ✅ Requires PR approval
- ✅ Auto-deploys on merge

**Pros:**
- ✅ Production stability
- ✅ Code review required
- ✅ Clear production state
- ✅ Easy to see what's live

**Cons:**
- ❌ Can't hotfix quickly without process
- ❌ Must go through develop first

---

#### `develop` (Integration, Staging)

**Purpose:** Integration/staging environment
**Deploys to:** Vercel preview
**URL:** `staging.yourdomain.com`

**Rules:**
- ✅ Merge from feature branches
- ✅ Must pass tests
- ✅ Should be deployable at any time
- ⚠️ Can be temporarily broken during integration

**Pros:**
- ✅ Test integration before production
- ✅ Catch conflicts early
- ✅ Real staging environment
- ✅ Multiple people can integrate work

**Cons:**
- ❌ Can become unstable if misused
- ❌ Requires discipline

**Best practices:**
- Fix broken builds immediately
- Don't merge untested code
- Coordinate before merging breaking changes

---

#### `publication/{pub-name}/{feature}` (Feature Branches)

**Purpose:** Work on specific publication
**Deploys to:** Vercel preview (unique URL per PR)
**URL:** `preview-{branch}.vercel.app`

**Examples:**
- `publication/ai-news/new-scoring`
- `publication/ai-news/add-breaking-news`
- `publication/local/add-weather-section`

**Lifetime:** Created → Work → PR → Merge → Delete

**Why namespace by publication:**
- ✅ Clear which publication is affected
- ✅ Easy to see all work: `git branch --list "publication/ai-news/*"`
- ✅ Prevents teams from stepping on each other
- ✅ Can review all AI News work together

**Workflow:**
```bash
# Create feature branch
git checkout develop
git pull
git checkout -b publication/ai-news/new-scoring

# Make changes
# ... code ...

# Commit and push
git add .
git commit -m "feat(ai-news): improve scoring algorithm"
git push origin publication/ai-news/new-scoring

# Open PR to develop
# - CI runs tests
# - Vercel deploys preview
# - Team reviews

# After approval, merge to develop
# - Preview URL for testing: preview-new-scoring.vercel.app
# - Test with real data in staging

# Delete branch after merge
git branch -d publication/ai-news/new-scoring
```

---

#### `platform/{feature}` (Platform Changes)

**Purpose:** Changes to shared infrastructure
**Deploys to:** Vercel preview

**Examples:**
- `platform/add-anthropic-client`
- `platform/improve-database-pooling`
- `platform/add-caching-layer`

**Why separate:**
- ⚠️ Platform changes affect ALL publications
- ⚠️ Requires broader testing
- ⚠️ Different review process (more scrutiny)
- ⚠️ Breaking changes must be coordinated

**Workflow:**
```bash
# Create platform branch
git checkout develop
git checkout -b platform/add-caching

# Make changes to platform/
# ... code ...

# IMPORTANT: Test with ALL publications
npm run test:all-pubs

# Commit and push
git commit -m "feat(platform): add Redis caching layer"
git push origin platform/add-caching

# Open PR with detailed description of impact
# - Document which publications are affected
# - Show performance improvements
# - Demonstrate backward compatibility

# Requires approval from platform team lead
```

**Testing requirements:**
- Must test with all existing publications
- Must not break any publication
- Performance impact documented
- Rollback plan documented

---

#### `hotfix/{description}` (Urgent Fixes)

**Purpose:** Critical production bugs
**Flow:** Branch from `main` → Fix → Merge to both `main` AND `develop`

**Examples:**
- `hotfix/email-sending-broken`
- `hotfix/db-connection-leak`
- `hotfix/auth-bypass-vulnerability`

**When to use:**
- 🔥 Production is broken
- 🔥 Users are affected
- 🔥 Can't wait for normal develop → main cycle

**Workflow:**
```bash
# Branch from main (not develop!)
git checkout main
git pull
git checkout -b hotfix/email-sending-broken

# Fix the issue
# ... code ...

# Commit and push
git commit -m "fix: resolve MailerLite API timeout"
git push origin hotfix/email-sending-broken

# Open PR to main (emergency review)
# After approval, merge to main
# Deploys to production immediately

# IMPORTANT: Also merge to develop
git checkout develop
git merge hotfix/email-sending-broken
git push

# Delete hotfix branch
git branch -d hotfix/email-sending-broken
```

**Why direct to main:**
- ⏰ Can't wait for develop cycle
- 🔥 Production is broken now
- ✅ Must fix immediately

**Critical:** Always merge to develop too, or develop will be behind main

---

### 4.4 Workflow Example

**Scenario:** Add new scoring algorithm to AI News Daily

```bash
# 1. Start from develop
git checkout develop
git pull origin develop

# 2. Create feature branch
git checkout -b publication/ai-news/improved-scoring

# 3. Make changes
# Edit: publications/ai-news-daily/content/scoring.ts
# Add: publications/ai-news-daily/content/scoring.test.ts

# 4. Test locally
npm run test

# 5. Commit
git add .
git commit -m "feat(ai-news): improve article scoring algorithm

- Added sentiment analysis to scoring
- Increased weight of recency factor
- Added tests for new scoring logic"

# 6. Push to GitHub
git push origin publication/ai-news/improved-scoring

# 7. Open Pull Request to develop
# Title: "Improve AI News Daily scoring algorithm"
# Description:
#   - What changed
#   - Why changed
#   - How to test
#   - Impact analysis

# 8. Automated checks run:
#   - TypeScript compilation
#   - Linting
#   - Tests
#   - Vercel preview deployment

# 9. Preview deployment ready
# URL: https://preview-improved-scoring.vercel.app
# Test with real data in preview environment

# 10. Code review
# Team reviews code, tests preview, approves

# 11. Merge to develop
# Automatically deploys to staging
# URL: https://staging.yourdomain.com

# 12. Test in staging
# Verify with production data (staging database)
# Run for 24 hours, monitor metrics

# 13. If staging looks good, merge develop → main
# Automatically deploys to production
# URL: https://yourdomain.com

# 14. Monitor production
# Watch logs, metrics, alerts
# If issues, can roll back by reverting commit

# 15. Cleanup
git checkout develop
git pull
git branch -d publication/ai-news/improved-scoring
```

---

### 4.5 Deployment Environments

**Vercel configuration:**

```json
// vercel.json
{
  "git": {
    "deploymentEnabled": {
      "main": true,              // Production
      "develop": true,           // Staging
      "publication/*": true,     // Preview per feature
      "platform/*": true,        // Preview per feature
      "hotfix/*": true           // Preview per hotfix
    }
  },
  "env": {
    "production": {
      "ENVIRONMENT": "production"
    },
    "preview": {
      "ENVIRONMENT": "staging"
    }
  }
}
```

**Environment mapping:**

| Branch Pattern | Environment | URL | Purpose | Database |
|---------------|-------------|-----|---------|----------|
| `main` | Production | `yourdomain.com` | Live site | Production DB |
| `develop` | Staging | `staging.yourdomain.com` | Integration testing | Staging DB |
| `publication/*` | Preview | `preview-{branch}.vercel.app` | Feature testing | Staging DB |
| `platform/*` | Preview | `preview-{branch}.vercel.app` | Platform testing | Staging DB |
| `hotfix/*` | Preview | `preview-{branch}.vercel.app` | Hotfix testing | Staging DB |

**Cron configuration per environment:**

```json
// vercel.json
{
  "crons": [
    // Production crons (only on main branch)
    {
      "path": "/api/cron/ai-news-daily/ingest",
      "schedule": "0 */4 * * *"
    },
    {
      "path": "/api/cron/ai-news-daily/process",
      "schedule": "0 6 * * 1-5"
    }
  ]
}
```

**Staging crons:** Manually triggered or run at different times to avoid conflicts

---

## 5. Implementation Examples

### 5.1 Complete Publication Example

**AI News Daily - Full Implementation**

```typescript
// publications/ai-news-daily/config.ts
export const config = {
  id: 'ai-news-daily',
  name: 'AI News Daily',

  features: {
    rss: true,
    breakingNews: true,
    ads: true,
    polls: true,
    manualSubmissions: false,
    aiApps: true,
  },

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
};
```

```typescript
// publications/ai-news-daily/workflows/ingest.ts
import { RSSParser, ArticleExtractor, Deduplicator } from '@/platform/content';
import { WorkflowExecutor } from '@/platform/workflow-engine';
import { getSupabaseClient } from '@/platform/database';

export async function ingestWorkflow(pubId: string) {
  console.log(`[Workflow] Starting ingest for ${pubId}`);

  const db = getSupabaseClient();

  // 1. Get RSS feeds for this publication
  const { data: feeds } = await db
    .from('rss_feeds')
    .select('*')
    .eq('newsletter_id', pubId)
    .eq('active', true);

  console.log(`[Workflow] Found ${feeds.length} active feeds`);

  // 2. Parse all feeds
  const parser = new RSSParser();
  const allArticles = [];

  for (const feed of feeds) {
    try {
      const articles = await parser.parse(feed.url);
      allArticles.push(...articles);
      console.log(`[Workflow] Parsed ${articles.length} from ${feed.name}`);
    } catch (error) {
      console.error(`[Workflow] Failed to parse ${feed.url}:`, error);
    }
  }

  // 3. Deduplicate
  const deduper = new Deduplicator(pubId);
  const newArticles = await deduper.filter(allArticles);
  console.log(`[Workflow] ${newArticles.length} new articles after deduplication`);

  // 4. Extract full content
  const extractor = new ArticleExtractor();
  const fullArticles = await extractor.extractBatch(newArticles);

  // 5. Save to database
  const { data: saved } = await db
    .from('rss_posts')
    .insert(
      fullArticles.map(article => ({
        newsletter_id: pubId,
        title: article.title,
        url: article.url,
        content: article.content,
        published_at: article.publishedAt,
        source: article.source,
      }))
    )
    .select();

  console.log(`[Workflow] Saved ${saved.length} articles`);

  return { articlesIngested: saved.length };
}
```

```typescript
// publications/ai-news-daily/workflows/process.ts
import { OpenAIClient } from '@/platform/ai';
import { getSupabaseClient } from '@/platform/database';
import { scoreArticles } from '../content/scoring';
import { AINewsAdScheduler } from '../ads/scheduler';

export async function processWorkflow(pubId: string, campaignDate: string) {
  console.log(`[Workflow] Processing campaign for ${campaignDate}`);

  const db = getSupabaseClient();

  // 1. Load articles from last 24 hours
  const { data: articles } = await db
    .from('rss_posts')
    .select('*')
    .eq('newsletter_id', pubId)
    .gte('published_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .eq('used', false);

  console.log(`[Workflow] Found ${articles.length} candidate articles`);

  // 2. Score articles using our criteria
  const scored = await scoreArticles(articles);

  // 3. Select top 5
  const selected = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  console.log(`[Workflow] Selected top 5 articles`);

  // 4. Generate AI content
  const ai = new OpenAIClient();
  const generated = await Promise.all(
    selected.map(async article => ({
      ...article,
      summary: await ai.generateSummary(article.content),
      headline: await ai.generateHeadline(article.title),
    }))
  );

  // 5. Assign ads
  const adScheduler = new AINewsAdScheduler();
  const ads = await adScheduler.assignAds(campaignDate);

  // 6. Create campaign
  const { data: campaign } = await db
    .from('campaigns')
    .insert({
      newsletter_id: pubId,
      scheduled_date: campaignDate,
      status: 'draft',
      articles: generated,
      ads: ads,
    })
    .select()
    .single();

  console.log(`[Workflow] Created campaign ${campaign.id}`);

  return { campaignId: campaign.id };
}
```

```typescript
// publications/ai-news-daily/content/scoring.ts
export async function scoreArticles(articles: Article[]) {
  return articles.map(article => {
    // Calculate component scores
    const noveltyScore = calculateNoveltyScore(article);
    const relevanceScore = calculateRelevanceScore(article);
    const engagementScore = calculateEngagementScore(article);

    // Weighted combination (our editorial strategy)
    const score =
      noveltyScore * 0.3 +      // Breaking news important
      relevanceScore * 0.4 +    // Must be AI-related
      engagementScore * 0.3;    // Social signals

    return {
      ...article,
      score,
      noveltyScore,
      relevanceScore,
      engagementScore,
    };
  });
}

function calculateNoveltyScore(article: Article): number {
  // How recent is this article?
  const ageHours = (Date.now() - new Date(article.publishedAt).getTime()) / (1000 * 60 * 60);

  // Score: 1.0 for brand new, decays to 0 over 24 hours
  return Math.max(0, 1 - (ageHours / 24));
}

function calculateRelevanceScore(article: Article): number {
  // AI-related keywords
  const keywords = ['AI', 'artificial intelligence', 'machine learning', 'deep learning', 'neural network'];

  const text = `${article.title} ${article.content}`.toLowerCase();
  const matches = keywords.filter(keyword => text.includes(keyword.toLowerCase())).length;

  return Math.min(1, matches / 3); // 3+ matches = perfect score
}

function calculateEngagementScore(article: Article): number {
  // Social signals (if available)
  const shares = article.socialShares || 0;
  const comments = article.comments || 0;

  // Normalize to 0-1 scale
  return Math.min(1, (shares + comments * 2) / 100);
}
```

```typescript
// publications/ai-news-daily/ads/scheduler.ts
import { AdSchedulerBase } from '@/platform/ads';
import { getSupabaseClient } from '@/platform/database';

export class AINewsAdScheduler extends AdSchedulerBase {
  async assignAds(campaignDate: string): Promise<AdAssignment[]> {
    const db = getSupabaseClient();

    // Get active ads for this publication
    const { data: activeAds } = await db
      .from('advertisements')
      .select('*')
      .eq('newsletter_id', 'ai-news-daily')
      .eq('status', 'active')
      .lte('start_date', campaignDate)
      .gte('end_date', campaignDate);

    if (activeAds.length === 0) {
      return [];
    }

    // Position-based rotation strategy
    // Each position gets a different ad
    const positions = ['top', 'middle', 'bottom'];

    return positions.map((position, index) => ({
      position,
      ad: activeAds[index % activeAds.length],
    }));
  }
}
```

---

### 5.2 Platform Service Example

```typescript
// platform/content/rss-parser.ts
import RSSParser from 'rss-parser';

export class RSSParserService {
  private parser: RSSParser;

  constructor() {
    this.parser = new RSSParser({
      timeout: 10000,
      headers: {
        'User-Agent': 'AI Pros Newsletter/1.0',
      },
    });
  }

  async parse(feedUrl: string): Promise<Article[]> {
    try {
      const feed = await this.parser.parseURL(feedUrl);

      return feed.items.map(item => ({
        title: item.title || 'Untitled',
        url: item.link || '',
        content: item.contentSnippet || item.content || '',
        publishedAt: item.pubDate || new Date().toISOString(),
        source: feed.title || feedUrl,
        author: item.creator || item.author || 'Unknown',
      }));
    } catch (error) {
      console.error(`[RSS] Failed to parse ${feedUrl}:`, error);
      throw new Error(`RSS parsing failed: ${error.message}`);
    }
  }

  async parseBatch(feedUrls: string[]): Promise<Article[]> {
    const results = await Promise.allSettled(
      feedUrls.map(url => this.parse(url))
    );

    const articles = results
      .filter(result => result.status === 'fulfilled')
      .flatMap(result => result.value);

    const failed = results.filter(result => result.status === 'rejected').length;

    if (failed > 0) {
      console.warn(`[RSS] ${failed} feeds failed to parse`);
    }

    return articles;
  }
}
```

```typescript
// platform/workflow-engine/executor.ts
export class WorkflowExecutor {
  async execute(
    pubId: string,
    workflowName: string,
    workflowFn: Function
  ): Promise<any> {
    const startTime = Date.now();

    console.log(`[Workflow] Starting ${workflowName} for ${pubId}`);

    try {
      // Execute with timeout
      const result = await this.withTimeout(
        workflowFn(pubId),
        10 * 60 * 1000 // 10 minute timeout
      );

      const duration = Date.now() - startTime;
      console.log(`[Workflow] Completed ${workflowName} in ${duration}ms`);

      // Log to database for monitoring
      await this.logWorkflowExecution(pubId, workflowName, 'success', duration);

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[Workflow] Failed ${workflowName}:`, error);

      // Log failure
      await this.logWorkflowExecution(pubId, workflowName, 'failed', duration, error);

      // Retry logic
      if (this.shouldRetry(error)) {
        console.log(`[Workflow] Retrying ${workflowName}...`);
        await this.sleep(2000);
        return this.execute(pubId, workflowName, workflowFn);
      }

      throw error;
    }
  }

  private async withTimeout(promise: Promise<any>, timeoutMs: number) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Workflow timeout')), timeoutMs)
      ),
    ]);
  }

  private shouldRetry(error: any): boolean {
    // Retry on network errors, not logic errors
    return error.code === 'ECONNRESET' ||
           error.code === 'ETIMEDOUT' ||
           error.message.includes('rate limit');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async logWorkflowExecution(
    pubId: string,
    workflowName: string,
    status: string,
    duration: number,
    error?: any
  ) {
    const db = getSupabaseClient();
    await db.from('workflow_logs').insert({
      newsletter_id: pubId,
      workflow_name: workflowName,
      status,
      duration_ms: duration,
      error_message: error?.message,
      created_at: new Date().toISOString(),
    });
  }
}
```

---

## 6. Decision Matrix

### 6.1 When to Use Each Approach

| Criteria | Multi-Tenant Shared | Publication-as-App |
|----------|--------------------|--------------------|
| **Team size** | < 5 people | > 5 people |
| **Publications** | < 5, similar | > 5 or diverse |
| **Workflows** | Identical | Customized per pub |
| **Ad models** | Same for all | Different per pub |
| **Iteration speed** | All pubs together | Independent per pub |
| **Risk tolerance** | One bug affects all | Isolated failures |
| **Deployment** | All at once | Can be independent |
| **Testing** | Test all variations | Test one pub |
| **Code reuse** | Maximum | Balanced |
| **Flexibility** | Low | High |

### 6.2 Your Situation Assessment

Based on your current codebase and CLAUDE.md documentation:

✅ **Choose Publication-as-App because:**

1. **Complex workflows:** You have sophisticated 10-step workflows with RSS, AI scoring, advertorials, breaking news, polls
2. **Multi-tenant already:** You're already filtering by `newsletter_id`, showing intent for multiple publications
3. **Diverse features:** Different publications may want different features (AI apps, breaking news, polls)
4. **Growing complexity:** Your docs show increasing conditional logic and special cases
5. **Risk reduction:** One publication having issues shouldn't take down others
6. **Platform mindset:** Your documentation structure suggests you're building a platform
7. **Future publications:** Likely want to add publications with different workflows

❌ **Don't choose Multi-Tenant Shared if:**

1. You expect publications to diverge in workflow
2. You want to experiment with different approaches
3. You need independent iteration
4. You have or plan to have a larger team

---

## 7. Appendix

### 7.1 Glossary

**Publication:** A newsletter product with its own branding, content strategy, and subscribers (e.g., "AI News Daily")

**Platform:** Shared infrastructure and services used by all publications (database, AI, email)

**Workflow:** A series of steps to accomplish a task (ingest, process, publish)

**Multi-tenant:** Multiple publications sharing the same database, filtered by `newsletter_id`

**Strangler Fig Pattern:** Gradually replacing old code by building new alongside it

**Feature Flag:** Configuration that enables/disables functionality without code changes

**Hot fix:** Urgent fix for production bug that bypasses normal development flow

---

### 7.2 FAQ

**Q: Will this require rewriting everything?**
A: No. Incremental migration means you continue using existing code while gradually moving to new structure.

**Q: Can we still share code between publications?**
A: Yes. Shared code goes in the platform layer. Publications can also extend base classes.

**Q: What if publications are 95% the same?**
A: Create a base publication class with common logic, then publications extend and override specific behaviors.

**Q: How long will migration take?**
A: ~6 weeks for first publication and pattern establishment. Additional publications ~1-2 weeks each.

**Q: Can we add a publication without deployment?**
A: No, publications are code-based. But you can use configuration in database for publication-specific settings.

**Q: What about performance?**
A: Similar or better. Each publication can be optimized independently. Platform services are shared efficiently.

**Q: Will this increase hosting costs?**
A: No significant increase. Code is still running on same infrastructure. Preview deployments may increase Vercel costs slightly.

**Q: Can publications use different AI providers?**
A: Yes, publications can override platform services or use additional providers.

**Q: How do we prevent publications from diverging too much?**
A: Code reviews, established patterns, base classes, and documentation. Some divergence is intentional.

**Q: Can we roll back if this doesn't work?**
A: Yes, during Phase 2 both old and new paths run in parallel with feature flag. Can revert easily.

---

### 7.3 Resources

**Further Reading:**
- Martin Fowler - Strangler Fig Application: https://martinfowler.com/bliki/StranglerFigApplication.html
- Domain-Driven Design Distilled by Vaughn Vernon
- Building Evolutionary Architectures by Neal Ford

**Internal Documentation:**
- `docs/architecture/system-overview.md` - Current system overview
- `docs/workflows/rss-processing.md` - Current workflow details
- `CLAUDE.md` - Operations guide

**Code Examples:**
- `publications/_template/` - Template for new publications (after migration)
- `platform/` - Platform services (after migration)

---

### 7.4 Next Steps

**Immediate (This Week):**
1. Review this document with team
2. Discuss concerns and questions
3. Agree on approach (Publication-as-App vs. stay with current)
4. Get buy-in from stakeholders

**If approved (Week 1):**
1. Create `platform/` directory
2. Start Phase 1 migration (move infrastructure files)
3. Set up `develop` branch and branching strategy
4. Update CI/CD for new branch structure

**Questions to answer:**
- Do we have a staging database?
- Do we have Vercel preview deployments enabled?
- Who will own each publication after migration?
- What's our risk tolerance for migration?

---

**Document maintained by:** Architecture Team
**Review cycle:** Quarterly or when adding new publication type
**Feedback:** [Create GitHub issue or discuss in team meeting]
