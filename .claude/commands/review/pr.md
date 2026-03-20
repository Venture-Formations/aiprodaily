---
allowed-tools: Agent, Read, Glob, Grep, Bash
---

# Review: Pre-PR (Full)

Run ALL 12 reviewer personas against changed code. This is the most thorough review — run before creating a pull request.

## Instructions

### 1. Get Changed Files

```bash
# All files changed in this branch vs master
git diff --name-only $(git merge-base HEAD master)...HEAD
```

Also include uncommitted changes:
```bash
git diff --name-only --cached
git diff --name-only
```

Combine and deduplicate.

### 2. Classify Files

**Backend patterns:**
- `src/lib/**`, `src/app/api/**`, `db/**`, `scripts/**`

**Frontend patterns:**
- `src/components/**`, `src/app/**/page.tsx`, `src/app/**/layout.tsx`
- `src/app/**/loading.tsx`, `src/app/**/error.tsx`
- `src/app/dashboard/**`, `src/app/tools/**`, `src/app/account/**`, `src/app/website/**`

**Shared** (`src/types/**`, `src/utils/**`) → both.

### 3. Read Changed + Related Files

For the full PR review, also read files that import/export from changed files to catch ripple effects:
```bash
# For each changed file, find files that import from it
grep -rl "from.*changed-file" src/
```

Limit to first-degree dependencies to keep scope manageable.

### 4. Launch ALL Reviewers in Parallel

**All 6 backend reviewers** (if backend files changed):
- `cto` — Architecture, scalability, business alignment
- `lead-dev` — Patterns, consistency, maintainability
- `security` — Auth, injection, tenant isolation
- `junior-dev` — Footguns, edge cases
- `dba` — Query performance, publication_id
- `ops` — Logging, error handling, timeouts

**All 6 frontend reviewers** (if frontend files changed):
- `designer` — Visual consistency
- `layout` — Responsive design
- `usability` — User flows, a11y
- `naming` — Labels, terminology
- `avg-employee` — Discoverability
- `qa` — Test coverage

For each agent:
```
FULL PR REVIEW: Review these changes as the [ROLE] reviewer.

This is a comprehensive pre-PR review. Report all findings — Critical, Warning, and Suggestion.

Changed files:
[file list]

Related files (first-degree imports):
[related file list]

File contents:
[code for changed files]
[relevant sections of related files]

Follow .claude/agents/reviewers/[role].md for your review criteria.
Be thorough — this is the final review before the PR is created.
```

### 5. Consolidate Output

```markdown
## Full PR Review ([N] roles, [M] files, [K] related files)

### Critical ([count])
[All critical findings, grouped by file]

### Warning ([count])
[All warnings, grouped by file]

### Suggestions ([count])
[All suggestions, grouped by role]

### No Issues
[Roles that found nothing]

---
**Summary**: [one-line assessment]
**Files reviewed**: [count] changed + [count] related
**Backend roles**: [list] | **Frontend roles**: [list]
**Recommendation**: Ready for PR / Address criticals first / Significant rework needed
```
