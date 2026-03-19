# Custom Agents Guide for AIProDaily

_Installed March 2026 — adapted from [wshobson/agents](https://github.com/wshobson/agents)_

This guide describes the six custom agents installed in `.claude/agents/` for the AIProDaily project. Each agent is a specialized subagent that runs in its own context window with a focused role, its own tool permissions, and deep knowledge of this project's conventions. They are invoked through Claude Code's Agent tool, either directly by Claude or when you ask for them by name.

---

## Team Lead

The Team Lead is the orchestrator agent that manages multi-agent workflows. It analyzes a complex task, breaks it down into independent work streams, and assigns each stream to the appropriate specialist agent with explicit file ownership boundaries so no two agents ever modify the same file. It knows the full AIProDaily directory structure — from `src/lib/` for core business logic to `src/app/api/` for routes to `db/migrations/` for schema changes — and uses that knowledge to create clean boundaries between agents. Once work is underway, it monitors progress, resolves conflicts between agents' findings, and synthesizes everything into a single consolidated report with prioritized recommendations. It runs on Opus and has read-only tools (Read, Glob, Grep, Bash) since its job is coordination, not code changes.

**When and how to use it:** Use the Team Lead when you have a task that spans multiple areas of the codebase and would benefit from parallel work — for example, "build out the new analytics dashboard" which touches API routes, database queries, and UI components simultaneously. You can ask Claude to "use the team-lead to coordinate this feature across 3 agents" or simply describe a large task and let Claude decide whether to invoke it. The Team Lead is also valuable when you want a structured code review across multiple dimensions (security + performance + architecture) since it will spawn team-reviewer agents in parallel and merge their findings. Think of it as the project manager for agent-to-agent work — you talk to it when the job is too big for one agent but you want a single unified result.

---

## Team Reviewer

The Team Reviewer is a focused code review agent that operates on exactly one assigned quality dimension: security, performance, architecture, testing, or accessibility. It reads through the specified code and produces structured findings with exact `file:line` citations, severity ratings (Critical through Low), evidence descriptions, impact assessments, and concrete fix recommendations with code examples. It has your project's critical rules baked in — it knows that missing `publication_id` filters are Critical severity, that `select('*')` is a policy violation, that date comparisons must use `date.split('T')[0]`, and that Supabase service role keys must never appear client-side. Each reviewer instance stays strictly within its assigned dimension and will not cross into other review areas, which makes it safe to run multiple reviewers in parallel without duplicate or conflicting findings.

**When and how to use it:** Use the Team Reviewer before merging significant PRs, especially when changes touch sensitive areas like authentication, payment processing, or the RSS workflow pipeline. The most powerful pattern is running multiple reviewers in parallel — ask Claude to "review the workflow changes for security and performance" and it will spawn two team-reviewer agents simultaneously, one focused on security vulnerabilities and one on query efficiency and timeout risks. You can also use a single reviewer for a quick focused pass, like "review the new API route for security only." It pairs well with your existing CodeRabbit integration: CodeRabbit catches general issues on every PR, while team-reviewer provides deeper analysis on specific dimensions when you need it. It's especially valuable after touching cron jobs, Stripe webhooks, or any code that handles external API keys.

---

## Team Debugger

The Team Debugger is a hypothesis-driven investigation agent that takes a single theory about why a bug exists and systematically gathers evidence for or against it. Rather than randomly poking at code, it follows a structured seven-step protocol: understand the hypothesis, define confirmation and falsification criteria, gather primary evidence by tracing execution paths, collect supporting evidence from git history and log patterns, test conditions, assess confidence with a percentage rating, and deliver a structured report. It knows AIProDaily's common bug patterns — raw JSON leaking from AI responses when the `.raw` field isn't handled, AI refusal text getting stored as article content, UTC date conversions causing off-by-one errors, missing `publication_id` filters, `select('*')` returning unexpected columns after schema changes, Vercel timeouts causing partial workflow completion, and SparkLoop silently dropping referrals without `subscriber_uuid`. Every finding includes exact file:line references and it honestly reports contradicting evidence rather than cherry-picking support for the hypothesis.

**When and how to use it:** Use the Team Debugger when you're facing a complex bug with multiple possible causes and you want to investigate them in parallel rather than sequentially. The classic pattern is to describe the bug and ask Claude to "investigate 3 hypotheses in parallel" — for example, if newsletters are going out with missing articles, you might investigate whether it's an AI generation timeout, a database query returning stale data, or a workflow step being skipped. Each debugger agent works independently on its assigned hypothesis and comes back with a confidence rating, so you can quickly identify the most likely root cause. It's also useful for single-hypothesis deep dives when you have a theory but want rigorous evidence before making changes. This agent is read-only — it investigates and reports but doesn't modify code, so it's safe to run on production code paths without risk.

---

## Team Implementer

The Team Implementer is the code-writing agent designed for parallel feature development. It receives a task assignment with an explicit list of files it owns, an interface contract defining what it must expose or consume, and acceptance criteria for completion. It then follows a five-phase workflow: understand the assignment, plan the internal architecture, build the implementation, verify with type-checking and linting, and report results. It has all of AIProDaily's coding conventions built in — it uses `withApiHandler` for new API routes, the DAL pattern for database access, `publication_id` filtering on every query, one-line log summaries with `[Workflow]`/`[RSS]`/`[AI]` prefixes, retry loops with max 2 retries and 2-second delays, and respects Vercel timeout limits. Critically, it will never modify a file outside its assigned ownership boundary, and it will never change an agreed-upon interface without explicit approval. It has write access (Read, Write, Edit, Glob, Grep, Bash) and runs on Opus for maximum code quality.

**When and how to use it:** Use the Team Implementer when building features that can be cleanly divided into independent components — for example, adding a new module type where one implementer builds the database layer and DAL methods while another builds the API routes and a third builds the dashboard UI. You typically wouldn't invoke this agent directly; instead, the Team Lead decomposes the work and assigns it to implementer instances. However, you can also use it directly for focused implementation tasks where you want the strict discipline of file ownership and interface contracts. It's particularly valuable when multiple people (or agents) are working on related code simultaneously, because the ownership protocol prevents merge conflicts entirely. Think of each implementer as a disciplined developer who does exactly what's specified, nothing more, and communicates immediately if something doesn't fit.

---

## Security Auditor

The Security Auditor is a comprehensive application security agent purpose-built for Next.js and Supabase platforms. It knows the full OWASP Top 10, but more importantly, it knows the specific security surface of AIProDaily: NextAuth with Google OAuth in production and credentials bypass in staging, Supabase RLS policies with `publication_id` tenant isolation, Stripe webhook signature verification, MailerLite API integration, cron jobs protected by `CRON_SECRET` Bearer tokens, and the bot detection system with UA checks, velocity detection, and honeypot links. It runs through a structured checklist covering authentication and authorization, data isolation, API security, secrets management, dependency vulnerabilities, and infrastructure configuration. It treats multi-tenant isolation violations as Critical severity (because they are data breaches), verifies that security controls actually work rather than just checking they exist, and checks both happy paths and error paths. Its output is a severity-ranked audit report with exact file:line locations, impact descriptions, and specific remediation code.

**When and how to use it:** Use the Security Auditor before any deployment that touches authentication, payment processing, API routes, or database queries — basically any code that handles sensitive data or external integrations. Ask Claude to "run a security audit on the new Stripe webhook handler" or "audit the account routes for data isolation." It's also valuable to run periodically as a general health check, especially after adding new dependencies or changing environment variable handling. The auditor is particularly important for this project because multi-tenant isolation is a hard requirement — a single missing `publication_id` filter could expose one publication's data to another. Use it proactively rather than reactively: catching a missing auth check before deployment is far cheaper than dealing with a security incident after. It pairs well with the team-reviewer's security dimension, but goes deeper with its structured checklist and compliance-oriented approach.

---

## Database Optimizer

The Database Optimizer is a Supabase PostgreSQL performance specialist that analyzes your queries, indexes, schema design, and migrations for efficiency and correctness. It knows your key tables (`publication_issues`, `rss_posts`, `articles`, `ai_applications`, `link_clicks`, `ad_modules`, `prompt_modules`, `newsletter_sections`, `publication_settings`), your DAL pattern in `src/lib/dal/`, your column selection policy prohibiting `select('*')`, and your 89+ migration files. It checks for N+1 query patterns in API routes and workflow steps, reviews JOIN efficiency, identifies missing composite indexes, evaluates whether large tables like `link_clicks` and `rss_posts` need partitioning, and verifies that migrations are safe for zero-downtime deployment (no locking operations on large tables, RLS policies preserved after schema changes). It also catches common Supabase-specific issues like misusing `.single()` vs `.maybeSingle()`, unbounded queries missing `.limit()`, and incorrect use of `supabaseAdmin` vs the regular client. It runs on Sonnet for cost efficiency since its analysis is thorough but doesn't require Opus-level reasoning.

**When and how to use it:** Use the Database Optimizer whenever you're writing new database queries, creating migrations, or troubleshooting slow API responses. Ask Claude to "run the database optimizer on the workflow steps" or "check the new migration for safety." It's especially valuable before deploying migrations to production — it will flag operations that could lock tables or break RLS policies, which are exactly the kind of issues that are invisible in staging but catastrophic in production. It's also useful for periodic performance reviews: point it at a high-traffic API route and it will identify whether your queries are efficient, whether you're missing indexes on frequently filtered columns, and whether you have unbounded queries that could return thousands of rows. The optimizer provides migration-ready SQL in its recommendations, so you can often take its suggestions and drop them directly into a new file in `db/migrations/`.

---

## Quick Reference

| Agent | Model | Tools | Read-Only? | Best For |
|-------|-------|-------|------------|----------|
| team-lead | Opus | Read, Glob, Grep, Bash | Yes | Coordinating multi-agent work |
| team-reviewer | Opus | Read, Glob, Grep, Bash | Yes | Focused code review on one dimension |
| team-debugger | Opus | Read, Glob, Grep, Bash | Yes | Hypothesis-driven bug investigation |
| team-implementer | Opus | Read, Write, Edit, Glob, Grep, Bash | No | Parallel feature building |
| security-auditor | Opus | Read, Glob, Grep, Bash | Yes | Security audits and compliance |
| database-optimizer | Sonnet | Read, Glob, Grep, Bash | Yes | Query and schema optimization |

## Example Prompts

```
"Run a security audit on all the account routes"
"Debug this workflow failure — investigate 3 hypotheses in parallel"
"Review the RSS processor changes for performance and architecture"
"Use the team-lead to coordinate building the new events feature"
"Check the new migration for safety and index recommendations"
"Review the cron job changes for security before I deploy"
```

## Automatic Pre-Push Gates

Two agents are integrated into the pre-push hook (`.claude/hooks/pre-push-guard.ts`) and will automatically block `git push` and `gh pr create` when sensitive files have been changed without running the appropriate agent first.

### Security Auditor Gate

Triggers when your branch has changed any of these file patterns:
- `src/app/api/account/`, `src/app/api/webhooks/`, `src/app/api/stripe/`, `src/app/api/cron/`
- Any `route.ts` file under `src/app/api/`
- `src/lib/auth*`, `src/lib/env-guard/`, `src/lib/bot-detection/`, `src/lib/api-handler.ts`
- `middleware.ts`, `.env` files

**When blocked**, you'll see a message listing the changed files and instructions to run the security-auditor agent. After running the audit and addressing any findings, create the approval marker:

```bash
git rev-parse HEAD > .claude/.security-auditor-approved
```

### Database Optimizer Gate

Triggers when your branch has changed any of these file patterns:
- `db/migrations/` (any migration file)
- `src/lib/dal/` (data access layer)
- Any `.sql` file

**When blocked**, run the database-optimizer agent on the changed files, then create the marker:

```bash
git rev-parse HEAD > .claude/.database-optimizer-approved
```

### Gate Workflow

The full pre-push flow is now:

1. `/simplify` — review changed code for reuse, quality, efficiency
2. `/requesting-code-review` — CodeRabbit or manual review
3. **security-auditor** (if auth/API/security files changed) — run agent, address findings
4. **database-optimizer** (if migration/DAL/SQL files changed) — run agent, address findings
5. Create all approval markers (`git rev-parse HEAD > .claude/.<marker>`)
6. Push or create PR

All markers are SHA-based — if you make new commits after approval, the markers become stale and you'll need to re-run the relevant checks.

## Source

These agents were adapted from the [wshobson/agents](https://github.com/wshobson/agents) repository, which provides 112 specialized agents across 72 plugins. The originals were generic; these versions have been customized with AIProDaily's specific tech stack, conventions, known bug patterns, and critical rules (multi-tenant isolation, column selection policy, date handling, etc.).
