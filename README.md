# AIProDaily

AI-powered newsletter platform that automates RSS ingestion, AI content generation, and email delivery via MailerLite. Built with Next.js 15, Supabase, and OpenAI.

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+
- **Supabase** project ([create one free](https://supabase.com/dashboard))
- **OpenAI** API key
- **MailerLite** account and API key
- **GitHub** personal access token (for image uploads)

Optional: Google OAuth credentials, Stripe keys, Clerk keys, SparkLoop API key.

## Getting Started

```bash
# 1. Clone the repo
git clone <repo-url>
cd ai-pros-newsletter

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your actual keys (see .env.example for details)

# 4. Run the dev server
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server |
| `npm run build` | Production build (run before pushing) |
| `npm run lint` | ESLint checks |
| `npm run type-check` | TypeScript type checking |

## Project Structure

```
src/
  app/
    api/          # API routes (cron/, campaigns/, rss/, webhooks/, debug/)
    dashboard/    # Admin dashboard (per-publication)
    tools/        # Public AI Tools Directory
    account/      # User accounts & advertiser portal
    website/      # Marketing site
  lib/            # Core business logic
    rss-processor.ts    # RSS ingestion & AI content generation
    app-selector.ts     # AI app rotation for newsletters
    newsletter-templates.ts  # Email template rendering
    directory.ts        # AI Tools Directory logic
  components/     # Shared React components
db/
  migrations/     # SQL migration files
docs/             # Architecture & workflow documentation
```

## Database Setup

This project uses Supabase (PostgreSQL). After creating a Supabase project:

1. Copy your project URL, anon key, and service role key into `.env.local`
2. Apply migrations from `db/migrations/` via the Supabase SQL Editor
3. See `docs/architecture/system-overview.md` for schema details

## Git Workflow

We use a **branch-based workflow** with pull requests:

1. Create a feature branch from `master`: `git checkout -b feature/your-feature`
2. Make your changes and commit
3. Push and open a PR against `master`
4. CI checks must pass (build, lint, type-check)
5. Get a code review before merging
6. Merging to `master` auto-deploys to production via Vercel

See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines.

## Key Documentation

| Topic | File |
|-------|------|
| Operations guide (comprehensive) | [CLAUDE.md](CLAUDE.md) |
| RSS workflow | [docs/workflows/rss-processing.md](docs/workflows/rss-processing.md) |
| AI prompts & scoring | [docs/ai/prompt-system.md](docs/ai/prompt-system.md) |
| Cron jobs | [docs/operations/cron-jobs.md](docs/operations/cron-jobs.md) |
| System architecture | [docs/architecture/system-overview.md](docs/architecture/system-overview.md) |
| Troubleshooting | [docs/troubleshooting/common-issues.md](docs/troubleshooting/common-issues.md) |

## Architecture Overview

1. **RSS Ingestion** - Cron fetches RSS feeds into a post pool
2. **Workflow** - 10-step pipeline scores, selects, and generates AI content for articles
3. **Issue Review** - Dashboard surfaces drafts for human review
4. **Send** - Final newsletter pushed to MailerLite, analytics tracked
5. **Secondary Newsletter** - Optional secondary send with different content

All data is multi-tenant, scoped by `publication_id`.

## License

Proprietary. All rights reserved.
