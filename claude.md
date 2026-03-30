# AIProDaily — Claude Operations Guide

_Last updated: 2026-03-30_

## 1. Quick Start
1. Read **Critical Rules** (below) before touching any file.
2. Check the **directory-level CLAUDE.md** in the area you're working in for specific patterns.
3. Use the **Task Router** to find relevant docs.
4. Run `/impact-check {file}` before modifying shared code.

## 2. Quick Commands
```bash
npm run build              # Verify build before committing
npm run type-check         # TypeScript type checking
npm run lint               # ESLint checks
npm run test:run           # Run unit tests (Vitest)
npm run generate:dep-map   # Regenerate dependency map after structural changes
```

## 3. Critical Rules
- **Multi-tenant isolation:** Every query must filter by `publication_id`.
- **No `select('*')`:** Always use explicit column lists in Supabase queries.
- **Date comparisons:** Use local date strings (`date.split('T')[0]`). Never `toISOString()` for logic.
- **Logging:** One-line summaries with prefixes. Stay under 10MB per invocation.
- **Timeouts:** Vercel workflow step 800s, API route 600s, cron durations per `vercel.json`.
- **Error handling:** Retry loops (max 2 retries, 2s delay). Surface failures via `console.error`.
- **Dependency awareness:** Before modifying `src/lib/` files, check `docs/architecture/DEPENDENCY_MAP.md`. Run `/impact-check {file}` for quick analysis.
- **Confidence gate:** If uncertainty >20%, stop and ask for clarification.

## 4. Directory-Level Guides
Each directory has its own CLAUDE.md with specific patterns and conventions:

| Directory | Focus |
|-----------|-------|
| `src/app/api/CLAUDE.md` | withApiHandler, auth tiers, Zod validation, publication_id |
| `src/app/api/cron/CLAUDE.md` | System auth, GET+POST, maxDuration, scheduling |
| `src/lib/CLAUDE.md` | supabaseAdmin, settings fallback, high-impact files |
| `src/lib/rss-processor/CLAUDE.md` | AI refusal detection, scoring, dedup, module structure |
| `src/lib/newsletter-templates/CLAUDE.md` | Inline styles, MailerLite syntax, tracking URLs |
| `src/app/dashboard/CLAUDE.md` | Client components, fetch patterns, local date parsing |
| `src/app/website/CLAUDE.md` | Server components, SEO/JSON-LD, domain resolution |
| `db/migrations/CLAUDE.md` | Naming convention, publication_id, RLS, indexes |

## 5. Git Workflow
- **`master`** — Production branch, auto-deploys to Vercel on merge
- **`staging`** — Staging branch, deploys to `aiprodaily-staging`
- Branch naming: `feature/`, `fix/`, `chore/` prefixes
- CI runs on every PR (build, lint, type-check)

### Pre-Push Review (REQUIRED)
Before every `git push`, you MUST run:
1. `/simplify` — review changed code for reuse, quality, efficiency
2. `/requesting-code-review` — run CodeRabbit or manual review
3. `/review:pre-push` — run pre-push review gate

## 6. Task Router
| Working on… | References |
|-------------|-----------|
| RSS ingestion / workflow | docs/workflows/rss-processing.md, docs/workflows/MULTI_CRITERIA_SCORING_GUIDE.md |
| AI prompts / content | docs/ai/prompt-system.md, docs/examples/OPENAI_RESPONSES_API_GUIDE.md |
| AI apps rotation | `src/lib/app-selector.ts`, Section 8 below |
| AI Tools Directory | `src/app/tools/`, `src/lib/directory.ts` |
| Accounts / ads | `src/app/account/`, `src/app/api/account/` |
| Events | `src/app/events/`, `src/app/api/events/` |
| Database / schema | docs/architecture/system-overview.md, `db/migrations/` |
| Cron / automation | docs/operations/cron-jobs.md, `vercel.json` |
| Staging environment | docs/operations/staging-supabase-implementation-plan.md |
| Troubleshooting | docs/troubleshooting/common-issues.md |
| Publication provisioning | docs/recipes/provision-publication.md |
| Dependency impact | docs/architecture/DEPENDENCY_MAP.md, `/impact-check` |

## 7. Core Workflows
1. **RSS ingestion:** `/api/cron/ingest-rss` populates `rss_posts` pool
2. **Workflow trigger:** `/api/cron/trigger-workflow` launches 10-step process
3. **AI app selection:** `AppSelector.selectAppsForIssue()` with rotation logic
4. **Issue review:** Dashboard surfaces drafts with generated content
5. **Final send:** `/api/cron/send-final` pushes to MailerLite
6. **Secondary send:** `/api/cron/send-secondary` if configured
7. **Analytics loop:** Link tracking, polls, feedback feed back into next cycle

## 8. AI Apps Selection
Settings in `publication_settings`: `ai_apps_per_newsletter`, `affiliate_cooldown_days`, `ai_apps_*_count`

- **Affiliates:** Cooldown period, 3x priority
- **Non-affiliates:** Cycle through all before repeating
- **Categories with count > 0:** Required slots first, then fillers

## 9. Module System
Newsletter uses block-based modules. Each type has a config table, per-issue selection table, and selector class:

| Module | Config Table | Selector |
|--------|-------------|----------|
| Articles | `article_modules` | `src/lib/article-modules/` |
| Prompts | `prompt_modules` | `src/lib/prompt-modules/` |
| AI Apps | `ai_app_modules` | `src/lib/ai-app-modules/` |
| Ads | `ad_modules` | `src/lib/ad-modules/` |
| Polls | `poll_modules` | `src/lib/poll-modules/` |

Selection modes: `sequential`, `random`, `priority`, `manual`

## 10. AI & Scoring
- Prompts stored in `publication_settings` (per-tenant), fallback to `app_settings`
- Access: `callAIWithPrompt(promptKey, newsletterId, variables)`
- Provider auto-detected from model name (claude → Anthropic, else → OpenAI)
- See docs/ai/prompt-system.md for conventions

## 11. Staging Environment
| Component | Production | Staging |
|-----------|-----------|---------|
| Vercel | `aiprodaily` | `aiprodaily-staging` |
| Branch | `master` | `staging` |
| Supabase | `vsbdfrqfokoltgjyiivq` | `cbnecpswmjonbdatxzwv` |
| Crons | Always on | `CRON_ENABLED=false` |

Key helpers: `isStaging()`, `isCronEnabled()` in `src/lib/env-guard.ts`
Scripts: `npm run migrate:staging`, `npm run refresh-staging`, `npm run sync-staging`

## 12. Environment Variables
| Area | Key Vars |
|------|----------|
| Supabase | `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` |
| AI | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY` |
| Cron | `CRON_SECRET` |
| Auth | `NEXTAUTH_SECRET`, `NEXTAUTH_URL` |
| Email | `MAILERLITE_API_KEY`, `SENDGRID_API_KEY` |
| Payments | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Integrations | `GITHUB_TOKEN`, `SLACK_WEBHOOK_URL` |

## 13. Testing & Verification
- `npm run build` passes
- `npm run test:run` passes
- Lint ceiling: `--max-warnings 360`
- All queries filter by `publication_id`, no `SELECT *`
- No UTC conversions for date logic
- Bug-pattern checks: `npm run check:bug-patterns`
- RSS workflow tests: `npm run test:rss-workflow`
- See docs/checklists/TESTING_CHECKLIST.md for full checklist

## 14. Security
- Never log API keys, secrets, or PII
- Use `supabaseAdmin` server-side only — never expose service keys
- Sanitize user input; validate with Zod schemas
- All API routes use `withApiHandler` for auth enforcement

## 15. Debug Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/api/debug/check-ai-prompts` | Verify prompt config |
| `/api/debug/(ai)/ai-apps-status` | AI app selection status |
| `/api/debug/(campaign)/recent-campaigns` | Recent campaigns |
| `/api/cron/health-check` | System health |

## 16. CCPM (Project Management)
Uses Claude Code PM for spec-driven development and GitHub issue tracking.

| Command | Purpose |
|---------|---------|
| `/pm:prd-new` | Create PRD |
| `/pm:epic-oneshot` | Decompose into issues |
| `/pm:issue-start` | Pick up issue, create branch |
| `/pm:issue-sync` | Post progress to GitHub |
| `/pm:epic-merge` | Merge parallel work |

CCPM rules in `.claude/rules/` coexist with project rules. Project rules take priority on conflicts.

**Note:** "Issue" replaces "Campaign" in newer code. The `issues` table replaced `newsletter_campaigns`.
