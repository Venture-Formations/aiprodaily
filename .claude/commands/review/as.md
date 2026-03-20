---
allowed-tools: Agent, Read, Glob, Grep, Bash
description: "Run specific reviewer role(s) against changed files. Usage: /review-as cto  or  /review-as security,dba"
---

# Review As: Specific Role(s)

Run one or more specific reviewer personas against changed files.

## Usage
```
/review-as cto
/review-as security,dba
/review-as designer,usability,naming
```

## Valid Role IDs
**Backend**: `cto`, `lead-dev`, `security`, `junior-dev`, `dba`, `ops`
**Frontend**: `designer`, `layout`, `usability`, `naming`, `avg-employee`, `qa`

## Instructions

### 1. Parse Arguments

The argument is `$ARGUMENTS`. Split by comma to get role list.

If no argument or invalid role ID, show:
```
Usage: /review-as <role>[,role2,...]

Available roles:
  Backend:  cto, lead-dev, security, junior-dev, dba, ops
  Frontend: designer, layout, usability, naming, avg-employee, qa

Examples:
  /review-as cto
  /review-as security,dba
  /review-as designer,usability
```

### 2. Get Changed Files

```bash
git diff --name-only $(git merge-base HEAD master)...HEAD 2>/dev/null || git diff --name-only HEAD~1
```

Also include uncommitted:
```bash
git diff --name-only --cached
git diff --name-only
```

### 3. Read Changed Files

Read all changed files to provide as context.

### 4. Launch Specified Reviewers

For each requested role, launch an Agent:

```
Review these code changes as the [ROLE] reviewer.

Changed files:
[file list]

File contents:
[code]

Follow .claude/agents/reviewers/[role].md for your review criteria.
Report all findings — Critical, Warning, and Suggestion.
```

Launch all requested roles in parallel.

### 5. Consolidate Output

```markdown
## Review as [role1, role2, ...] ([M] files)

### Critical ([count])
[findings]

### Warning ([count])
[findings]

### Suggestions ([count])
[findings]

### No Issues
[roles with no findings]
```
