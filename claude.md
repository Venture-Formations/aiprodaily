# AIProDaily — Claude Operations Guide

_Last updated: 2025-11-28_

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

# Git (auto-deploys to Vercel on push)
git add -A
git commit -m "Description"
git push                   # Triggers Vercel deployment

# Testing endpoints manually
curl -H "Authorization: Bearer $CRON_SECRET" https://yourdomain.com/api/cron/health-check
```

## 3. Critical Rules
- **Multi-tenant isolation:** Every query must filter by `publication_id`.
- **Date comparisons:** Use local date strings (`date.split('T')[0]`). Never rely on `toISOString()` or `toUTCString()` for logic.
- **Logging:** One-line summaries with prefixes (`[Workflow]`, `[RSS]`, `[AI]`, `[DB]`, `[CRON]`). Stay under 10MB per invocation.
- **Timeouts:** Vercel workflow step 800s, API route 600s, cron durations as defined in `vercel.json`.
- **Error handling:** Wrap long tasks with retry loops (max 2 retries, 2s delay). Surface failures via `console.error` and let upstream handlers escalate.
- **Confidence gate:** If uncertainty >20%, stop and ask for clarification. Offer options with pros/cons.

## 4. Git Workflow
This project uses a **single branch** workflow:
- **`master`** — Main branch, auto-deploys to production via Vercel
- No separate `develop` or `main` branches
- Push directly to `master` for all changes
- Vercel automatically deploys on every push

## 5. Task Router
| You are working on… | Open these references | Checklist |
|---------------------|-----------------------|-----------|
| RSS ingestion or campaign workflow | docs/workflows/rss-processing.md, docs/workflows/RSS_INGESTION_IMPLEMENTATION.md, docs/workflows/MULTI_CRITERIA_SCORING_GUIDE.md | Verify step runtime, scoring prompts, dedupe logic. |
| AI prompts / content generation | docs/ai/prompt-system.md, docs/examples/AI_PROMPT_SYSTEM_GUIDE.md, docs/examples/OPENAI_RESPONSES_API_GUIDE.md | Ensure prompt keys exist per tenant, JSON schema matches parser, provider settings valid. |
| AI apps selection / rotation | docs/guides/AI_APPS_IMPLEMENTATION_GUIDE.md, docs/guides/AFFILIATE_APPS_IMPLEMENTATION.md | Check cooldown settings, rotation logic, affiliate vs non-affiliate handling. |
| Database/schema updates | docs/architecture/system-overview.md, docs/migrations/MULTI_TENANT_MIGRATION_GUIDE.md, docs/migrations/DATABASE_SETUP_GUIDE.md | Maintain `publication_id` filters, update migrations + status docs. |
| Advertorials / ads | docs/guides/IMPLEMENTATION_COMPLETE_HYBRID_RSS.md, docs/guides/SECONDARY_ARTICLES_IMPLEMENTATION_GUIDE.md | Confirm Stage 1/2 unassignment behaviors and ad rotation settings. |
| Campaign dashboard or admin UI | docs/feature-summary.md, docs/guides/FEATURE_WELCOME_SECTION.md | Keep React server components aligned with workflow data. |
| Cron / automation | docs/operations/cron-jobs.md, docs/vercel-api.md | Check schedule, secrets, and failure recovery steps. |
| Quick task recipes | docs/recipes/quick-actions.md | Follow step-by-step provisioning or debug checklists. |
| Troubleshooting production issues | docs/troubleshooting/common-issues.md, docs/status/CLEANUP_RECOMMENDATIONS.md | Use symptom-driven guides before modifying code; review outstanding cleanup items. |
| External SDK integrations | docs/vercel-ai-sdk.md, docs/examples/OPENAI_RESPONSES_API_GUIDE.md | Align SDK usage, streaming patterns, and auth configuration. |

## 6. Feature Ownership Map
| Domain | Primary Docs | Key Code Entry Points |
|--------|--------------|-----------------------|
| Campaign workflow | docs/workflows/rss-processing.md | `src/lib/workflows/process-rss-workflow.ts`, `/api/workflows/process-rss` |
| RSS ingestion & scoring | docs/workflows/RSS_INGESTION_IMPLEMENTATION.md, docs/workflows/MULTI_CRITERIA_SCORING_GUIDE.md | `/api/cron/ingest-rss`, `src/lib/rss-processor.ts` |
| AI prompts & scoring | docs/ai/prompt-system.md | `src/lib/openai.ts`, `publication_settings` table (fallback: `app_settings`) |
| AI apps selection | docs/guides/AI_APPS_IMPLEMENTATION_GUIDE.md | `src/lib/app-selector.ts`, `ai_applications` table |
| Advertorials & ads | docs/guides/IMPLEMENTATION_COMPLETE_HYBRID_RSS.md | `src/lib/newsletter-templates.ts`, `/api/cron/send-final` |
| Dashboard UI | docs/feature-summary.md | `src/app/dashboard/[slug]/` |
| Marketing site | docs/guides/FEATURE_PUBLIC_NEWSLETTER_ARCHIVE.md | `src/app/website/`, `apps/marketing/` |
| Migrations | docs/migrations/MULTI_TENANT_MIGRATION_GUIDE.md | `db/migrations/` |

## 7. File Structure
See [docs/structure.md](docs/structure.md) for the complete file tree.

**Key directories:**
- `src/lib/` — Core business logic (openai.ts, rss-processor.ts, app-selector.ts)
- `src/app/api/` — API routes (cron/, campaigns/, rss/, debug/)
- `src/app/dashboard/[slug]/` — Dashboard UI (dynamic per publication)
- `db/migrations/` — SQL migration files
- `docs/` — Documentation organized by topic

## 8. Core Workflows (Summary)
1. **RSS ingestion:** `/api/cron/ingest-rss` keeps `rss_posts` pool fresh (Stage 0).
2. **Workflow trigger:** `/api/cron/trigger-workflow` launches ten-step process (see docs/workflows/rss-processing.md).
3. **AI app selection:** `AppSelector.selectAppsForissue()` picks apps with rotation logic.
4. **Campaign review:** Dashboard surfaces drafts with generated content, advertorials, polls.
5. **Final send:** `/api/cron/send-final` pushes to MailerLite, logs Stage 2 cleanup.
6. **Analytics loop:** Link tracking, polls, feedback feed back into the next cycle.

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

## 10. Implementation Patterns
- Backend template + retry logic: docs/patterns/backend.md
- Supabase admin client only on server routes/actions; never expose service keys client-side.
- Use helpers in `src/lib/` (RSSProcessor, AdScheduler, MailerLiteService, AppSelector) instead of reimplementing logic.
- Respect async boundaries in React Server Components; keep client-only code behind `"use client"` boundaries.

## 11. AI & Scoring
- Prompt conventions and schema: docs/ai/prompt-system.md
- Criteria weighting and adjustments: docs/workflows/MULTI_CRITERIA_SCORING_GUIDE.md
- Example validation snippets: docs/examples/zod-validation-comparison.md, docs/examples/zod-prompt-validation-example.ts

### Prompt Storage
- **Primary:** `publication_settings` table (per-tenant)
- **Fallback:** `app_settings` table (global)
- **Access:** `callAIWithPrompt(promptKey, newsletterId, variables)`
- **Provider:** Auto-detected from model name (claude → Anthropic, else → OpenAI)

## 12. Automation & Ops
- Cron schedules, secrets, recovery: docs/operations/cron-jobs.md
- Vercel deployment & API notes: docs/vercel-api.md
- Deployment/test checklists: docs/checklists/DEPLOYMENT_TASKS.md, docs/checklists/TESTING_CHECKLIST.md
- Monitoring expectations: `[Workflow]`, `[CRON]`, Slack alerts from monitor cron.

### Active Cron Jobs (from `vercel.json`)
| Cron | Schedule | Purpose |
|------|----------|---------|
| `trigger-workflow` | Every 5 min | Launches RSS workflow if schedule permits |
| `ingest-rss` | Every 15 min | Fetches new posts |
| `send-review` | Every 5 min | Sends review email when ready |
| `send-final` | Every 5 min | Sends final newsletter |
| `import-metrics` | Daily 6:00 AM | Syncs MailerLite metrics |
| `health-check` | Every 5 min (8AM-10PM) | Pings core services |
| `monitor-workflows` | Every 5 min | Detects stuck workflows |

## 13. Testing & Verification
Before completing work, confirm:
- `npm run build` passes and affected tests are updated/added.
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

## 14. Environment Overview
| Area | Key Env Vars | Notes |
|------|--------------|-------|
| Supabase | `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` | Keep server-only; never expose client side. |
| AI | `OPENAI_API_KEY`, optional `ANTHROPIC_API_KEY` | Set per environment; rate limits vary. |
| Cron/workflows | `CRON_SECRET` | Required for secured cron endpoints. |
| Auth | `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | Ensure correct domain per environment. |
| MailerLite | `MAILERLITE_API_KEY` | Needed for review/final send crons. |
| Slack | `SLACK_WEBHOOK_URL` (optional) | Enables alerts from monitor cron. |

## 15. Cross-Feature Checklist
When changes span multiple domains (e.g., workflow + UI):
- Update backend logic and corresponding UI components.
- Adjust prompts or `publication_settings` if new content paths introduced.
- Re-run relevant cron/workflow in staging to confirm end-to-end behavior.
- Update docs: core guide here plus impacted feature doc(s).
- Mention cross-feature impact in pull request notes.

## 16. Documentation Hygiene
- After modifying workflows, prompts, migrations, or notable features, update the specific doc in `docs/` and ensure this guide references it.
- If a new area lacks documentation, create it in the appropriate subfolder (`docs/workflows/`, `docs/guides/`, etc.) and add a reference here.
- Keep links accurate; update them when files move/rename.

## 17. Troubleshooting Primer
If issues arise, start with docs/troubleshooting/common-issues.md. For deeper historical context or session notes, consult docs in `docs/status/` as needed.

### Common Debug Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/api/debug/check-ai-prompts` | Verify prompt configuration |
| `/api/debug/(ai)/ai-apps-status` | Check AI app selection status |
| `/api/debug/(campaign)/recent-campaigns` | List recent campaigns |
| `/api/cron/health-check` | System health status |

## 18. External Integrations
- Vercel AI SDK usage patterns: docs/vercel-ai-sdk.md
- OpenAI Responses API specifics: docs/examples/OPENAI_RESPONSES_API_GUIDE.md
- Vercel API workflows and cron deployment: docs/vercel-api.md
- If Supabase edge cases occur, review platform notes in `docs/migrations/` and Supabase dashboard configuration.

## 19. Security Guidelines
- Never log API keys, secrets, or Personally Identifiable Information.
- Do not bypass authentication/authorization checks in API routes.
- Keep service-role interactions on server only; sanitize user input.
- Audit third-party calls (Slack, MailerLite, Stripe) for retries and error handling.

## 20. Hand-off Notes
- Document any new prompts, migrations, or cron jobs in the appropriate doc before finishing.
- Update `package.json` scripts or environment instructions only after aligning with deployment strategy.
- Leave concise pull request notes summarizing impacted workflows, tests run, and linked docs.
- If documentation gaps remain, add to the relevant subfolder and link here so future updates stay predictable.

Stay disciplined about referencing the supporting docs. If a scenario lacks documentation, create or extend it, then cross-link in this guide to keep Claude—and the team—aligned.
