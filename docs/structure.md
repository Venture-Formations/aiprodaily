# Project Structure Guide

_Last updated: 2025-12-17_

## Complete File Tree

```
aiprodaily/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── api/                   # API routes
│   │   │   ├── cron/              # Scheduled jobs (15+ cron endpoints)
│   │   │   ├── campaigns/         # Campaign management
│   │   │   ├── rss/               # RSS processing endpoints
│   │   │   ├── settings/          # Settings endpoints
│   │   │   ├── ai/                # AI prompt testing
│   │   │   ├── ai-apps/           # AI application management
│   │   │   ├── ads/               # Advertisement management
│   │   │   ├── events/            # Events API
│   │   │   ├── tools/             # Tools directory API
│   │   │   ├── account/           # User account API
│   │   │   ├── stripe/            # Stripe webhooks & payments
│   │   │   ├── workflows/         # Workflow trigger endpoints
│   │   │   └── debug/             # Debug endpoints (grouped by function)
│   │   │       ├── (ai)/          # AI-related debug tools
│   │   │       ├── (campaign)/    # Campaign debug tools
│   │   │       ├── (checks)/      # Validation checks (50+ endpoints)
│   │   │       ├── (maintenance)/ # Maintenance utilities
│   │   │       ├── (rss)/         # RSS debug tools
│   │   │       ├── (integrations)/# External service debugging
│   │   │       ├── (media)/       # Image/media debugging
│   │   │       └── (tests)/       # Test endpoints
│   │   │
│   │   ├── dashboard/[slug]/      # Dashboard (dynamic publication slug)
│   │   │   ├── page.tsx           # Main dashboard
│   │   │   ├── issues/            # Issue management
│   │   │   ├── analytics/         # Analytics views
│   │   │   ├── databases/         # Data management (ads, ai-apps, articles, images, manual-articles, prompt-ideas, rss-sources)
│   │   │   ├── polls/             # Poll management
│   │   │   ├── settings/          # Publication settings
│   │   │   └── tools-admin/       # Tools directory admin (entitlements, packages, settings)
│   │   │
│   │   ├── tools/                 # Public AI Tools Directory
│   │   │   ├── page.tsx           # Tools listing
│   │   │   ├── [id]/              # Individual tool pages
│   │   │   ├── categories/        # Category listing
│   │   │   ├── category/[slug]/   # Category pages
│   │   │   └── submit/            # Tool submission form
│   │   │
│   │   ├── account/               # User Account Portal
│   │   │   ├── page.tsx           # Account dashboard
│   │   │   ├── ads/               # Ad management (view, create, approve)
│   │   │   ├── billing/           # Billing management
│   │   │   ├── settings/          # Account settings
│   │   │   └── upgrade/           # Subscription upgrade
│   │   │
│   │   ├── events/                # Events System (⚠️ folder structure only, routes not implemented)
│   │   │   ├── [id]/              # Event detail pages (empty)
│   │   │   ├── submit/            # Event submission (empty)
│   │   │   ├── checkout/          # Event checkout (empty)
│   │   │   ├── success/           # Checkout success (empty)
│   │   │   └── view/              # Event viewing (empty)
│   │   │
│   │   ├── website/               # Public website
│   │   │   ├── page.tsx           # Homepage
│   │   │   ├── newsletter/        # Newsletter archive
│   │   │   ├── newsletters/       # Newsletter listing
│   │   │   ├── subscribe/         # Subscription pages
│   │   │   └── contactus/         # Contact form
│   │   │
│   │   ├── auth/                  # Authentication pages
│   │   ├── admin/                 # Admin pages
│   │   ├── ads/                   # Ad submission pages
│   │   ├── feedback/              # Feedback pages
│   │   ├── poll/                  # Poll voting pages
│   │   ├── layout.tsx             # Root layout
│   │   └── globals.css            # Global styles
│   │
│   ├── lib/                       # Core business logic
│   │   ├── openai.ts              # AI services (callAIWithPrompt, etc.)
│   │   ├── rss-processor.ts       # RSS feed processing
│   │   ├── app-selector.ts        # AI app selection/rotation
│   │   ├── mailerlite.ts          # MailerLite email integration
│   │   ├── sendgrid.ts            # SendGrid email integration
│   │   ├── supabase.ts            # Database client
│   │   ├── newsletter-templates.ts # Email HTML templates
│   │   ├── ad-scheduler.ts        # Ad rotation logic
│   │   ├── deduplicator.ts        # Content deduplication
│   │   ├── article-extractor.ts   # Full-text extraction
│   │   ├── github-storage.ts      # Image hosting
│   │   ├── slack.ts               # Slack notifications
│   │   ├── auth.ts                # NextAuth configuration
│   │   ├── url-tracking.ts        # Link tracking
│   │   ├── directory.ts           # Tools directory logic
│   │   ├── subject-line-generator.ts # Subject line generation
│   │   ├── welcome-section-generator.ts # Welcome section generation
│   │   ├── breaking-news-processor.ts # Breaking news handling
│   │   ├── schedule-checker.ts    # Schedule validation
│   │   ├── email-metrics.ts       # Email analytics
│   │   ├── newsletter-archiver.ts # Archive management
│   │   ├── perplexity.ts          # Perplexity AI integration
│   │   ├── google-vision.ts       # Google Vision API
│   │   ├── gmail-service.ts       # Gmail integration
│   │   ├── wordle-scraper.ts      # Wordle data scraping
│   │   ├── road-work-scraper.ts   # Road work data
│   │   ├── prompt-selector.ts     # Prompt selection logic
│   │   ├── publication-settings.ts # Publication settings helpers
│   │   ├── workflows/             # Workflow definitions
│   │   │   ├── process-rss-workflow.ts
│   │   │   ├── create-issue-workflow.ts
│   │   │   └── reprocess-articles-workflow.ts
│   │   └── validation/            # Zod schemas
│   │       ├── article-schemas.ts
│   │       └── prompt-schemas.ts
│   │
│   ├── components/                # React components
│   │   ├── ui/                    # Base UI components (Button, Card, etc.)
│   │   ├── website/               # Public website components
│   │   ├── Layout.tsx             # Dashboard layout
│   │   └── ...                    # Feature-specific components
│   │
│   ├── contexts/                  # React contexts
│   │   └── NewsletterContext.tsx  # Publication context
│   │
│   ├── types/                     # TypeScript types
│   │   ├── database.ts            # Database entity types
│   │   ├── workflow-states.ts     # Workflow state types
│   │   └── next-auth.d.ts         # Auth type extensions
│   │
│   ├── utils/                     # Utility functions
│   └── middleware.ts              # Next.js middleware
│
├── docs/                          # Documentation
│   ├── ai/                        # AI/prompt system docs
│   │   └── prompt-system.md
│   ├── workflows/                 # Workflow documentation
│   │   ├── rss-processing.md
│   │   ├── MULTI_CRITERIA_SCORING_GUIDE.md
│   │   └── RSS_INGESTION_IMPLEMENTATION.md
│   ├── guides/                    # Feature implementation guides
│   ├── operations/                # Cron jobs, ops docs
│   │   └── cron-jobs.md
│   ├── migrations/                # Migration guides
│   ├── architecture/              # Architecture docs
│   ├── troubleshooting/           # Issue resolution
│   ├── checklists/                # Testing/deployment checklists
│   ├── examples/                  # Code examples
│   ├── patterns/                  # Design patterns
│   ├── recipes/                   # Quick action guides
│   └── status/                    # Session notes, cleanup status
│
├── db/                            # Database
│   └── migrations/                # SQL migration files (89 files)
│
├── scripts/                       # Utility scripts
│   ├── maintenance/               # Maintenance scripts
│   ├── tests/                     # Test scripts
│   └── tools/                     # Developer tools
│
├── apps/                          # Additional apps (currently empty)
│
├── public/                        # Static assets
│   └── images/                    # Public images (93 files)
│
├── vercel.json                    # Cron schedules (15 crons), function configs
├── package.json                   # Dependencies, scripts
├── tsconfig.json                  # TypeScript config
├── next.config.js                 # Next.js config
├── CLAUDE.md                      # Claude operations guide
└── README.md                      # Project readme
```

## Key Directories Explained

### `src/lib/` — Core Business Logic
All shared business logic lives here. Key files:

| File | Purpose |
|------|---------|
| `openai.ts` | AI services, `callAIWithPrompt()`, prompt loading |
| `rss-processor.ts` | RSS feed fetching, article processing, scoring |
| `app-selector.ts` | AI app selection with rotation logic |
| `mailerlite.ts` | MailerLite email campaign creation and sending |
| `sendgrid.ts` | SendGrid email integration (alternative provider) |
| `supabase.ts` | Database client (admin and anon) |
| `newsletter-templates.ts` | HTML email generation |
| `directory.ts` | Tools directory business logic |
| `subject-line-generator.ts` | Subject line AI generation |
| `welcome-section-generator.ts` | Welcome section AI generation |
| `schedule-checker.ts` | Publication schedule validation |
| `email-metrics.ts` | Email analytics processing |
| `breaking-news-processor.ts` | Breaking news handling |
| `perplexity.ts` | Perplexity AI integration |
| `workflows/` | Multi-step workflow definitions |

### `src/app/api/cron/` — Scheduled Jobs
Cron jobs triggered by Vercel (schedules in `vercel.json`):

| Endpoint | Schedule | Purpose | Status |
|----------|----------|---------|--------|
| `trigger-workflow` | Every 5 min | Launches RSS workflow | ✅ |
| `ingest-rss` | Every 15 min | Fetches new posts | ✅ |
| `send-review` | Every 5 min | Creates MailerLite campaign and sends review email | ✅ |
| `send-final` | Every 5 min | Sends final newsletter | ✅ |
| `send-secondary` | Every 5 min | Sends secondary newsletter | ✅ |
| `import-metrics` | Daily 6 AM | Syncs MailerLite stats | ✅ |
| `health-check` | Every 5 min (8AM-10PM) | System health | ✅ |
| `monitor-workflows` | Every 5 min | Detects stuck workflows | ✅ |
| `process-mailerlite-updates` | Every 5 min | Processes MailerLite webhooks | ✅ |
| `cleanup-pending-submissions` | Daily 7 AM | Clears stale ad submissions | ✅ |
| `populate-events` | Every 5 min | Populates events for issues | ⚠️ Empty |
| `sync-events` | Daily midnight | Syncs event data | ⚠️ Empty |
| `generate-weather` | Daily 8 PM | Weather module generation | ⚠️ Empty |
| `collect-wordle` | Daily 7 PM | Wordle stats collection | ⚠️ Empty |

**Note:** Endpoints marked "Empty" have folders but no `route.ts` implementation.

### `src/app/api/debug/` — Debug Endpoints
Organized into route groups for discoverability:
- `(ai)/` — AI prompt testing, app status
- `(campaign)/` — Campaign debugging
- `(checks)/` — Validation and health checks
- `(maintenance)/` — Data fixes, migrations
- `(tests)/` — Test harnesses

### `src/app/dashboard/[slug]/` — Dashboard UI
Dynamic routes per publication. The `[slug]` parameter identifies the publication (e.g., `accounting`).

Includes:
- `issues/` — Issue management and editing
- `analytics/` — Performance analytics (articles, issues, polls, ads, AI apps)
- `databases/` — Data management (ads, ai-apps, articles, images, manual-articles, prompt-ideas, rss-sources)
- `polls/` — Poll management
- `settings/` — Publication settings including AI prompt testing
- `tools-admin/` — Tools directory admin (entitlements, packages, settings)

### `src/app/tools/` — Public AI Tools Directory
Public-facing directory of AI tools with:
- Tool listings and search
- Category browsing
- Individual tool detail pages
- Tool submission form for new listings

### `src/app/account/` — User Account Portal
Self-service portal for users and advertisers:
- Ad management (create, view, manage campaigns)
- Billing and subscription management (Stripe integration)
- Profile settings
- Subscription upgrades

### `src/app/events/` — Events System
⚠️ **Status: Not Implemented** — Folder structure exists but all routes are empty.

Planned features:
- Event viewing and detail pages
- Event submission form
- Checkout and payment flow
- Success/confirmation pages

Requires implementation of API routes at `src/app/api/events/` and cron jobs.

### `docs/` — Documentation
Organized by topic:
- `workflows/` — How data flows through the system
- `guides/` — Feature implementation details
- `operations/` — Cron jobs, monitoring
- `migrations/` — Database changes
- `troubleshooting/` — Problem resolution

## Database Tables (Key)
| Table | Purpose |
|-------|---------|
| `publications` | Newsletter definitions |
| `publication_settings` | Per-tenant settings (prompts, configs) |
| `issues` | Newsletter issues |
| `rss_posts` | Ingested RSS content |
| `issue_articles` | Primary articles assigned to issues |
| `secondary_articles` | Secondary articles for issues |
| `manual_articles` | Manually created articles |
| `ai_applications` | AI apps for rotation |
| `issue_ai_app_selections` | AI apps selected per issue |
| `advertisements` | Ad inventory |
| `tools` | AI tools directory listings |
| `tool_categories` | Tool category definitions |
| `tool_claims` | Tool ownership claims |
| `tool_entitlements` | Tool feature entitlements |
| `sponsorship_packages` | Sponsorship tier definitions |
| `events` | Community events |
| `polls` | Audience polls |
| `poll_responses` | Poll response data |
| `contact_submissions` | Contact form submissions |

## Configuration Files
| File | Purpose |
|------|---------|
| `vercel.json` | Cron schedules, function timeouts |
| `next.config.js` | Next.js configuration |
| `tailwind.config.ts` | Tailwind CSS customization |
| `.env.local` | Environment variables (not committed) |
| `claude.md` | AI assistant operations guide |

## Quick Commands
```bash
# Development
npm run build              # Build and type-check
npm run dev                # Start dev server
npm run lint               # ESLint

# Database migrations
psql -f db/migrations/<file>.sql
# Or use Supabase SQL editor

# Maintenance scripts
node scripts/maintenance/<script>.js

# Manual tests
node scripts/tests/<script>.js
bash scripts/tests/<script>.sh
```
