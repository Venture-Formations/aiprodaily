# AIProDaily — Claude Operations Guide

_Last updated: 2025-11-11_

This is the authoritative playbook for Claude Code when building or updating AIProDaily. Follow the checklist in order, then dive into the linked docs for deep context.

## 1. Quick Start
1. Read **Critical Rules** (below) before touching any file.
2. Identify your task type using **Task Router**.
3. Open the referenced docs via the provided links (use Read tool when needed).
4. Apply patterns from docs/patterns/backend.md and docs/ai/prompt-system.md as needed.
5. Review feature impact in docs/feature-summary.md if the task spans multiple areas.
6. Run appropriate tests/checklists before handing off.

## 2. Critical Rules
- **Multi-tenant isolation:** Every query must filter by `newsletter_id`.
- **Date comparisons:** Use local date strings (`date.split('T')[0]`). Never rely on `toISOString()` or `toUTCString()` for logic.
- **Logging:** One-line summaries with prefixes (`[Workflow]`, `[RSS]`, `[AI]`, `[DB]`, `[CRON]`). Stay under 10MB per invocation.
- **Timeouts:** Vercel workflow step 800s, API route 600s, cron durations as defined in `vercel.json`.
- **Error handling:** Wrap long tasks with retry loops (max 2 retries, 2s delay). Surface failures via `console.error` and let upstream handlers escalate.
- **Confidence gate:** If uncertainty >20%, stop and ask for clarification. Offer options with pros/cons.

## 3. Task Router
| You are working on… | Open these references | Checklist |
|---------------------|-----------------------|-----------|
| RSS ingestion or campaign workflow | docs/workflows/rss-processing.md, docs/workflows/RSS_INGESTION_IMPLEMENTATION.md, docs/workflows/MULTI_CRITERIA_SCORING_GUIDE.md | Verify step runtime, scoring prompts, dedupe logic. |
| AI prompts / content generation | docs/ai/prompt-system.md, docs/AI_PROMPT_SYSTEM_GUIDE.md, docs/OPENAI_RESPONSES_API_GUIDE.md | Ensure prompt keys exist per tenant, JSON schema matches parser, provider settings valid. |
| Database/schema updates | docs/architecture/system-overview.md, docs/migrations/MULTI_TENANT_MIGRATION_GUIDE.md, docs/migrations/DATABASE_SETUP_GUIDE.md | Maintain `newsletter_id` filters, update migrations + status docs. |
| Advertorials / ads | docs/guides/IMPLEMENTATION_COMPLETE_HYBRID_RSS.md, docs/guides/SECONDARY_ARTICLES_IMPLEMENTATION_GUIDE.md | Confirm Stage 1/2 unassignment behaviors and ad rotation settings. |
| Campaign dashboard or admin UI | docs/feature-summary.md, docs/guides/FEATURE_WELCOME_SECTION.md | Keep React server components aligned with workflow data. |
| Cron / automation | docs/operations/cron-jobs.md, docs/vercel-api.md | Check schedule, secrets, and failure recovery steps. |
| Quick task recipes | docs/recipes/quick-actions.md | Follow step-by-step provisioning or debug checklists. |
| Troubleshooting production issues | docs/troubleshooting/common-issues.md, docs/status/CLEANUP_RECOMMENDATIONS.md | Use symptom-driven guides before modifying code; review outstanding cleanup items. |
| External SDK integrations | docs/vercel-ai-sdk.md, docs/OPENAI_RESPONSES_API_GUIDE.md | Align SDK usage, streaming patterns, and auth configuration. |

## 4. Feature Ownership Map
| Domain | Primary Docs | Key Code Entry Points |
|--------|--------------|-----------------------|
| Campaign workflow | docs/workflows/rss-processing.md | `src/lib/workflows/process-rss-workflow.ts`, `/api/workflows/process-rss` |
| RSS ingestion & scoring | docs/workflows/RSS_INGESTION_IMPLEMENTATION.md, docs/workflows/MULTI_CRITERIA_SCORING_GUIDE.md | `/api/cron/ingest-rss`, `src/lib/rss-processor.ts` |
| AI prompts & scoring | docs/ai/prompt-system.md, docs/AI_PROMPT_SYSTEM_GUIDE.md | `src/lib/openai.ts`, `app_settings` table |
| Advertorials & ads | docs/guides/IMPLEMENTATION_COMPLETE_HYBRID_RSS.md | `src/lib/newsletter-templates.ts`, `/api/cron/send-final` |
| Dashboard UI | docs/feature-summary.md | `src/app/dashboard/[slug]/` |
| Marketing site | docs/guides/FEATURE_PUBLIC_NEWSLETTER_ARCHIVE.md | `src/app/website/`, `/website/` project |
| Migrations | docs/migrations/MULTI_TENANT_MIGRATION_GUIDE.md | `database_migrations/` |

## 5. Core Workflows (Summary)
1. **RSS ingestion:** `/api/cron/ingest-rss` keeps `rss_posts` pool fresh (Stage 0).
2. **Workflow trigger:** `/api/cron/trigger-workflow` launches ten-step process (see docs/workflows/rss-processing.md).
3. **Campaign review:** Dashboard surfaces drafts with generated content, advertorials, polls.
4. **Final send:** `/api/cron/send-final` pushes to MailerLite, logs Stage 2 cleanup.
5. **Analytics loop:** Link tracking, polls, feedback feed back into the next cycle.

## 6. Implementation Patterns
- Backend template + retry logic: docs/patterns/backend.md
- Supabase admin client only on server routes/actions; never expose service keys client-side.
- Use helpers in `src/lib/` (RSSProcessor, AdScheduler, MailerLiteService) instead of reimplementing logic.
- Respect async boundaries in React Server Components; keep client-only code behind `"use client"` boundaries.

## 7. AI & Scoring
- Prompt conventions and schema: docs/ai/prompt-system.md
- Criteria weighting and adjustments: docs/workflows/MULTI_CRITERIA_SCORING_GUIDE.md
- Example validation snippets: docs/examples/zod-validation-comparison.md, docs/examples/zod-prompt-validation-example.ts

## 8. Automation & Ops
- Cron schedules, secrets, recovery: docs/operations/cron-jobs.md
- Vercel deployment & API notes: docs/vercel-api.md
- Deployment/test checklists: docs/checklists/DEPLOYMENT_TASKS.md, docs/checklists/TESTING_CHECKLIST.md
- Monitoring expectations: `[Workflow]`, `[CRON]`, Slack alerts from monitor cron.

## 9. Testing & Verification
Before completing work, confirm:
- `npm run type-check` passes and affected tests are updated/added.
- All new/updated queries filter by `newsletter_id` and avoid `SELECT *`.
- No UTC conversions introduced for logical comparisons.
- Logging remains concise (one-line summaries, no sensitive data).
- Error handling uses retry loops or graceful fallbacks where appropriate.
- If database changes: migrations added, docs updated, manual verification performed.
- If AI changes: prompts stored, structured output validated, rate limits respected.
- Follow docs/checklists/TESTING_CHECKLIST.md for UI validation steps.

**Testing Matrix (examples)**
| Change Type | Run This | Notes |
|-------------|-----------|-------|
| Workflow/core backend | `npm run type-check`, manual `/api/workflows/process-rss` in staging | Watch Vercel logs for step timings. |
| API route | Unit/integration tests if available; manual POST via Thunder Client with auth | Confirm retry logic + logging. |
| Dashboard UI | `npm run lint`, smoke test in browser, follow UI checklist | Validate multi-tenant data filters. |
| AI prompt updates | Staging dry run of affected step; inspect JSON output | Ensure schema matches parser. |
| Migrations | Apply on staging via Supabase; verify roll-forward/back | Update `docs/migrations/` status file. |
| Marketing site | `npm run build` on marketing app; Lighthouse smoke check | Confirm assets relocated to `public/`. |

## 10. Environment Overview
| Area | Key Env Vars | Notes |
|------|--------------|-------|
| Supabase | `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` | Keep server-only; never expose client side. |
| AI | `OPENAI_API_KEY`, optional `ANTHROPIC_API_KEY` | Set per environment; rate limits vary. |
| Cron/workflows | `CRON_SECRET` | Required for secured cron endpoints. |
| Auth | `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | Ensure correct domain per environment. |
| MailerLite | `MAILERLITE_API_KEY` | Needed for review/final send crons. |
| Slack | `SLACK_WEBHOOK_URL` (optional) | Enables alerts from monitor cron. |

## 11. Cross-Feature Checklist
When changes span multiple domains (e.g., workflow + UI):
- Update backend logic and corresponding UI components.
- Adjust prompts or app settings if new content paths introduced.
- Re-run relevant cron/workflow in staging to confirm end-to-end behavior.
- Update docs: core guide here plus impacted feature doc(s).
- Mention cross-feature impact in pull request notes.

## 12. Documentation Hygiene
- After modifying workflows, prompts, migrations, or notable features, update the specific doc in `docs/` and ensure this guide references it.
- If a new area lacks documentation, create it in the appropriate subfolder (`docs/workflows/`, `docs/guides/`, etc.) and add a reference here.
- Keep links accurate; update them when files move/rename.

## 13. Troubleshooting Primer
If issues arise, start with docs/troubleshooting/common-issues.md. For deeper historical context or session notes, consult docs in `docs/status/` as needed.

## 14. External Integrations
- Vercel AI SDK usage patterns: docs/vercel-ai-sdk.md
- OpenAI Responses API specifics: docs/OPENAI_RESPONSES_API_GUIDE.md
- Vercel API workflows and cron deployment: docs/vercel-api.md
- If Supabase edge cases occur, review platform notes in `docs/migrations/` and Supabase dashboard configuration.

## 15. Security Guidelines
- Never log API keys, secrets, or Personally Identifiable Information.
- Do not bypass authentication/authorization checks in API routes.
- Keep service-role interactions on server only; sanitize user input.
- Audit third-party calls (Slack, MailerLite, Stripe) for retries and error handling.

## 16. Hand-off Notes
- Document any new prompts, migrations, or cron jobs in the appropriate doc before finishing.
- Update `package.json` scripts or environment instructions only after aligning with deployment strategy.
- Leave concise pull request notes summarizing impacted workflows, tests run, and linked docs.
- If documentation gaps remain, add to the relevant subfolder and link here so future updates stay predictable.

Stay disciplined about referencing the supporting docs. If a scenario lacks documentation, create or extend it, then cross-link in this guide to keep Claude—and the team—aligned.
