# AI Pro Daily — Rebuild Goals

_Last updated: 2026-02-19_
_Round 1 reviewed by: Backend Architect, DevOps Engineer, Engineering Manager, QA Lead, Security Engineer, Email Deliverability Specialist, Product Manager, UI Engineer, CEO_
_Round 2 reviewed by: Same 9 roles (veteran rebuild specialists) + CTO synthesis on Opus 4.6_

## Why We're Rebuilding

AI Pro Daily is a working product. The features are right, the flagship newsletter (AI Accounting Daily) ships reliably, and the frontend experience is solid. The problem is purely structural.

The current codebase was built by a solo developer learning to code, feature-by-feature, primarily through AI assistance with older models. It works — but it's fragile. The lead developer cannot safely hand off work to another person because the architecture has no boundaries. Everything touches everything.

This is an architecture problem, not a people problem. The rebuild is about **building the same house with proper blueprints**.

---

## What AI Pro Daily Is

AI Pro Daily is a **"Squarespace for AI newsletters"** — a multi-tenant platform that generates AI-powered newsletters from RSS feeds. Each publication is configured through a modular system where admins select which content blocks appear, in what order, and how they behave.

- **Flagship:** AI Accounting Daily
- **Growth plan:** 12 new publications in the next 12 months (roughly one per month)
- **Content model:** RSS feeds are ingested, scored by AI, transformed into newsletter articles, and assembled with configurable modules (ads, polls, prompts, AI app spotlights, text boxes, feedback, SparkLoop recommendations)
- **Delivery:** The platform generates HTML emails and sends them through MailerLite's API. MailerLite handles all subscriber management and actual email delivery.

---

## Business Continuity: Growth Does Not Wait for the Rebuild

**Do not let the rebuild become a gate on growth.**

> **"12 publications in 12 months from today, regardless of which system they run on."**

- The first 2-4 publications launch on the current system using a documented provisioning process. They migrate to the new system after cutover.
- Revenue features that are ready should ship on the current system before the rebuild starts. A feature freeze should not block revenue that's ready to collect.
- Revenue surfaces (Stripe subscriptions, Tools Directory, subscribe flow, ad rotation) must not go dark during cutover. Zero downtime for anything that generates revenue or acquires subscribers.

---

## Priority-Ranked Goals

### 1. Clean Architecture
**The #1 goal.** The rebuilt codebase must be professional-grade — the kind of system an experienced developer would look at and immediately understand.

What this means specifically:
- **No god files.** No file over ~500 lines.
- **Clear boundaries.** Services, repositories, components, and API routes are separated with explicit contracts between them.
- **One way to do things.** One auth system, one prompt system, one settings schema.
- **Proper types.** UUIDs for IDs, ENUMs for statuses, Zod-validated settings — not strings everywhere.
- **A Data Access Layer.** Multi-tenant isolation (`publication_id` filtering) enforced systemically, not manually on every query.
- **Proper state machine.** Issue lifecycle as a finite state machine with explicit transitions, not ad-hoc status string comparisons.
- **Standard API route template.** Every route enforces auth tier declaration, Zod input validation, error formatting, and publication_id scoping through a common pattern.
- **Observability built in.** Structured JSON logging with correlation IDs from day one. Every pipeline step is traceable.
- **Security built in.** Auth tiers, rate limiting, input validation, and security headers are part of the architecture, not afterthoughts.
- **Tests embedded, not bolted on.** Every service ships with tests. Every feature preserved has a test that proves preservation.

### 2. All Features Preserved (Tiered by Business Value)
**Nothing from the current system is lost** — but features are rebuilt in priority order based on revenue impact and operational necessity.

**Tier 1 — Must Ship (Blocks Cutover):**
- Full newsletter pipeline (RSS ingestion, AI scoring, article generation, module assembly, MailerLite send)
- All 8 module types (Articles, AI Apps, Prompts, Ads, Polls, Text Boxes, Feedback, SparkLoop Recommendations)
- Secondary newsletter pipeline
- Core cron jobs (ingest-rss, trigger-workflow, create-campaign, send-review, send-final, send-secondary)
- Admin dashboard: issue editor, settings, module management
- Multi-tenant isolation with Data Access Layer

**Tier 2 — Ship Within 1 Week of Cutover (Revenue-Critical):**
- Stripe webhook handler (actively processing subscriptions and payments)
- Account portal (advertiser ad management, Stripe billing)
- AI Tools Directory public pages (active Stripe subscriptions, SEO rankings to protect)
- Self-service publication creation (Goal #3)
- Remaining cron jobs (health-check, monitor-workflows, import-metrics, process-mailerlite-updates, cleanup-pending-submissions)
- Analytics and metrics dashboards

**Tier 3 — Ship Within 30 Days of Cutover:**
- Marketing website (subscribe flow stays live via old system or standalone page)
- Tools Directory admin panel
- Events system, breaking news processing
- Domain-based routing for newsletter websites

**Tier 4 — Evaluate Before Rebuilding:**
- Features with 0 database rows (audit usage before committing)
- 150+ debug/maintenance endpoints (triage as a security priority)
- Google Vision integration, Make.com integration (verify active usage)

**Feature parity is verified, not assumed.** A Feature Parity Matrix enumerates every behavior with severity (P0-blocker, P1-regression, P2-cosmetic), tier, and verified checkboxes. Severity enables triage at every gate.

### 3. Self-Service Publication Creation
**Adding a new newsletter must not involve code changes.** An admin creates a publication from the dashboard and the system auto-provisions everything: database records with sensible defaults, scoring criteria, module configuration, MailerLite subscriber group, domain authentication verification, and dynamic routing. First test newsletter within 1 hour of creation.

### 4. LLM-Optimized Codebase
The team builds with Claude Code. The codebase must be structured so an LLM agent can work on it effectively: small focused files, consistent patterns, strong TypeScript types, auto-generated database types, CLAUDE.md files per directory, pre-commit hooks, and a comprehensive test suite.

---

## Second System Firewall

Rebuilds fail when teams try to fix everything at once. These rules prevent scope creep:

1. **We are rebuilding, not reimagining.** If a design choice doesn't directly serve Goals 1-3, it waits for post-launch.
2. **No new features during the rebuild.** Self-service provisioning is the sole exception.
3. **If the current system handles something adequately, the rebuild matches the behavior, not improves it.** Better structure, same behavior. **Exception:** Email rendering improvements (DOCTYPE, preheader, dark mode, responsive design) are explicitly allowed because the current templates have deficiencies that hurt deliverability.
4. **"Better" is the enemy of "done."** A shipped rebuild with adequate architecture beats a perfect rebuild still in progress at month 6.
5. **Evaluate, don't adopt, during the rebuild.** Job queue evaluation and other infrastructure upgrades happen post-cutover.
6. **Don't build a framework — build a product.** Well-organized, repetitive code that's easy to copy and modify is better than premature abstraction.

---

## Security Architecture

Security must be designed, implemented, and tested as a first-class concern.

### Authentication
- **Single auth system** with defense-in-depth
- **Auth tier system** enforced by the Standard API Route Template:
  - `public` — no auth (polls, public website, link tracking)
  - `authenticated` — requires valid session
  - `admin` — requires session + admin role + publication_id scope
  - `system` — requires CRON_SECRET or webhook signature
- **Every route declares its tier.** Routes without a declaration fail CI.
- **No auth bypass mechanisms in any environment.**

### Multi-Tenant Security
- DAL as primary enforcement, RLS as secondary safety net
- `publication_id` derived from authenticated session context, never from a global config constant
- Cross-tenant queries (system-level cron operations) use a clearly auditable pattern
- Per-publication admin authorization — Admin A cannot see Admin B's publication data

### API Security
- Rate limiting mandatory for all public endpoints
- Zod validation on every API route
- Security headers via middleware
- CORS default-deny with explicit allowlists
- No `SELECT *` — the DAL enforces explicit column selection

### Webhook Security
- Cryptographic signature verification for ALL webhook sources (Stripe, SparkLoop, MailerLite)
- Verification must not be optional — if the secret is not configured, reject the request
- Idempotent webhook processing with deduplication by event ID

### Secrets Management
- Per-environment secret isolation (production/staging/development)
- Pre-commit scanning blocks secrets in code (CI gate)
- Secret rotation procedure documented for all integration keys

---

## Email Deliverability & Rendering Standards

For a newsletter platform, email deliverability IS the product.

### Content Parity + Rendering Improvement
- **Content parity:** Same articles selected, same sections in same order, same modules with same configuration
- **Rendering improvement:** Email HTML that meets modern standards (detailed below)

### Email HTML Standards
- Proper `<!DOCTYPE html>` declaration with XHTML namespaces
- MSO conditional comments for Outlook rendering
- Preheader text support (configurable per publication)
- Table-based responsive layout with mobile-first media queries
- Dark mode safe colors with `color-scheme` meta tag
- All CSS inline (not dependent on ESP inlining)
- Images hosted on Supabase Storage CDN, not GitHub raw URLs
- Alt text on all images
- Maximum email size: 100KB (warn at 80KB — Gmail clips at 102KB)
- `List-Unsubscribe` and `List-Unsubscribe-Post` headers per RFC 8058

### Multi-Tenant Email Isolation
- **Per-publication sending domain** with SPF/DKIM/DMARC authentication
- Architecture must support **per-publication API keys** (so a publication can be moved to its own account if reputation problems arise)
- **Per-publication bounce/complaint rate tracking** with automated alerting
- Staggered send scheduling — minimum 5-minute gap between publications
- Domain warming schedule for new publications

### Compliance
- CAN-SPAM: Physical address, sender identification, working unsubscribe in every email
- One-click unsubscribe per RFC 8058
- Separate "Manage Preferences" and "Unsubscribe" flows — critical for multi-tenant
- GDPR: Consent records migrated with subscriber data, right-to-deletion supported
- Unsubscribe link must always be above the Gmail 102KB clipping threshold

---

## Frontend Architecture

### Goals
- **Server components by default.** Data fetching on the server. Client components only for interactive widgets (forms, drag-and-drop, modals).
- **One design system.** A single, accessible component library based on established primitives. No competing UI systems.
- **Standardized form handling.** One pattern for forms with schema validation. No manual `useState` + `fetch()` per field.
- **Defined ModulePanel contract.** All module panels in the issue editor implement a common interface.
- **WCAG 2.1 Level AA.** All form inputs have associated labels, all interactive elements are keyboard accessible, minimum 4.5:1 contrast, focus management, `eslint-plugin-jsx-a11y` in CI.

### Performance Targets
| Metric | Public Pages | Dashboard |
|--------|-------------|-----------|
| LCP | < 2.5s | < 3.0s |
| INP | < 100ms | < 200ms |
| CLS | < 0.1 | < 0.15 |

Bundle budgets differentiated by route complexity:

| Route Type | First-Load JS Budget |
|------------|---------------------|
| Marketing/public pages | < 100KB |
| Tools Directory | < 120KB |
| Dashboard list pages | < 150KB |
| Dashboard interactive (issue editor, settings) | < 250KB |

### Responsive Strategy
| Surface | Support | Rationale |
|---------|---------|-----------|
| Marketing site, Tools Directory | Full responsive | Public-facing, mobile traffic |
| Account portal | Tablet + desktop | Advertisers may use mobile |
| Dashboard home | Tablet + desktop | Quick status checks |
| Issue editor, Settings | Desktop only (min 1024px) | Complex interaction, always at a desk |

---

## Technical Decisions

### Locked In

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Stack** | Next.js 15, Supabase, Vercel | Team already knows it; rebuild focuses on code organization |
| **Approach** | Greenfield rebuild | Document everything, then rebuild from scratch |
| **Current system** | Stays running | Old system is the source of truth until cutover |
| **Data migration** | All historical data | 120+ sent issues, tools, ads, metrics — all migrated |
| **Database migration** | Additive (new tables alongside old) | Old system reads from original tables, never modified by new system. Required for safe rollback. |
| **Email sender isolation** | Two MailerLite accounts to start (flagship + everything else) | Per-publication API keys. Split further if/when reputation problems appear. |
| **UI component library** | shadcn/ui | Already partially installed in the current codebase. |
| **Frontend data fetching** | Server Components + Server Actions | For all new code |
| **Execution method** | Claude Code subagents | Thorough plans executed with human review on every PR |
| **Growth during rebuild** | Continues on old system | New publications launch manually, migrate to new system after cutover |

### Open Decisions (Resolve Before Writing Code)

| Decision | Options | Why It Can't Wait |
|----------|---------|-------------------|
| **Auth system** | NextAuth only, Clerk only, or unified | Affects middleware, sessions, API protection, user model. Build a spike with all 4 auth tiers to decide. |
| **Job orchestration** | Keep crons, Inngest, Trigger.dev | At 12 pubs, cron volume scales significantly. Evaluate with real timing data post-investigation. |
| **Settings architecture** | Typed domain tables vs. Zod key-value store | 252 keys must be audited. Schema before code. |
| **DAL pattern** | Thin Supabase wrapper vs. full repository | 800+ `.from()` calls replaced. Define with reference implementations. |
| **Rich text editor** | Quill, Tiptap, or other | Both `quill` and `react-quill-new` exist today. Pick one. |

---

## Monitoring & Observability

**Structured Logging:** JSON-formatted with correlation IDs. Filterable by `publication_id`, `issue_id`, `cron_name`. **No PII in logs.**

**Key Metrics:**
- Cron execution duration per job
- AI API call latency and token usage
- RSS feed fetch success/failure rates
- Pipeline throughput: trigger-workflow to send-final per publication
- Email complaint rate and bounce rate per publication
- Email size per issue (track Gmail clipping risk)

**Tiered Alerting:**
- **P0 (immediate):** send-final failure, MailerLite API down, Supabase connection failure, complaint rate > 0.1%, security incident
- **P1 (within 1 hour):** workflow stuck > 30 min, RSS returning 0 posts, open rate drop > 20% vs 7-day average, email clipped by Gmail
- **P2 (daily digest):** cron duration trending up, AI token budget approaching limit, bounce rate trending up

**Operational Dashboard:** Admin-facing status page: cron status, pipeline status per publication, recent errors, system health, email deliverability metrics per publication.

---

## CI/CD Requirements

| Gate | Blocks Merge? | Notes |
|------|---------------|-------|
| `tsc --noEmit` | Yes | Type safety is non-negotiable |
| `eslint` (strict, zero warnings) | Yes | No suppressed warnings |
| `vitest run` (unit + integration) | Yes | Coverage threshold for new code |
| `next build` | Yes | Catches runtime import issues |
| Secret scanning | Yes | Prevent `.env` commits |
| `eslint-plugin-jsx-a11y` | Yes | WCAG accessibility violations |
| Security lint (no auth bypass, no open CORS, no SELECT *) | Yes | Security patterns enforced |
| PR size check | Warn | Flag PRs over 500 lines |

Per-environment secret isolation mandatory. Staging must never use production API keys. No auth bypass on preview environments.

---

## Team Goals

- **Lead developer's role:** Architect and domain expert. Defines and approves architecture, provides domain knowledge, reviews PRs, owns the Feature Parity Matrix. Does NOT need to write every line of code.
- **Knowledge must be extractable.** Business rules, integration quirks, and historical decisions cannot live solely in one person's head. They must be captured in written form before code is written.
- **The lead developer must not be a single point of failure.** The rebuild must include explicit protections against bottleneck and burnout.
- **Post-rebuild ownership:** Neither developer "owns" the code. The architecture owns it. If the lead developer is still the only person who can approve pipeline changes 3 months post-rebuild, the rebuild has failed at its primary goal.

---

## Risk Register

### Risk 1: The Rebuild Takes 2-3x Longer Than Expected
**Likelihood:** High | **Impact:** Critical
**Mitigation:** Tiered features with scope cuts at each milestone. Kill switch if pipeline milestone takes too long. Fallback: incremental improvement of current system. Growth continues on old system regardless.

### Risk 2: The Current System Breaks During the Rebuild
**Likelihood:** Medium-high | **Impact:** High
**Mitigation:** Kill switch triggers if old system requires > 30% of team time in any 2-week period. Revenue-protecting changes allowed.

### Risk 3: The Lead Developer Becomes a Bottleneck
**Likelihood:** High | **Impact:** High
**Mitigation:** Front-load knowledge extraction. Written domain docs. Fast PR review cycles. Lead does NOT code lower-tier features. Decision-making shared with founder where possible.

### Risk 4: Claude Code Subagents Create Hidden Debt
**Likelihood:** Medium | **Impact:** Medium-high
**Mitigation:** Every PR passes CI and is human-reviewed. Integration tests for critical paths mandatory. Subagent tasks include exact interfaces, specific test cases, and maximum line budgets.

### Risk 5: Data Migration Corrupts or Loses Historical Data
**Likelihood:** Medium | **Impact:** Critical
**Mitigation:** Migration scripts tested against production snapshot. Reversible migration. Post-migration validation: row counts, referential integrity, field-level sampling. All external IDs preserved.

### Risk 6: Email Deliverability Degrades After Cutover
**Likelihood:** Medium | **Impact:** High
**Mitigation:** Per-publication domain authentication. Shadow mode deliverability monitoring. Domain warming for new publications. Exit criteria include open rate parity.

### Risk 7: Lead Developer Burnout
**Likelihood:** High | **Impact:** Critical
**Mitigation:** Sustainable pace enforced at every checkpoint. Second developer joins early to share load. Video-recorded walkthroughs preserve knowledge. If the lead dev is exhausted at any checkpoint, extend the timeline.

---

## Verification Strategy

### Feature Parity Matrix
Every API route, page, cron job, module behavior, and integration touchpoint. Each row has:
- **Severity:** `P0-blocker`, `P1-regression`, `P2-cosmetic`
- **Tier** (1-4), **"rebuilt" checkbox**, **"verified" checkbox**, **test strategy**

### Newsletter Output Comparison Protocol
Verified in 4 layers:
1. **Content:** Same articles selected, same sections in same order, same modules with same configuration
2. **Structural:** Diff normalized HTML. Rendering improvements are expected and acceptable differences.
3. **Visual:** Render in Gmail, Outlook, Apple Mail. Rebuilt output should meet modern email standards.
4. **Behavioral:** Link tracking, poll/feedback submissions, unsubscribe links all function correctly

### Contract Test Harness
Both systems receive identical frozen inputs, output is diffed. Article selection must match exactly. AI-generated prose is allowed to differ. Content differences and section-order differences are P0 failures. HTML structure differences are expected and logged.

### Testing Strategy
- Service mocks for every external service (success and failure paths)
- Sandbox tests against Stripe test mode and MailerLite sandbox
- Component, integration, E2E, and visual regression tests
- 80% coverage for services, 60% for API routes

---

## Success Criteria

### Technical Criteria

1. **Developer Onboarding:** Set up in under 2 hours, implement a task in under 3 working days, with no more than 2 questions.
2. **Feature Parity:** Matrix 100% checked for P0 and P1. Zero Tier 1-2 features deferred.
3. **Self-Service Provisioning:** Admin creates publication from UI → first test newsletter sent within 1 hour. No developer intervention.
4. **LLM Effectiveness:** Claude Code completes 5 predefined tasks with >= 80% success rate using only CLAUDE.md context.
5. **Regression Safety:** CI blocks on failure. Intentionally introduced bugs are caught by the suite.
6. **Newsletter Output:** Comparison protocol passes for 20+ reference issues. Modern rendering standards met.
7. **Operational Readiness:** All crons successful for 14+ days. Monitoring operational. Rollback tested. Domain migration rehearsed.
8. **Data Migration:** Row counts match. Referential integrity verified. All external IDs preserved.

### Business Criteria

9. **Open Rate Parity:** 30-day average within 2% of pre-cutover baseline.
10. **Revenue Continuity:** No decline in ad, subscription, or directory revenue in the month following cutover.
11. **Subscriber Growth:** New subscribers per week does not decline during transition.
12. **Time to New Publication:** Under 2 hours (self-service) or under 4 hours (scripted on old system).
13. **Competitive Position:** At least 2 new publications launched during the rebuild period.

---

## Design Principles

1. **Newsletter renderer as a pure function.** Given an `IssueSnapshot` (all data pre-fetched), return HTML. No database calls inside the renderer. Testable, cacheable, previewable.
2. **Per-publication migration capability.** Individual publications can be migrated independently.
3. **Settings as typed columns, not key-value pairs.** Email settings on `publication_email_config`. Schedule on `publication_schedule`. AI on `publication_ai_config`.
4. **Idempotency everywhere.** Every state-mutating operation needs an idempotency key or check-then-act pattern.
5. **Rate limiting at the provider level.** Per-provider rate limiters for OpenAI, MailerLite, and other external APIs.
6. **Server components by default.** Data fetching on the server. Client components only for interactivity.
7. **Accessible by default.** Component library built on accessible primitives. WCAG 2.1 AA enforced in CI.

---

## What's NOT Changing
- **The product.** Same features, same user experience, same newsletter output.
- **The integrations.** MailerLite, Stripe, OpenAI, etc. — all preserved.
- **The hosting.** Vercel deployment, Supabase database.
- **The team workflow.** Claude Code remains the primary development tool.
- **The subscriber experience.** Newsletters arrive the same way, from the same MailerLite groups.
- **The growth plan.** Publications launch on whatever system is ready. Growth does not wait.

## What IS Changing
- **File organization.** God files broken into focused modules.
- **Database schema.** Clean-sheet design with proper types, naming, RLS.
- **Auth system.** One system, not two.
- **Settings.** Typed schema per publication.
- **Multi-tenancy.** Enforced at the DAL.
- **Email rendering.** Modern standards: DOCTYPE, preheader, responsive, dark mode.
- **Email isolation.** Per-publication domain auth and reputation tracking.
- **Frontend architecture.** Server components, design system, accessible component library.
- **Image storage.** All images in Supabase Storage from day one.
- **Testing.** Tests co-developed with every feature.
- **Security.** Auth tiers, rate limiting, input validation, webhook verification.
- **Observability.** Structured logging, correlation IDs, metrics, tiered alerting.
- **CI/CD.** Strict gates, staging deploys, security and accessibility linting.
- **Publication provisioning.** Self-service creation from admin UI.

---

## How We Know the Rebuild Succeeded

When these statements are true, the rebuild is done:

1. A new developer clones the repo and ships a feature in 3 days with 2 or fewer questions.
2. The founder provisions a new publication from the dashboard in under an hour, with zero developer involvement.
3. Every newsletter sends on time, every day, for 30 consecutive days — no manual intervention.
4. The lead developer takes a week off and nothing breaks.
5. A Claude Code subagent adds a new module type by following the existing pattern, and the PR passes CI on the first try.
6. Open rates, revenue, and subscriber growth are indistinguishable from pre-rebuild baselines.
