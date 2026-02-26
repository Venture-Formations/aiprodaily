# AIProDaily — Claude Operations Guide

_Last updated: 2025-12-17_

This is the authoritative playbook for Claude Code when building or updating AIProDaily. Follow the checklist in order, then dive into the linked docs for deep context.

## 1. Quick Start
1. Read **Critical Rules** (below) before touching any file.
2. Identify your task type using **Task Router**.
3. Open the referenced docs via the provided links (use Read tool when needed).
4. Apply patterns from docs/patterns/backend.md and docs/ai/prompt-system.md as needed.
5. Review feature impact in docs/feature-summary.md if the task spans multiple areas.
6. Run appropriate tests/checklists before handing off.

## 2. Quick Commands
```bash
# Development
npm run build              # Verify build before committing
npm run type-check         # TypeScript type checking
npm run lint               # ESLint checks
npm run test:run           # Run unit tests (Vitest)

# Git (auto-deploys to Vercel on push)
git add -A
git commit -m "Description"
git push                   # Triggers Vercel deployment

# Testing endpoints manually
curl -H "Authorization: Bearer $CRON_SECRET" https://yourdomain.com/api/cron/health-check
```

## 3. Critical Rules
- **Multi-tenant isolation:** Every query must filter by `publication_id`.
- **No `select('*')`:** Always use explicit column lists in Supabase queries. Define column constants for tables queried in multiple places (see DAL pattern in `src/lib/dal/issues.ts`). ESLint warns on `.select('*')` — see `docs/patterns/backend.md#column-selection-policy`.
- **Date comparisons:** Use local date strings (`date.split('T')[0]`). Never rely on `toISOString()` or `toUTCString()` for logic.
- **Logging:** One-line summaries with prefixes (`[Workflow]`, `[RSS]`, `[AI]`, `[DB]`, `[CRON]`). Stay under 10MB per invocation.
- **Timeouts:** Vercel workflow step 800s, API route 600s, cron durations as defined in `vercel.json`.
- **Error handling:** Wrap long tasks with retry loops (max 2 retries, 2s delay). Surface failures via `console.error` and let upstream handlers escalate.
- **Confidence gate:** If uncertainty >20%, stop and ask for clarification. Offer options with pros/cons.

## 4. Git Workflow
This project uses a **branch-based workflow** with pull requests:
- **`master`** — Production branch, auto-deploys to Vercel on merge
- All changes go through feature branches and PRs
- Branch naming: `feature/`, `fix/`, `chore/` prefixes
- CI runs on every PR (build, lint, type-check)
- Require code review before merging to `master`

### Pre-Deployment Code Review (REQUIRED)
**Before every `git push`, you MUST run a code review:**
1. Run `mcp__coderabbit__run_review` to check for issues
2. If CodeRabbit CLI is not available, perform a manual review checking:
   - TypeScript errors (`npx tsc --noEmit`)
   - Security issues (no exposed secrets, proper input validation)
   - Multi-tenant isolation (`publication_id` filters on all queries)
   - Error handling (try/catch, proper error responses)
   - Code quality (no unused variables, clear naming)
3. Only push after review passes or issues are addressed

## 5. Task Router
| You are working on… | Open these references | Checklist |
|---------------------|-----------------------|-----------|
| RSS ingestion or workflow | docs/workflows/rss-processing.md, docs/workflows/MULTI_CRITERIA_SCORING_GUIDE.md | Verify step runtime, scoring prompts, dedupe logic. |
| AI prompts / content generation | docs/ai/prompt-system.md, docs/examples/OPENAI_RESPONSES_API_GUIDE.md | Ensure prompt keys exist per tenant, JSON schema matches parser, provider settings valid. |
| AI apps selection / rotation | Section 9 (below), `src/lib/app-selector.ts` | Check cooldown settings, rotation logic, affiliate vs non-affiliate handling. |
| AI Tools Directory | Section 10 (below), `src/app/tools/`, `src/lib/directory.ts` | Check categories, submission flow, entitlements. |
| User accounts / advertiser portal | `src/app/account/`, `src/app/api/account/` | Verify Stripe integration, ad management flows. |
| Events system | `src/app/events/`, `src/app/api/events/` | Check event sync, submission, checkout flow. |
| Database/schema updates | docs/architecture/system-overview.md, db/migrations/ | Maintain `publication_id` filters, update migrations. |
| Advertorials / ads | docs/feature-summary.md (Ads section), `src/lib/newsletter-templates.ts` | Confirm Stage 1/2 unassignment behaviors and ad rotation settings. |
| Campaign dashboard or admin UI | docs/feature-summary.md | Keep React server components aligned with workflow data. |
| Cron / automation | docs/operations/cron-jobs.md, docs/vercel-api.md | Check schedule, secrets, and failure recovery steps. |
| Quick task recipes | docs/recipes/quick-actions.md | Follow step-by-step provisioning or debug checklists. |
| Troubleshooting production issues | docs/troubleshooting/common-issues.md, docs/status/CLEANUP_RECOMMENDATIONS.md | Use symptom-driven guides before modifying code; review outstanding cleanup items. |
| External SDK integrations | docs/vercel-ai-sdk.md, docs/examples/OPENAI_RESPONSES_API_GUIDE.md | Align SDK usage, streaming patterns, and auth configuration. |

## 6. Feature Ownership Map
| Domain | Primary Docs | Key Code Entry Points | Status |
|--------|--------------|-----------------------|--------|
| Issue workflow | docs/workflows/rss-processing.md | `src/lib/workflows/process-rss-workflow.ts`, `/api/workflows/process-rss` | ✅ |
| RSS ingestion & scoring | docs/workflows/MULTI_CRITERIA_SCORING_GUIDE.md | `/api/cron/ingest-rss`, `src/lib/rss-processor.ts` | ✅ |
| AI prompts & scoring | docs/ai/prompt-system.md | `src/lib/openai.ts`, `publication_settings` table | ✅ |
| AI apps selection | Section 9 (below) | `src/lib/app-selector.ts`, `ai_applications` table | ✅ |
| AI Tools Directory | Section 10 (below) | `src/app/tools/`, `src/lib/directory.ts`, `tools` table | ✅ |
| User accounts & billing | — | `src/app/account/`, `/api/account/`, `/api/webhooks/stripe/` | ✅ |
| Advertorials & ads | docs/feature-summary.md | `src/lib/newsletter-templates.ts`, `/api/cron/send-final` | ✅ |
| Dashboard UI | docs/feature-summary.md | `src/app/dashboard/[slug]/` | ✅ |
| Tools Admin | — | `src/app/dashboard/[slug]/tools-admin/` | ✅ |
| Marketing site | docs/feature-summary.md | `src/app/website/` | ✅ |
| Secondary newsletter | — | `/api/cron/send-secondary`, `secondary_articles` table | ✅ |
| Migrations | db/migrations/ | `db/migrations/*.sql` | ✅ |

**Note:** "Issue" replaces "Campaign" in newer code. The `issues` table replaced `newsletter_campaigns`.

## 7. File Structure
See [docs/structure.md](docs/structure.md) for the complete file tree.

**Key directories:**
- `src/lib/` — Core business logic (openai.ts, rss-processor.ts, app-selector.ts, directory.ts)
- `src/app/api/` — API routes (cron/, campaigns/, rss/, debug/, webhooks/, account/, tools/, ads/, ai/, ai-apps/)
- `src/app/api/debug/` — Debug endpoints organized by route groups: (ai), (campaign), (checks), (integrations), (maintenance), (media), (rss), (tests)
- `src/app/dashboard/[slug]/` — Dashboard UI (dynamic per publication)
- `src/app/tools/` — Public AI Tools Directory
- `src/app/account/` — User account & advertiser portal
- `src/app/website/` — Public marketing website
- `db/migrations/` — SQL migration files (89+ files)
- `docs/` — Documentation organized by topic

## 8. Core Workflows (Summary)
1. **RSS ingestion:** `/api/cron/ingest-rss` keeps `rss_posts` pool fresh (Stage 0).
2. **Workflow trigger:** `/api/cron/trigger-workflow` launches ten-step process (see docs/workflows/rss-processing.md).
3. **AI app selection:** `AppSelector.selectAppsForIssue()` picks apps with rotation logic.
4. **Issue review:** Dashboard surfaces drafts with generated content, advertorials, polls.
5. **Final send:** `/api/cron/send-final` pushes to MailerLite, logs Stage 2 cleanup.
6. **Secondary send:** `/api/cron/send-secondary` sends secondary newsletter if configured.
7. **Analytics loop:** Link tracking, polls, feedback feed back into the next cycle.

## 9. AI Apps Selection System
The AI apps system selects apps for each newsletter issue with rotation logic:

### Key Settings (in `publication_settings`)
| Setting | Purpose |
|---------|---------|
| `ai_apps_per_newsletter` | Total apps to include (default: 6) |
| `affiliate_cooldown_days` | Days before affiliate can repeat (default: 7) |
| `ai_apps_*_count` | Required count per category |

### Selection Logic
- **Affiliates:** Subject to cooldown period only, 3x selection priority
- **Non-affiliates:** Cycle through all in category before repeating (no cooldown)
- **Categories with count > 0:** Required slots filled first
- **Filler categories (count = 0):** Fill remaining slots

### Key Files
- `src/lib/app-selector.ts` — Selection logic
- `src/app/dashboard/[slug]/settings/page.tsx` — Settings UI

## 10. Newsletter Module System (Block-Based Sections)
The newsletter uses a modular block-based architecture for dynamic content sections. Each module type follows the same pattern:

### Module Types
| Module Type | Table | Selection Table | Selector |
|-------------|-------|-----------------|----------|
| Prompt Modules | `prompt_modules` | `issue_prompt_modules` | `src/lib/prompt-modules/prompt-selector.ts` |
| AI App Modules | `ai_app_modules` | `issue_ai_app_modules` | `src/lib/app-selector.ts` |
| Ad Modules | `ad_modules` | `issue_ad_modules` | `src/lib/ad-scheduler.ts` |
| Poll Modules | `poll_modules` | `issue_poll_modules` | `src/lib/poll-selector.ts` |

### Common Module Properties
All module types share these core properties:
- `name` — Display name for the section header
- `display_order` — Position in newsletter (lower = higher)
- `is_active` — Whether module appears in newsletters
- `selection_mode` — How content is selected: `sequential`, `random`, `priority`, or `manual`
- `block_order` — Array defining block rendering order (e.g., `['title', 'body']`)

### Selection Modes
| Mode | Behavior |
|------|----------|
| `sequential` | Cycles through content in order, tracks `next_position` |
| `random` | Randomly selects from available content |
| `priority` | Selects highest priority content first |
| `manual` | Requires explicit selection per issue |

### Per-Issue Selections
Each issue gets its own selections stored in `issue_*_modules` tables:
- Selections are created when issue is generated
- Can be manually overridden in the issue editing UI
- `used_at` timestamp records when content was sent

### Key Files
- `src/lib/prompt-modules/` — Prompt module selector and renderer
- `src/components/PromptModulesPanel.tsx` — Issue UI for prompt selections
- `src/components/AIAppModulesPanel.tsx` — Issue UI for AI app selections
- `src/app/api/campaigns/[id]/prompt-modules/route.ts` — API for prompt module selections
- `src/app/api/campaigns/[id]/ai-app-modules/route.ts` — API for AI app module selections

### Database Tables
| Table | Purpose |
|-------|---------|
| `prompt_modules` | Prompt section configuration |
| `issue_prompt_modules` | Per-issue prompt selections |
| `prompt_ideas` | Prompt content pool |
| `ai_app_modules` | AI app section configuration |
| `issue_ai_app_modules` | Per-issue AI app selections |
| `ai_applications` | AI app content pool |
| `newsletter_sections` | Master section ordering across all module types |

## 11. AI Tools Directory System
The AI Tools Directory is a public-facing catalog of AI tools with submission, categorization, and admin features:

### Key Features
- **Public Directory:** Browse tools at `/tools`, view by category at `/tools/category/[slug]`
- **Tool Submissions:** Users submit tools at `/tools/submit`
- **Tool Claims:** Verified owners can claim listings
- **Admin Management:** Dashboard at `/dashboard/[slug]/tools-admin/`

### Key Files
- `src/app/tools/` — Public directory pages
- `src/lib/directory.ts` — Directory business logic
- `src/app/dashboard/[slug]/tools-admin/` — Admin panel (entitlements, packages, settings)
- `src/app/api/tools/` — API routes for tool CRUD

### Database Tables
| Table | Purpose |
|-------|---------|
| `tools` | Tool listings |
| `tool_categories` | Category definitions |
| `tool_claims` | Ownership claims |
| `tool_entitlements` | Feature entitlements |
| `sponsorship_packages` | Sponsorship tiers |

## 12. User Account & Advertiser Portal
The account system provides self-service for advertisers and users:

### Key Features
- **Ad Management:** Create, view, and manage ad campaigns at `/account/ads`
- **Billing:** Stripe-integrated billing at `/account/billing`
- **Profile:** User profile management at `/account/settings`
- **Upgrade:** Subscription upgrades at `/account/upgrade`

### Key Files
- `src/app/account/` — Account pages
- `src/app/api/account/` — Account API routes
- `src/app/api/stripe/` — Stripe webhooks and payment processing

## 13. Implementation Patterns
- Backend template + retry logic: docs/patterns/backend.md
- Supabase admin client only on server routes/actions; never expose service keys client-side.
- Use helpers in `src/lib/` (RSSProcessor, AdScheduler, MailerLiteService, AppSelector, SubjectLineGenerator, WelcomeSectionGenerator) instead of reimplementing logic.
- Respect async boundaries in React Server Components; keep client-only code behind `"use client"` boundaries.

## 14. AI & Scoring
- Prompt conventions and schema: docs/ai/prompt-system.md
- Criteria weighting and adjustments: docs/workflows/MULTI_CRITERIA_SCORING_GUIDE.md
- Example validation snippets: docs/examples/zod-validation-comparison.md, docs/examples/zod-prompt-validation-example.ts

### Prompt Storage
- **Primary:** `publication_settings` table (per-tenant)
- **Fallback:** `app_settings` table (global)
- **Access:** `callAIWithPrompt(promptKey, newsletterId, variables)`
- **Provider:** Auto-detected from model name (claude → Anthropic, else → OpenAI)

## 15. Automation & Ops
- Cron schedules, secrets, recovery: docs/operations/cron-jobs.md
- Vercel deployment & API notes: docs/vercel-api.md
- Testing checklist: docs/checklists/TESTING_CHECKLIST.md
- Monitoring expectations: `[Workflow]`, `[CRON]`, Slack alerts from monitor cron.

### Active Cron Jobs (from `vercel.json`)
| Cron | Schedule | Purpose | Status |
|------|----------|---------|--------|
| `trigger-workflow` | Every 5 min | Launches RSS workflow if schedule permits | ✅ Active |
| `ingest-rss` | Every 15 min | Fetches new posts | ✅ Active |
| `create-campaign` | Every 5 min | Creates issue if schedule permits | ✅ Active |
| `send-review` | Every 5 min | Sends review email when ready | ✅ Active |
| `send-final` | Every 5 min | Sends final newsletter | ✅ Active |
| `send-secondary` | Every 5 min | Sends secondary newsletter | ✅ Active |
| `import-metrics` | Daily 6:00 AM | Syncs MailerLite metrics | ✅ Active |
| `health-check` | Every 5 min (8AM-10PM) | Pings core services | ✅ Active |
| `monitor-workflows` | Every 5 min | Detects stuck workflows | ✅ Active |
| `process-mailerlite-updates` | Every 5 min | Processes MailerLite webhooks | ✅ Active |
| `cleanup-pending-submissions` | Daily 7:00 AM | Clears stale ad submissions | ✅ Active |

## 16. Testing & Verification
Before completing work, confirm:
- `npm run build` passes and affected tests are updated/added.
- `npm run test:run` passes (Vitest unit tests).
- CI enforces a lint warnings ceiling (`--max-warnings 360`). If adding new warnings, increase the ceiling or fix existing ones.
- All new/updated queries filter by `publication_id` and avoid `SELECT *`.
- No UTC conversions introduced for logical comparisons.
- Logging remains concise (one-line summaries, no sensitive data).
- Error handling uses retry loops or graceful fallbacks where appropriate.
- If database changes: migrations added to `db/migrations/`, docs updated, manual verification performed.
- If AI changes: prompts stored in `publication_settings`, structured output validated, rate limits respected.
- Follow docs/checklists/TESTING_CHECKLIST.md for UI validation steps.

**Testing Matrix (examples)**
| Change Type | Run This | Notes |
|-------------|-----------|-------|
| Workflow/core backend | `npm run build`, manual `/api/workflows/process-rss` in staging | Watch Vercel logs for step timings. |
| API route | Unit/integration tests if available; manual POST via Thunder Client with auth | Confirm retry logic + logging. |
| Dashboard UI | `npm run lint`, smoke test in browser, follow UI checklist | Validate multi-tenant data filters. |
| AI prompt updates | Staging dry run of affected step; inspect JSON output | Ensure schema matches parser. |
| Migrations | Apply on staging via Supabase; verify roll-forward/back | Update `docs/migrations/` status file. |
| Marketing site | `npm run build` on marketing app; Lighthouse smoke check | Confirm assets relocated to `public/`. |

## 17. Environment Overview
| Area | Key Env Vars | Notes |
|------|--------------|-------|
| Supabase | `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` | Keep server-only; never expose client side. |
| AI | `OPENAI_API_KEY`, optional `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY` | Set per environment; rate limits vary. |
| Cron/workflows | `CRON_SECRET` | Required for secured cron endpoints. |
| Auth | `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | Ensure correct domain per environment. |
| MailerLite | `MAILERLITE_API_KEY` | Needed for review/final send crons. |
| SendGrid | `SENDGRID_API_KEY` (optional) | Alternative email provider. |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Required for billing/payments. |
| GitHub | `GITHUB_TOKEN`, `GITHUB_REPO` | For image hosting. |
| Google | `GOOGLE_VISION_API_KEY` (optional) | For image analysis. |
| Slack | `SLACK_WEBHOOK_URL` (optional) | Enables alerts from monitor cron. |

## 18. Cross-Feature Checklist
When changes span multiple domains (e.g., workflow + UI):
- Update backend logic and corresponding UI components.
- Adjust prompts or `publication_settings` if new content paths introduced.
- Re-run relevant cron/workflow in staging to confirm end-to-end behavior.
- Update docs: core guide here plus impacted feature doc(s).
- Mention cross-feature impact in pull request notes.

## 19. Documentation Hygiene
- After modifying workflows, prompts, migrations, or notable features, update the specific doc in `docs/` and ensure this guide references it.
- If a new area lacks documentation, create it in the appropriate subfolder (`docs/workflows/`, `docs/guides/`, etc.) and add a reference here.
- Keep links accurate; update them when files move/rename.

## 20. Troubleshooting Primer
If issues arise, start with docs/troubleshooting/common-issues.md. For deeper historical context or session notes, consult docs in `docs/status/` as needed.

### Common Debug Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/api/debug/check-ai-prompts` | Verify prompt configuration |
| `/api/debug/(ai)/ai-apps-status` | Check AI app selection status |
| `/api/debug/(campaign)/recent-campaigns` | List recent campaigns |
| `/api/cron/health-check` | System health status |

## 21. External Integrations
- Vercel AI SDK usage patterns: docs/vercel-ai-sdk.md
- OpenAI Responses API specifics: docs/examples/OPENAI_RESPONSES_API_GUIDE.md
- Vercel API workflows and cron deployment: docs/vercel-api.md
- If Supabase edge cases occur, review platform notes in `docs/migrations/` and Supabase dashboard configuration.

## 22. Security Guidelines
- Never log API keys, secrets, or Personally Identifiable Information.
- Do not bypass authentication/authorization checks in API routes.
- Keep service-role interactions on server only; sanitize user input.
- Audit third-party calls (Slack, MailerLite, Stripe) for retries and error handling.

## 23. Hand-off Notes
- Document any new prompts, migrations, or cron jobs in the appropriate doc before finishing.
- Update `package.json` scripts or environment instructions only after aligning with deployment strategy.
- Leave concise pull request notes summarizing impacted workflows, tests run, and linked docs.
- If documentation gaps remain, add to the relevant subfolder and link here so future updates stay predictable.

Stay disciplined about referencing the supporting docs. If a scenario lacks documentation, create or extend it, then cross-link in this guide to keep Claude—and the team—aligned.
