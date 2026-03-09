---
name: requesting-code-review
description: Use when completing tasks, implementing major features, or before merging to verify work meets requirements
---

# Requesting Code Review

Dispatch a code review to catch issues before they cascade.

**Core principle:** Review early, review often.

> **Project note:** This project requires CodeRabbit or manual review before push (see CLAUDE.md section 4). Run `mcp__coderabbit__run_review` when available.

## When to Request Review

**Mandatory:**
- After completing major feature
- Before merge to main
- After fixing complex bug

**Optional but valuable:**
- When stuck (fresh perspective)
- Before refactoring (baseline check)

## How to Request

**1. Get git SHAs:**
```bash
BASE_SHA=$(git rev-parse HEAD~1)  # or origin/main
HEAD_SHA=$(git rev-parse HEAD)
```

**2. Dispatch code-reviewer subagent:**

Use Task tool with code-reviewer type, fill template at `code-reviewer.md` in this directory.

**Placeholders:**
- `{WHAT_WAS_IMPLEMENTED}` - What you just built
- `{PLAN_OR_REQUIREMENTS}` - What it should do
- `{BASE_SHA}` - Starting commit
- `{HEAD_SHA}` - Ending commit
- `{DESCRIPTION}` - Brief summary

**3. Act on feedback:**
- Fix Critical issues immediately
- Fix Important issues before proceeding
- Note Minor issues for later
- Push back if reviewer is wrong (with reasoning)

## Integration with Project Workflow

This project uses CodeRabbit for automated reviews. The manual code-reviewer template in this skill is for deeper reviews or when CodeRabbit is unavailable.

**Before every push:**
1. Run `mcp__coderabbit__run_review` (or manual checklist from CLAUDE.md section 4)
2. Address all issues found
3. Only push after review passes

## Red Flags

**Never:**
- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed Important issues
- Argue with valid technical feedback

**If reviewer wrong:**
- Push back with technical reasoning
- Show code/tests that prove it works
- Request clarification

---

## Responding to Review Feedback

When receiving code review feedback, apply technical evaluation, not performative agreement.

### The Response Pattern

```
1. READ: Complete feedback without reacting
2. UNDERSTAND: Restate requirement in own words (or ask)
3. VERIFY: Check against codebase reality
4. EVALUATE: Technically sound for THIS codebase?
5. RESPOND: Technical acknowledgment or reasoned pushback
6. IMPLEMENT: One item at a time, test each
```

### Handling Unclear Feedback

If any item is unclear, STOP - do not implement anything yet. Ask for clarification on unclear items before proceeding with any changes.

### When To Push Back

Push back when:
- Suggestion breaks existing functionality
- Reviewer lacks full context
- Violates YAGNI (unused feature)
- Technically incorrect for this stack
- Conflicts with architectural decisions

**How to push back:**
- Use technical reasoning, not defensiveness
- Ask specific questions
- Reference working tests/code

### Implementation Order

For multi-item feedback:
1. Clarify anything unclear FIRST
2. Then implement in order: blocking issues, simple fixes, complex fixes
3. Test each fix individually
4. Verify no regressions

### Acknowledging Correct Feedback

When feedback IS correct, just fix it and show the change. Actions speak louder than words.

See template at: `code-reviewer.md` in this directory.
