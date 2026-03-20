---
allowed-tools: Agent, Read, Glob, Grep, Bash
---

# Review: Planning Stage

Run reviewer personas relevant to the planning stage to evaluate proposed changes or design decisions.

## Instructions

### 1. Identify Scope

Ask the user what they're planning. This could be:
- A design doc or proposal they've written
- A feature they're about to implement
- Files they're about to change

If they point to specific files, read those files. If it's a verbal description, work with that.

### 2. Classify Changes

Determine if the planned work is backend, frontend, or both:
- **Backend**: `src/lib/`, `src/app/api/`, `db/`, `scripts/`, server-side logic
- **Frontend**: `src/components/`, `src/app/**/page.tsx`, `src/app/**/layout.tsx`, UI components
- **Both**: Changes spanning both areas

### 3. Launch Reviewers

Based on classification, launch the appropriate reviewers **in parallel** using the Agent tool:

**Backend reviewers (planning stage):**
- `cto` — Architecture, scalability, business alignment
- `lead-dev` — Patterns, consistency, maintainability
- `dba` — Schema design, query patterns, data model

**Frontend reviewers (planning stage):**
- `usability` — User flows, accessibility
- `avg-employee` — Discoverability, intuitiveness
- `naming` — Terminology, labels, clarity

For each agent, provide:
```
Review the following planned changes as the [ROLE] reviewer.

Context: [what the user described or the files read]

Changed/planned files:
[list of files or description]

Follow your review guidelines in .claude/agents/reviewers/[role].md and output findings in the specified format.
Focus on planning-level concerns — this code hasn't been written yet, so focus on design decisions, not implementation details.
```

### 4. Consolidate Output

After all agents complete, merge findings into a single report:

```markdown
## Planning Review ([N] backend, [M] frontend roles)

### Critical ([count])
[findings sorted by severity]

### Warning ([count])
[findings]

### Suggestions ([count])
[findings]

### No Issues
[roles that found nothing]
```

### 5. Summary

End with a brief recommendation:
- **Proceed**: No blockers found
- **Address first**: Critical issues that should be resolved before implementation
- **Consider**: Warnings that are worth thinking about but not blocking
