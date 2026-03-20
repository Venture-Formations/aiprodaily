---
allowed-tools: Agent, Read, Glob, Grep, Bash
---

# Review: Pre-Push (Gate)

Fast, focused review using only gate roles. Designed to catch Critical issues before push. This runs automatically via the pre-push hook, but can also be invoked manually.

**IMPORTANT**: This review BLOCKS the push if any Critical findings are discovered. Warnings and Suggestions are shown but do not block.

## Instructions

### 1. Get Changed Files (Fast)

```bash
# Changed files vs master (branch diff)
git diff --name-only $(git merge-base HEAD master)...HEAD 2>/dev/null || git diff --name-only HEAD~1
```

### 2. Classify Files

**Backend** (any match → run backend gate roles):
- `src/lib/**`
- `src/app/api/**`
- `db/**`
- `scripts/**`

**Frontend** (any match → run frontend gate roles):
- `src/components/**`
- `src/app/**/page.tsx`
- `src/app/**/layout.tsx`
- `src/app/**/loading.tsx`
- `src/app/**/error.tsx`
- `src/app/dashboard/**`
- `src/app/tools/**`
- `src/app/account/**`
- `src/app/website/**`

**Shared** (`src/types/**`, `src/utils/**`) → run both.

Skip roles for categories with no changed files.

### 3. Read Changed Files

Read all changed files to provide as context.

### 4. Launch Gate Reviewers in Parallel

**Backend gate roles:**
- `security` — Auth, injection, tenant isolation
- `junior-dev` — Footguns, null checks, edge cases
- `dba` — Query performance, publication_id filters
- `ops` — Logging, error handling, timeouts

**Frontend gate roles:**
- `layout` — Responsive, overflow, breakpoints
- `usability` — a11y, error states, feedback
- `qa` — Test coverage for changed code

For each agent:
```
GATE REVIEW (pre-push): Review these changes as the [ROLE] reviewer.

This is a pre-push gate check. Focus ONLY on issues that would be Critical severity.
You may also report Warnings, but be selective — this is a speed-focused review.
Do NOT report Suggestions in gate reviews.

Changed files:
[file list]

File contents:
[code]

Follow .claude/agents/reviewers/[role].md for your review criteria.
```

### 5. Consolidate and Gate

```markdown
## Pre-Push Gate Review ([N] roles, [M] files)

### Critical ([count]) — BLOCKS PUSH
[critical findings]

### Warning ([count]) — Does not block
[warnings]

### No Issues
[roles with no findings]
```

### 6. Gate Decision

**If any Critical findings exist:**
```
❌ PUSH BLOCKED: [count] critical issue(s) found.

Fix the critical issues above, then retry.
```

**If only Warnings or no findings:**
```
✅ Gate passed. [count] warning(s) noted for reference.
```

After a successful gate pass, write the approval marker:
```bash
git rev-parse HEAD > .claude/.review-gate-approved
```
