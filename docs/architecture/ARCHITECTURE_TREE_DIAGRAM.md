# Architecture & Git Branch Tree Diagram

**Document Version:** 1.0
**Date:** 2025-11-12
**Purpose:** Visual reference for both git branching strategy and file structure

---

## Table of Contents

1. [Git Branch Structure](#1-git-branch-structure)
2. [Complete File Tree](#2-complete-file-tree)
3. [Branch-to-Code Mapping](#3-branch-to-code-mapping)
4. [Workflow Visualizations](#4-workflow-visualizations)

---

## 1. Git Branch Structure

### 1.1 Overall Branch Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                      REPOSITORY ROOT                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
         ┌──────▼──────┐            ┌──────▼──────┐
         │    main     │            │   develop   │
         │ (protected) │◄───────────│  (staging)  │
         │             │   merge    │             │
         └──────┬──────┘            └──────┬──────┘
                │                          │
                │                          │
          Production                   Staging
       yourdomain.com          staging.yourdomain.com
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
            ┌───────▼─────────┐  ┌──────▼──────────┐  ┌──────▼──────────┐
            │ publication/*   │  │  platform/*     │  │   hotfix/*      │
            │                 │  │                 │  │                 │
            │ Feature work    │  │ Infrastructure  │  │ Emergency fixes │
            │ per publication │  │ changes         │  │                 │
            └─────────────────┘  └─────────────────┘  └─────────────────┘
                    │                    │                    │
                    │                    │                    │
              preview-*.vercel.app   preview-*.vercel.app   preview-*.vercel.app
```

### 1.2 Branch Types with Examples

```
main (production)
  │
  ├─── develop (staging)
  │      │
  │      ├─── publication/ai-news/new-scoring
  │      │      └─── Changes: publications/ai-news-daily/content/scoring.ts
  │      │
  │      ├─── publication/ai-news/add-breaking-news
  │      │      └─── Changes: publications/ai-news-daily/workflows/breaking-news.ts
  │      │
  │      ├─── publication/local-digest/add-weather
  │      │      └─── Changes: publications/local-digest/workflows/weather.ts
  │      │                    publications/local-digest/config.ts
  │      │
  │      ├─── platform/add-caching
  │      │      └─── Changes: platform/database/cache.ts
  │      │                    platform/database/supabase.ts
  │      │
  │      └─── platform/improve-ai-client
  │             └─── Changes: platform/ai/openai-client.ts
  │
  └─── hotfix/email-sending-broken
         └─── Merges to: main (immediate) + develop (sync)
              Changes: platform/email/mailerlite-client.ts
```

### 1.3 Branch Lifecycle

```
┌──────────────────────────────────────────────────────────────────┐
│ Feature Branch Lifecycle                                         │
└──────────────────────────────────────────────────────────────────┘

1. CREATE
   develop ──────┬──► publication/ai-news/new-feature
                 │
                 │
2. DEVELOP
   publication/ai-news/new-feature
                 │
                 ├──► commit: "feat: add new scoring"
                 ├──► commit: "test: add scoring tests"
                 ├──► commit: "docs: update scoring docs"
                 │
                 │
3. PUSH & PR
   publication/ai-news/new-feature ──► GitHub PR
                 │                        │
                 │                        ├─► CI runs tests
                 │                        ├─► Vercel deploys preview
                 │                        └─► Team reviews
                 │
                 │
4. MERGE
   publication/ai-news/new-feature ──► develop
                                         │
                                         │
5. STAGING TEST
   develop ─────────────────────────► Deploys to staging
                 │                      Test with real data
                 │                      Monitor for 24-48h
                 │
                 │
6. PRODUCTION
   develop ──────────────────────────► main
                                        │
                                        │
                                    Production deploy


7. CLEANUP
   delete publication/ai-news/new-feature
```

---

## 2. Complete File Tree

### 2.1 Root Structure

```
AI_Pros_Newsletter/
│
├── 📁 .claude/                    # Claude Code configuration
│   ├── settings.local.json
│   ├── 📁 agents/
│   └── 📁 hooks/
│
├── 📁 .github/                    # GitHub Actions, templates
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── 📁 docs/                       # Documentation
│   ├── 📁 architecture/
│   │   ├── system-overview.md
│   │   ├── PUBLICATION_AS_APP_ARCHITECTURE.md
│   │   └── ARCHITECTURE_TREE_DIAGRAM.md (this file)
│   ├── 📁 workflows/
│   ├── 📁 guides/
│   └── 📁 migrations/
│
├── 📁 publications/               # 🆕 Publication-specific code
│   │
│   ├── 📁 ai-news-daily/          # Individual publication
│   │   ├── 📄 config.ts           # Publication configuration
│   │   │
│   │   ├── 📁 workflows/          # How this pub processes content
│   │   │   ├── ingest.ts         # RSS ingestion workflow
│   │   │   ├── process.ts        # Article processing workflow
│   │   │   ├── publish.ts        # Newsletter publishing workflow
│   │   │   └── breaking-news.ts  # Breaking news workflow
│   │   │
│   │   ├── 📁 ads/                # Ad management for this pub
│   │   │   ├── scheduler.ts      # Ad rotation logic
│   │   │   └── pricing.ts        # Pricing rules
│   │   │
│   │   ├── 📁 content/            # Content strategy
│   │   │   ├── scoring.ts        # Article scoring algorithm
│   │   │   ├── templates.ts      # Email HTML templates
│   │   │   ├── subject-lines.ts  # Subject line generation
│   │   │   └── generators/       # AI content generators
│   │   │       ├── summary.ts
│   │   │       ├── headline.ts
│   │   │       └── advertorial.ts
│   │   │
│   │   ├── 📁 sources/            # Content sources
│   │   │   ├── rss-feeds.ts      # RSS feed definitions
│   │   │   └── scrapers.ts       # Custom scrapers (if needed)
│   │   │
│   │   ├── 📁 api/                # Publication-specific API routes
│   │   │   └── webhooks.ts       # Pub-specific webhooks
│   │   │
│   │   ├── 📁 tests/              # Tests for this publication
│   │   │   ├── workflows.test.ts
│   │   │   ├── scoring.test.ts
│   │   │   └── ads.test.ts
│   │   │
│   │   ├── 📄 index.ts            # Publication exports
│   │   └── 📄 README.md           # Publication documentation
│   │
│   ├── 📁 local-digest/           # Another publication
│   │   ├── 📄 config.ts
│   │   ├── 📁 workflows/
│   │   │   ├── scrape.ts         # Different: web scraping
│   │   │   ├── geocode.ts        # Different: location-based
│   │   │   └── publish.ts
│   │   ├── 📁 ads/
│   │   │   └── local-business.ts # Different: local ad model
│   │   ├── 📁 content/
│   │   │   ├── scoring.ts        # Different scoring criteria
│   │   │   └── templates.ts
│   │   └── ...
│   │
│   └── 📁 _template/              # Template for new publications
│       ├── 📄 config.template.ts
│       ├── 📁 workflows/
│       ├── 📁 ads/
│       ├── 📁 content/
│       └── 📄 README.md
│
├── 📁 platform/                   # 🆕 Shared infrastructure
│   │
│   ├── 📁 database/               # Database layer
│   │   ├── 📄 supabase.ts        # Supabase client
│   │   ├── 📄 cache.ts           # Caching layer
│   │   ├── 📁 queries/           # Shared queries
│   │   │   ├── campaigns.ts
│   │   │   ├── articles.ts
│   │   │   ├── ads.ts
│   │   │   └── analytics.ts
│   │   └── 📁 migrations/        # Database migrations
│   │
│   ├── 📁 ai/                     # AI services
│   │   ├── 📄 openai-client.ts   # OpenAI wrapper
│   │   ├── 📄 anthropic-client.ts # Anthropic wrapper
│   │   ├── 📄 prompt-engine.ts   # Prompt management
│   │   ├── 📁 generators/        # Reusable generators
│   │   │   ├── base-generator.ts
│   │   │   └── structured-output.ts
│   │   └── 📁 schemas/           # Validation schemas
│   │       └── zod-schemas.ts
│   │
│   ├── 📁 email/                  # Email infrastructure
│   │   ├── 📄 mailerlite-client.ts
│   │   ├── 📄 template-engine.ts
│   │   ├── 📄 sender.ts
│   │   └── 📁 tracking/
│   │       ├── pixels.ts
│   │       └── links.ts
│   │
│   ├── 📁 workflow-engine/        # Workflow runtime
│   │   ├── 📄 executor.ts        # Workflow execution
│   │   ├── 📄 scheduler.ts       # Cron scheduling
│   │   ├── 📄 logger.ts          # Workflow logging
│   │   └── 📄 types.ts
│   │
│   ├── 📁 content/                # Content processing tools
│   │   ├── 📄 rss-parser.ts      # RSS parsing utility
│   │   ├── 📄 article-extractor.ts # Full text extraction
│   │   ├── 📄 deduplicator.ts    # Deduplication logic
│   │   ├── 📄 web-scraper.ts     # Generic web scraper
│   │   └── 📄 image-processor.ts # Image handling
│   │
│   ├── 📁 ads/                    # Ad platform components
│   │   ├── 📄 scheduler-base.ts  # Base ad scheduler class
│   │   ├── 📄 payment.ts         # Payment processing
│   │   ├── 📄 tracking.ts        # Ad tracking
│   │   └── 📄 types.ts
│   │
│   ├── 📁 integrations/           # External service integrations
│   │   ├── 📄 slack.ts           # Slack notifications
│   │   ├── 📄 github.ts          # GitHub storage
│   │   ├── 📄 stripe.ts          # Payment processing
│   │   └── 📄 analytics.ts       # Analytics tracking
│   │
│   ├── 📁 auth/                   # Authentication
│   │   ├── 📄 next-auth.ts       # NextAuth configuration
│   │   ├── 📄 permissions.ts     # Permission system
│   │   └── 📄 middleware.ts      # Auth middleware
│   │
│   ├── 📁 admin/                  # Admin dashboard framework
│   │   ├── 📁 components/        # Reusable admin components
│   │   ├── 📁 hooks/             # Admin hooks
│   │   └── 📁 utils/             # Admin utilities
│   │
│   └── 📁 monitoring/             # Monitoring & observability
│       ├── 📄 logger.ts          # Centralized logging
│       ├── 📄 metrics.ts         # Metrics collection
│       └── 📄 alerts.ts          # Alert system
│
├── 📁 src/                        # Next.js application
│   │
│   ├── 📁 app/                    # Next.js 15 App Router
│   │   │
│   │   ├── 📁 api/                # API routes
│   │   │   │
│   │   │   ├── 📁 publications/   # Publication-specific routes
│   │   │   │   └── 📁 [pubId]/    # Dynamic publication routes
│   │   │   │       ├── 📁 ingest/
│   │   │   │       │   └── 📄 route.ts
│   │   │   │       ├── 📁 process/
│   │   │   │       │   └── 📄 route.ts
│   │   │   │       ├── 📁 publish/
│   │   │   │       │   └── 📄 route.ts
│   │   │   │       └── 📁 ads/
│   │   │   │           └── 📄 route.ts
│   │   │   │
│   │   │   ├── 📁 cron/           # Cron job endpoints
│   │   │   │   └── 📁 [pubId]/    # Per-publication crons
│   │   │   │       ├── 📁 ingest/
│   │   │   │       │   └── 📄 route.ts
│   │   │   │       ├── 📁 process/
│   │   │   │       │   └── 📄 route.ts
│   │   │   │       └── 📁 publish/
│   │   │   │           └── 📄 route.ts
│   │   │   │
│   │   │   ├── 📁 admin/          # Platform admin API
│   │   │   │   ├── 📁 publications/
│   │   │   │   ├── 📁 users/
│   │   │   │   └── 📁 system/
│   │   │   │
│   │   │   └── 📁 auth/
│   │   │       └── 📁 [...nextauth]/
│   │   │           └── 📄 route.ts
│   │   │
│   │   ├── 📁 dashboard/          # Dashboard UI
│   │   │   └── 📁 [pubId]/        # Per-publication dashboard
│   │   │       ├── 📄 page.tsx    # Main dashboard
│   │   │       ├── 📁 campaigns/
│   │   │       │   ├── 📄 page.tsx
│   │   │       │   └── 📁 [id]/
│   │   │       │       └── 📄 page.tsx
│   │   │       ├── 📁 articles/
│   │   │       │   └── 📄 page.tsx
│   │   │       ├── 📁 ads/
│   │   │       │   └── 📄 page.tsx
│   │   │       └── 📁 settings/
│   │   │           └── 📄 page.tsx
│   │   │
│   │   ├── 📁 admin/              # Platform admin UI
│   │   │   ├── 📄 page.tsx
│   │   │   ├── 📁 publications/
│   │   │   ├── 📁 users/
│   │   │   └── 📁 system/
│   │   │
│   │   ├── 📁 (marketing)/        # Public marketing pages
│   │   │   ├── 📄 page.tsx        # Homepage
│   │   │   ├── 📁 about/
│   │   │   └── 📁 pricing/
│   │   │
│   │   ├── 📄 layout.tsx          # Root layout
│   │   └── 📄 globals.css         # Global styles
│   │
│   ├── 📁 components/             # 🔄 Legacy (gradually migrate)
│   │   └── ... (existing components)
│   │
│   ├── 📁 lib/                    # 🔄 Legacy (gradually migrate)
│   │   └── ... (existing lib files)
│   │
│   ├── 📁 types/                  # TypeScript types
│   │   ├── 📄 publication.ts
│   │   ├── 📄 campaign.ts
│   │   ├── 📄 article.ts
│   │   └── 📄 ad.ts
│   │
│   └── 📄 middleware.ts           # Next.js middleware
│
├── 📁 shared/                     # 🆕 Shared UI/utilities
│   │
│   ├── 📁 components/             # Reusable UI components
│   │   ├── 📁 ui/                 # Base UI components
│   │   │   ├── 📄 Button.tsx
│   │   │   ├── 📄 Card.tsx
│   │   │   ├── 📄 Input.tsx
│   │   │   ├── 📄 Select.tsx
│   │   │   └── 📄 DataTable.tsx
│   │   │
│   │   ├── 📁 forms/              # Form components
│   │   │   ├── 📄 FormField.tsx
│   │   │   └── 📄 FormValidation.tsx
│   │   │
│   │   └── 📁 layout/             # Layout components
│   │       ├── 📄 Header.tsx
│   │       ├── 📄 Sidebar.tsx
│   │       └── 📄 Footer.tsx
│   │
│   ├── 📁 hooks/                  # Reusable React hooks
│   │   ├── 📄 useAuth.ts
│   │   ├── 📄 useDebounce.ts
│   │   ├── 📄 useLocalStorage.ts
│   │   └── 📄 useAsync.ts
│   │
│   ├── 📁 utils/                  # Utility functions
│   │   ├── 📄 dates.ts
│   │   ├── 📄 strings.ts
│   │   ├── 📄 formatting.ts
│   │   └── 📄 validation.ts
│   │
│   └── 📁 types/                  # Shared TypeScript types
│       └── 📄 common.ts
│
├── 📁 public/                     # Static assets
│   ├── 📁 logos/
│   │   ├── ai-news-daily.png
│   │   └── local-digest.png
│   ├── 📁 images/
│   └── 📁 fonts/
│
├── 📁 scripts/                    # Utility scripts
│   ├── 📄 create-publication.js   # CLI to create new pub
│   ├── 📄 migrate-data.js
│   └── 📄 seed-database.js
│
├── 📁 tests/                      # Global tests
│   ├── 📁 integration/
│   ├── 📁 e2e/
│   └── 📄 setup.ts
│
├── 📄 .env.local                  # Environment variables
├── 📄 .env.example                # Example environment
├── 📄 .gitignore
├── 📄 package.json
├── 📄 package-lock.json
├── 📄 tsconfig.json
├── 📄 next.config.js
├── 📄 tailwind.config.ts
├── 📄 vercel.json                 # Vercel configuration
├── 📄 CLAUDE.md                   # Operations guide
└── 📄 README.md
```

### 2.2 Key Structure Decisions

**🆕 New Directories:**
- `publications/` - Publication-specific business logic
- `platform/` - Shared infrastructure
- `shared/` - Shared UI and utilities

**🔄 Legacy Directories (Gradually Migrate):**
- `src/components/` → Move to `shared/components/` or publication-specific
- `src/lib/` → Move to `platform/` or publication-specific
- `src/contexts/` → Move to `shared/` or publication-specific

**📦 Keep As-Is:**
- `src/app/` - Next.js routing (but routes will delegate to publications)
- `public/` - Static assets
- `docs/` - Documentation

---

## 3. Branch-to-Code Mapping

### 3.1 Which Branches Touch Which Code

```
┌─────────────────────────────────────────────────────────────────┐
│ Branch Type → Code Areas                                         │
└─────────────────────────────────────────────────────────────────┘

publication/ai-news/*
├─► publications/ai-news-daily/        (primary)
├─► src/app/dashboard/[pubId]/         (if UI changes)
├─► shared/components/                 (if new shared components)
└─► docs/                              (update docs)

publication/local-digest/*
├─► publications/local-digest/         (primary)
├─► src/app/dashboard/[pubId]/         (if UI changes)
└─► docs/

platform/*
├─► platform/                          (primary)
│   ├─► database/
│   ├─► ai/
│   ├─► email/
│   ├─► workflow-engine/
│   ├─► content/
│   ├─► ads/
│   └─► integrations/
├─► ALL publications may be affected   (must test all!)
└─► docs/

hotfix/*
├─► Any critical file                  (usually platform/)
└─► docs/troubleshooting/

develop
├─► Receives all feature branches
└─► Integration testing

main
├─► Production code (all areas)
└─► Protected from direct changes
```

### 3.2 Impact Radius

```
┌────────────────────────────────────────────────────────────────┐
│ Change Location → Impact Radius                                │
└────────────────────────────────────────────────────────────────┘

publications/ai-news-daily/
  Impact: ● AI News Daily only
  Testing: ▓ Test AI News Daily workflows
  Risk: ▓ Low (isolated)

publications/local-digest/
  Impact: ● Local Digest only
  Testing: ▓ Test Local Digest workflows
  Risk: ▓ Low (isolated)

platform/database/
  Impact: ● ALL publications
  Testing: ▓▓▓ Test ALL publication workflows
  Risk: ▓▓▓ High (affects everything)

platform/ai/
  Impact: ● ALL publications using AI
  Testing: ▓▓▓ Test all AI-dependent workflows
  Risk: ▓▓▓ High

platform/email/
  Impact: ● ALL publications
  Testing: ▓▓▓ Test email sending for all pubs
  Risk: ▓▓▓ High

shared/components/
  Impact: ● All UIs using the component
  Testing: ▓▓ Test affected dashboards
  Risk: ▓▓ Medium

src/app/api/publications/[pubId]/
  Impact: ● Routing for all publications
  Testing: ▓▓ Test all publication routes
  Risk: ▓▓ Medium
```

---

## 4. Workflow Visualizations

### 4.1 Development Workflow with File Changes

```
┌────────────────────────────────────────────────────────────────┐
│ Feature Development Flow: Add Breaking News to AI News Daily   │
└────────────────────────────────────────────────────────────────┘

1. CREATE BRANCH
   ┌─────────────────────────────────────────┐
   │ develop                                 │
   └──────┬──────────────────────────────────┘
          │
          ├──► publication/ai-news/add-breaking-news
          │
          └──► Files checked out:
               publications/ai-news-daily/


2. DEVELOP
   ┌─────────────────────────────────────────┐
   │ Working Directory                       │
   ├─────────────────────────────────────────┤
   │ 📝 CREATE: publications/ai-news-daily/  │
   │            workflows/breaking-news.ts   │
   │                                         │
   │ 📝 EDIT:   publications/ai-news-daily/  │
   │            config.ts                    │
   │            (add breakingNews: true)     │
   │                                         │
   │ 📝 CREATE: publications/ai-news-daily/  │
   │            tests/breaking-news.test.ts  │
   │                                         │
   │ 📝 EDIT:   docs/workflows/              │
   │            breaking-news.md             │
   └─────────────────────────────────────────┘


3. COMMIT
   ┌─────────────────────────────────────────┐
   │ Git Commits                             │
   ├─────────────────────────────────────────┤
   │ ● "feat: add breaking news workflow"   │
   │   - workflows/breaking-news.ts          │
   │   - config.ts                           │
   │                                         │
   │ ● "test: add breaking news tests"      │
   │   - tests/breaking-news.test.ts         │
   │                                         │
   │ ● "docs: document breaking news"       │
   │   - docs/workflows/breaking-news.md     │
   └─────────────────────────────────────────┘


4. PUSH & PR
   ┌─────────────────────────────────────────┐
   │ GitHub Pull Request                     │
   ├─────────────────────────────────────────┤
   │ Title: "Add breaking news to AI News"  │
   │                                         │
   │ Files Changed: 4                        │
   │ +245 additions, -12 deletions           │
   │                                         │
   │ Checks:                                 │
   │ ✅ TypeScript compilation               │
   │ ✅ Tests pass                           │
   │ ✅ Linting                              │
   │ ✅ Vercel preview deployed              │
   │                                         │
   │ Preview URL:                            │
   │ preview-breaking-news.vercel.app        │
   └─────────────────────────────────────────┘


5. REVIEW
   ┌─────────────────────────────────────────┐
   │ Code Review Comments                    │
   ├─────────────────────────────────────────┤
   │ Reviewer: "Looks good! ✅"              │
   │                                         │
   │ Approved                                │
   └─────────────────────────────────────────┘


6. MERGE TO DEVELOP
   ┌─────────────────────────────────────────┐
   │ develop                                 │
   ├─────────────────────────────────────────┤
   │ Now contains:                           │
   │ - Breaking news workflow                │
   │ - Tests                                 │
   │ - Documentation                         │
   │                                         │
   │ Deployed to: staging.yourdomain.com     │
   └─────────────────────────────────────────┘


7. STAGING TEST
   ┌─────────────────────────────────────────┐
   │ Staging Environment                     │
   ├─────────────────────────────────────────┤
   │ Test:                                   │
   │ ✅ Breaking news workflow runs          │
   │ ✅ Articles detected correctly          │
   │ ✅ Emails generated properly            │
   │                                         │
   │ Monitor for 24 hours                    │
   └─────────────────────────────────────────┘


8. MERGE TO MAIN
   ┌─────────────────────────────────────────┐
   │ main (production)                       │
   ├─────────────────────────────────────────┤
   │ Breaking news feature live!             │
   │                                         │
   │ Deployed to: yourdomain.com             │
   └─────────────────────────────────────────┘
```

### 4.2 Platform Change Workflow

```
┌────────────────────────────────────────────────────────────────┐
│ Platform Change Flow: Add Redis Caching                       │
└────────────────────────────────────────────────────────────────┘

1. CREATE BRANCH
   develop ──► platform/add-redis-caching


2. DEVELOP
   ┌─────────────────────────────────────────┐
   │ Files Changed                           │
   ├─────────────────────────────────────────┤
   │ 📝 CREATE: platform/database/cache.ts   │
   │ 📝 EDIT:   platform/database/supabase.ts│
   │ 📝 EDIT:   package.json (add ioredis)   │
   │ 📝 CREATE: platform/database/           │
   │            tests/cache.test.ts          │
   │ 📝 EDIT:   .env.example (add REDIS_URL) │
   │ 📝 EDIT:   docs/platform/caching.md     │
   └─────────────────────────────────────────┘


3. TEST WITH ALL PUBLICATIONS (!)
   ┌─────────────────────────────────────────┐
   │ Critical: Platform changes affect ALL   │
   ├─────────────────────────────────────────┤
   │ ✅ Test AI News Daily workflows         │
   │    - Ingest: ✅ works                   │
   │    - Process: ✅ works                  │
   │    - Publish: ✅ works                  │
   │                                         │
   │ ✅ Test Local Digest workflows          │
   │    - Scrape: ✅ works                   │
   │    - Process: ✅ works                  │
   │    - Publish: ✅ works                  │
   │                                         │
   │ 📊 Performance Metrics:                 │
   │    - Query time: 250ms → 50ms (80% ↓)  │
   │    - Cache hit rate: 85%                │
   └─────────────────────────────────────────┘


4. DETAILED PR
   ┌─────────────────────────────────────────┐
   │ Pull Request                            │
   ├─────────────────────────────────────────┤
   │ Title: "Add Redis caching layer"       │
   │                                         │
   │ Description:                            │
   │ - Adds Redis caching for queries       │
   │ - 80% performance improvement           │
   │ - Backward compatible                   │
   │ - Tested with all publications          │
   │                                         │
   │ Breaking Changes: None                  │
   │                                         │
   │ Rollback Plan:                          │
   │ - Feature flag: ENABLE_REDIS_CACHE      │
   │ - Can disable without redeployment      │
   │                                         │
   │ Reviewers: @platform-team-lead          │
   └─────────────────────────────────────────┘


5. STAGED ROLLOUT
   ┌─────────────────────────────────────────┐
   │ Deployment Strategy                     │
   ├─────────────────────────────────────────┤
   │ Phase 1: Staging (all pubs)             │
   │ - Monitor for 48 hours                  │
   │ - Verify no issues                      │
   │                                         │
   │ Phase 2: Production                     │
   │ - Deploy to main                        │
   │ - Monitor metrics closely               │
   │ - Have rollback ready                   │
   └─────────────────────────────────────────┘
```

### 4.3 Hotfix Workflow

```
┌────────────────────────────────────────────────────────────────┐
│ Hotfix Flow: Email Sending Broken                             │
└────────────────────────────────────────────────────────────────┘

🔥 PRODUCTION ISSUE DETECTED
   ├─► Emails not sending
   ├─► MailerLite API timeouts
   └─► Users reporting no newsletters

1. BRANCH FROM MAIN (!)
   main ──► hotfix/email-sending-broken


2. DIAGNOSE & FIX
   ┌─────────────────────────────────────────┐
   │ Investigation                           │
   ├─────────────────────────────────────────┤
   │ Issue: MailerLite API timeout          │
   │ Root cause: Missing retry logic         │
   │                                         │
   │ Fix: Add exponential backoff retries    │
   └─────────────────────────────────────────┘

   ┌─────────────────────────────────────────┐
   │ Files Changed                           │
   ├─────────────────────────────────────────┤
   │ 📝 EDIT: platform/email/                │
   │          mailerlite-client.ts           │
   │          (add retry logic)              │
   │                                         │
   │ 📝 CREATE: tests/hotfix-verification.ts │
   └─────────────────────────────────────────┘


3. TEST URGENTLY
   ┌─────────────────────────────────────────┐
   │ Hotfix Testing                          │
   ├─────────────────────────────────────────┤
   │ ✅ Unit tests pass                      │
   │ ✅ Manual test: email sends             │
   │ ✅ Retry logic works                    │
   │                                         │
   │ Preview: preview-hotfix.vercel.app      │
   └─────────────────────────────────────────┘


4. MERGE TO MAIN (Emergency)
   ┌─────────────────────────────────────────┐
   │ hotfix/email-sending-broken             │
   │         ↓                               │
   │      main (production)                  │
   ├─────────────────────────────────────────┤
   │ Emergency review (expedited)            │
   │ Approved by: @platform-lead             │
   │                                         │
   │ Deployed: Immediately                   │
   │ Status: ✅ Emails sending again         │
   └─────────────────────────────────────────┘


5. SYNC TO DEVELOP (!)
   ┌─────────────────────────────────────────┐
   │ Critical: Keep develop in sync          │
   ├─────────────────────────────────────────┤
   │ hotfix/email-sending-broken             │
   │         ↓                               │
   │      develop                            │
   │                                         │
   │ This ensures develop doesn't revert fix │
   └─────────────────────────────────────────┘


6. CLEANUP
   delete hotfix/email-sending-broken


7. POST-MORTEM
   ┌─────────────────────────────────────────┐
   │ Document in docs/troubleshooting/       │
   ├─────────────────────────────────────────┤
   │ - What broke                            │
   │ - Why it broke                          │
   │ - How we fixed it                       │
   │ - Prevention steps                      │
   └─────────────────────────────────────────┘
```

### 4.4 Multi-Publication Development

```
┌────────────────────────────────────────────────────────────────┐
│ Parallel Development: Multiple Publications                    │
└────────────────────────────────────────────────────────────────┘

TIMELINE VIEW:

Week 1:
develop
  ├─► publication/ai-news/new-scoring (Dev A working)
  └─► publication/local/add-weather (Dev B working)


Week 2:
develop
  ├─► publication/ai-news/new-scoring (Dev A: PR open)
  ├─► publication/local/add-weather (Dev B: PR open)
  └─► platform/improve-ai (Dev C: starting)


Week 3:
develop
  ├─► [MERGED] publication/ai-news/new-scoring
  │   ✅ AI News Daily: New scoring live in staging
  │
  ├─► [MERGED] publication/local/add-weather
  │   ✅ Local Digest: Weather section live in staging
  │
  └─► platform/improve-ai (Dev C: testing)
      ⚠️  Must test with BOTH publications


Week 4:
develop → main
  ├─► All features deployed to production
  ├─► AI News Daily: New scoring live
  └─► Local Digest: Weather live


ISOLATION DEMONSTRATION:

┌─────────────────────────┐  ┌─────────────────────────┐
│ AI News Daily           │  │ Local Digest            │
├─────────────────────────┤  ├─────────────────────────┤
│ Developer: Alice        │  │ Developer: Bob          │
│ Branch: publication/    │  │ Branch: publication/    │
│         ai-news/*       │  │         local/*         │
│                         │  │                         │
│ Files touched:          │  │ Files touched:          │
│ • publications/         │  │ • publications/         │
│   ai-news-daily/        │  │   local-digest/         │
│                         │  │                         │
│ ✅ No conflicts!        │  │ ✅ No conflicts!        │
│                         │  │                         │
│ Can deploy              │  │ Can deploy              │
│ independently           │  │ independently           │
└─────────────────────────┘  └─────────────────────────┘

┌─────────────────────────────────────────┐
│ Platform Team                           │
├─────────────────────────────────────────┤
│ Developer: Charlie                      │
│ Branch: platform/*                      │
│                                         │
│ Files touched:                          │
│ • platform/                             │
│                                         │
│ ⚠️  AFFECTS BOTH PUBLICATIONS           │
│                                         │
│ Must coordinate with Alice & Bob        │
│ Must test both AI News & Local Digest   │
└─────────────────────────────────────────┘
```

---

## 5. Quick Reference

### 5.1 File Location Quick Guide

**Where does X go?**

| Code Type | Location | Example |
|-----------|----------|---------|
| RSS parsing mechanism | `platform/content/` | `rss-parser.ts` |
| Which RSS feeds to parse | `publications/{pub}/sources/` | `rss-feeds.ts` |
| How to score articles | `publications/{pub}/content/` | `scoring.ts` |
| Database client | `platform/database/` | `supabase.ts` |
| Database queries (shared) | `platform/database/queries/` | `campaigns.ts` |
| AI client (OpenAI) | `platform/ai/` | `openai-client.ts` |
| AI prompts | `publications/{pub}/content/` | `prompts.ts` |
| Email sending | `platform/email/` | `mailerlite-client.ts` |
| Email templates | `publications/{pub}/content/` | `templates.ts` |
| Ad rotation logic | `publications/{pub}/ads/` | `scheduler.ts` |
| Ad tracking | `platform/ads/` | `tracking.ts` |
| Workflow execution | `platform/workflow-engine/` | `executor.ts` |
| Workflow definition | `publications/{pub}/workflows/` | `ingest.ts` |
| UI components (reusable) | `shared/components/` | `Button.tsx` |
| UI components (pub-specific) | `publications/{pub}/components/` | Custom components |
| React hooks (reusable) | `shared/hooks/` | `useAuth.ts` |
| TypeScript types (shared) | `shared/types/` | `common.ts` |
| TypeScript types (pub) | `publications/{pub}/types.ts` | Pub types |
| Configuration | `publications/{pub}/config.ts` | All settings |
| API routes | `src/app/api/publications/[pubId]/` | Delegates to pub |
| Tests (pub-specific) | `publications/{pub}/tests/` | `*.test.ts` |
| Tests (platform) | `platform/{module}/tests/` | `*.test.ts` |
| Documentation | `docs/` | Organized by topic |

### 5.2 Branch Naming Quick Guide

| Task | Branch Name | Merges To |
|------|-------------|-----------|
| Add feature to AI News | `publication/ai-news/feature-name` | `develop` |
| Add feature to Local Digest | `publication/local/feature-name` | `develop` |
| Fix bug in AI News | `publication/ai-news/fix-bug-name` | `develop` |
| Improve platform service | `platform/improvement-name` | `develop` |
| Add new platform service | `platform/add-service-name` | `develop` |
| Production hotfix | `hotfix/issue-description` | `main` + `develop` |
| Experimental feature | `experiment/feature-name` | `develop` (maybe) |

### 5.3 Commit Message Conventions

```
<type>(<scope>): <subject>

Types:
- feat: New feature
- fix: Bug fix
- refactor: Code refactoring
- test: Add/update tests
- docs: Documentation changes
- style: Code style changes (formatting)
- perf: Performance improvements
- chore: Build/tooling changes

Scopes (examples):
- ai-news: AI News Daily publication
- local: Local Digest publication
- platform: Platform services
- database: Database layer
- ai: AI services
- email: Email services
- workflow: Workflow engine

Examples:
feat(ai-news): add breaking news workflow
fix(platform): resolve MailerLite timeout
refactor(local): improve scoring algorithm
test(ai-news): add workflow tests
docs(platform): document caching layer
perf(database): optimize query performance
```

---

## 6. Visual Cheat Sheet

```
┌──────────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE AT A GLANCE                       │
└──────────────────────────────────────────────────────────────────┘

GIT BRANCHES                 FILE STRUCTURE
─────────────               ───────────────

main                        publications/
 └─ develop                  ├─ ai-news-daily/
     ├─ publication/         │   ├─ workflows/
     │   ai-news/*           │   ├─ ads/
     │                       │   ├─ content/
     ├─ publication/         │   └─ config.ts
     │   local/*             │
     │                       ├─ local-digest/
     ├─ platform/*           │   └─ ...
     │                       │
     └─ hotfix/*             └─ _template/

                            platform/
                             ├─ database/
                             ├─ ai/
DEVELOPMENT FLOW            ├─ email/
────────────────            ├─ workflow-engine/
                             ├─ content/
1. Feature Branch            └─ integrations/
   ↓
2. Develop & Commit         src/app/
   ↓                         ├─ api/
3. Push & PR                 │   ├─ publications/[pubId]/
   ↓                         │   ├─ cron/[pubId]/
4. Review                    │   └─ admin/
   ↓                         │
5. Merge to develop          └─ dashboard/[pubId]/
   ↓
6. Test in staging          shared/
   ↓                         ├─ components/
7. Merge to main             ├─ hooks/
   ↓                         └─ utils/
8. Production deploy


WHO WORKS WHERE?           IMPACT RADIUS
────────────────           ─────────────

Publication Team           publications/{pub}/
  ├─ Content strategy        └─► Affects: 1 publication
  ├─ Workflows
  └─ Ad logic              platform/
                              └─► Affects: ALL publications
Platform Team
  ├─ Database              shared/
  ├─ AI services             └─► Affects: All UIs
  └─ Infrastructure

Admin Team
  └─ Admin dashboard
```

---

## 7. Next Steps

### 7.1 Using This Diagram

1. **For navigation:** Use file tree to find where code lives
2. **For planning:** Check branch-to-code mapping before starting work
3. **For coordination:** Check impact radius to understand scope
4. **For workflow:** Follow development flow examples

### 7.2 Keeping This Updated

Update this diagram when:
- Adding new publication
- Adding new platform service
- Changing branch strategy
- Reorganizing file structure

**Document owner:** Architecture team
**Review cycle:** Monthly
**Last updated:** 2025-11-12

---

**Questions?** Refer to:
- `docs/architecture/PUBLICATION_AS_APP_ARCHITECTURE.md` - Detailed architecture
- `CLAUDE.md` - Operations guide
- `docs/architecture/system-overview.md` - Current system
