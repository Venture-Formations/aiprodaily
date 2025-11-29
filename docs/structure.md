# Project Structure Guide

_Last updated: 2025-11-28_

## Complete File Tree

```
aiprodaily/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── api/                   # API routes
│   │   │   ├── cron/              # Scheduled jobs (trigger-workflow, ingest-rss, etc.)
│   │   │   ├── campaigns/         # Campaign management
│   │   │   ├── rss/               # RSS processing endpoints
│   │   │   ├── settings/          # Settings endpoints
│   │   │   ├── ai/                # AI prompt testing
│   │   │   ├── ai-apps/           # AI application management
│   │   │   ├── ads/               # Advertisement management
│   │   │   ├── workflows/         # Workflow trigger endpoints
│   │   │   └── debug/             # Debug endpoints (grouped by function)
│   │   │       ├── (ai)/          # AI-related debug tools
│   │   │       ├── (campaign)/    # Campaign debug tools
│   │   │       ├── (checks)/      # Validation checks
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
│   │   │   ├── databases/         # Data management
│   │   │   ├── polls/             # Poll management
│   │   │   └── settings/          # Publication settings
│   │   │
│   │   ├── website/               # Public website
│   │   │   ├── page.tsx           # Homepage
│   │   │   ├── newsletter/        # Newsletter archive
│   │   │   ├── newsletters/       # Newsletter listing
│   │   │   ├── subscribe/         # Subscription pages
│   │   │   └── contactus/         # Contact form
│   │   │
│   │   ├── auth/                  # Authentication pages
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
│   │   ├── mailerlite.ts          # Email service integration
│   │   ├── supabase.ts            # Database client
│   │   ├── newsletter-templates.ts # Email HTML templates
│   │   ├── ad-scheduler.ts        # Ad rotation logic
│   │   ├── deduplicator.ts        # Content deduplication
│   │   ├── article-extractor.ts   # Full-text extraction
│   │   ├── github-storage.ts      # Image hosting
│   │   ├── slack.ts               # Slack notifications
│   │   ├── auth.ts                # NextAuth configuration
│   │   ├── url-tracking.ts        # Link tracking
│   │   ├── workflows/             # Workflow definitions
│   │   │   ├── process-rss-workflow.ts
│   │   │   ├── create-issue-workflow.ts
│   │   │   └── reprocess-articles-workflow.ts
│   │   └── validation/            # Zod schemas
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
│   └── migrations/                # SQL migration files
│
├── scripts/                       # Utility scripts
│   ├── maintenance/               # Maintenance scripts
│   ├── tests/                     # Test scripts
│   └── tools/                     # Developer tools
│
├── apps/                          # Additional apps
│   └── marketing/                 # Standalone marketing site
│
├── public/                        # Static assets
│   └── logo.png
│
├── vercel.json                    # Cron schedules, function configs
├── package.json                   # Dependencies, scripts
├── tsconfig.json                  # TypeScript config
├── tailwind.config.ts             # Tailwind CSS config
├── next.config.js                 # Next.js config
├── claude.md                      # Claude operations guide
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
| `mailerlite.ts` | Email campaign creation and sending |
| `supabase.ts` | Database client (admin and anon) |
| `newsletter-templates.ts` | HTML email generation |
| `workflows/` | Multi-step workflow definitions |

### `src/app/api/cron/` — Scheduled Jobs
Cron jobs triggered by Vercel (schedules in `vercel.json`):

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `trigger-workflow` | Every 5 min | Launches RSS workflow |
| `ingest-rss` | Every 15 min | Fetches new posts |
| `send-review` | Every 5 min | Sends review emails |
| `send-final` | Every 5 min | Sends final newsletter |
| `import-metrics` | Daily 6 AM | Syncs MailerLite stats |
| `health-check` | Every 5 min (8AM-10PM) | System health |
| `monitor-workflows` | Every 5 min | Detects stuck workflows |

### `src/app/api/debug/` — Debug Endpoints
Organized into route groups for discoverability:
- `(ai)/` — AI prompt testing, app status
- `(campaign)/` — Campaign debugging
- `(checks)/` — Validation and health checks
- `(maintenance)/` — Data fixes, migrations
- `(tests)/` — Test harnesses

### `src/app/dashboard/[slug]/` — Dashboard UI
Dynamic routes per publication. The `[slug]` parameter identifies the publication (e.g., `accounting`).

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
| `issue_articles` | Articles assigned to issues |
| `ai_applications` | AI apps for rotation |
| `issue_ai_app_selections` | AI apps selected per issue |
| `advertisements` | Ad inventory |

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
