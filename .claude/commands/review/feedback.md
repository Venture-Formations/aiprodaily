---
allowed-tools: Read, Edit, Bash
---

# Review Feedback

Record a lesson learned from a review — either a real finding that should be caught more reliably, or a false positive that should be avoided.

## Usage
```
/review-feedback
```

Then describe what happened. The command will ask clarifying questions if needed.

## Instructions

### 1. Gather Feedback

Ask the user:
```
What happened in the review?
1. A reviewer caught a real issue (reinforce this pattern)
2. A reviewer flagged a false positive (avoid this in future)
3. A reviewer missed something that should have been caught
```

### 2. Collect Details

Based on the type:

**Real issue (reinforce):**
- Which role caught it?
- What was the pattern? (e.g., "missing publication_id filter on new route")
- Why was it important?

**False positive (avoid):**
- Which role flagged it?
- What was flagged and why was it wrong?
- What context should the reviewer consider to avoid this?

**Missed issue (gap):**
- Which role(s) should have caught it?
- What was the issue?
- What should the reviewer look for to catch this in future?

### 3. Get Current Date

```bash
date -u +"%Y-%m-%d"
```

### 4. Append to Lessons File

Read `.claude/agents/reviewers/lessons.md`, then append the new lesson:

```markdown
## [DATE] [TYPE]: [Brief Title]

**Role**: [role name]
**Type**: Reinforce | Avoid | Gap
**Pattern**: [what to look for or avoid]
**Context**: [why this matters or when it applies]
**Example**: [specific file/code if relevant]
```

### 5. Update Relevant Agent (Optional)

If the lesson reveals a gap in a specific agent's review criteria, offer to update that agent's `.md` file to include the new check. Only do this for significant, recurring patterns — not one-off issues.

### 6. Confirm

```
✅ Lesson recorded in .claude/agents/reviewers/lessons.md

[Brief summary of what was recorded]
```
