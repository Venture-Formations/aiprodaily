---
allowed-tools: Agent, Read, Glob, Grep, Bash
---

# Review: End of Writing

Run all relevant reviewer personas against recently changed code. This is a thorough review meant for after you've finished writing code but before creating a PR.

## Instructions

### 1. Get Changed Files

```bash
# Get files changed vs master
git diff --name-only $(git merge-base HEAD master)...HEAD
```

If no changes vs master, fall back to:
```bash
git diff --name-only HEAD~1
```

Also include staged but uncommitted changes:
```bash
git diff --name-only --cached
git diff --name-only
```

Combine all into a deduplicated list.

### 2. Classify Files

Separate changed files into categories:

**Backend patterns:**
- `src/lib/**` (excluding UI-only utilities)
- `src/app/api/**`
- `db/**`
- `scripts/**`
- `src/types/**` (shared — triggers both)
- `src/utils/**` (shared — triggers both)

**Frontend patterns:**
- `src/components/**`
- `src/app/**/page.tsx`
- `src/app/**/layout.tsx`
- `src/app/**/loading.tsx`
- `src/app/**/error.tsx`
- `src/app/dashboard/**`
- `src/app/tools/**` (public pages)
- `src/app/account/**`
- `src/app/website/**`

If no backend files changed, skip backend reviewers. If no frontend files changed, skip frontend reviewers.

### 3. Read Changed Files

Read all changed files (or their relevant sections) so you can provide them as context to reviewers.

### 4. Launch Reviewers in Parallel

**Backend reviewers (end-of-writing):**
- `lead-dev` — Patterns, consistency, maintainability
- `security` — Auth, injection, tenant isolation
- `junior-dev` — Footguns, edge cases
- `dba` — Query performance, publication_id
- `ops` — Logging, error handling, timeouts

**Frontend reviewers (end-of-writing):**
- `designer` — Visual consistency
- `layout` — Responsive design
- `usability` — User flows, a11y
- `naming` — Labels, terminology
- `avg-employee` — Discoverability
- `qa` — Test coverage

For each agent:
```
Review the following code changes as the [ROLE] reviewer.

Changed files:
[file list with category]

File contents:
[paste relevant code sections]

Follow your review guidelines in .claude/agents/reviewers/[role].md and output findings in the specified format.
Review the actual code — cite specific file:line locations.
```

### 5. Consolidate Output

```markdown
## Code Review — End of Writing ([N] roles, [M] files)

### Critical ([count])
[All critical findings from all roles]

### Warning ([count])
[All warnings from all roles]

### Suggestions ([count])
[All suggestions from all roles]

### No Issues
[Roles that found nothing]

---
**Files reviewed**: [count] files across [backend/frontend/both]
**Roles run**: [list of roles that ran]
```
