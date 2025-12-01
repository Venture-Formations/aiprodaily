# Claude-Optimized.md – Rationale & Summary

_Last updated: 2025-11-11_

## Purpose
Explain the restructuring of `claude.md` into `claude-optimized.md` and summarize supporting documentation changes made to improve Claude Code’s effectiveness.

## Why We Changed It
- **Signal Orientation:** The original `CLAUDE.md` ballooned to ~600 lines, mixing critical rules with deep dives. Claude often loaded too much context, missing the most relevant pieces.
- **Task Routing:** There was no quick way for Claude to know which doc to read for a given feature or workflow. We needed a decision-driven map.
- **Documentation Drift:** Long-form explanations buried in `CLAUDE.md` made it hard to keep other docs current; updates often lived in multiple places.
- **Scalability:** As new publications and workflows emerge, we need a guide that surfaces owners, tests, and dependent docs without becoming unmanageable.

## Key Changes
1. **New guide (`claude-optimized.md`)**
   - Added Quick Start and Critical Rules at the top (same guardrails as before, distilled).
   - Created a **Task Router** with @ references so Claude jumps to specific docs per scenario.
   - Introduced **Feature Ownership Map**, **Testing Matrix**, **Environment Overview**, and **Cross-Feature Checklist**.
   - Added **Documentation Hygiene** reminders to keep supporting docs synced.
   - Expanded references to existing guides (Vercel API, OpenAI Responses, feature summaries) that previously required manual searching.

2. **Supporting doc reorganization**
   - Moved detailed content to new files in `docs/`:
     - `docs/architecture/system-overview.md` (full multi-tenant schema + flow)
     - `docs/workflows/rss-processing.md` (ten-step campaign workflow)
     - `docs/ai/prompt-system.md` (prompt storage & usage)
     - `docs/operations/cron-jobs.md` (cron schedules & recovery)
     - `docs/patterns/backend.md` (API/query templates & retry patterns)
     - `docs/recipes/quick-actions.md` (checklists)
     - `docs/troubleshooting/common-issues.md` (symptom-driven fixes)
   - Linked all new docs via @ mentions in the optimized guide.

3. **Kept essentials**
   - Preserved all critical rules from the original guide (multi-tenant filtering, date handling, logging discipline, retry logic, security).
   - Retained references to legacy strategy docs (feature guides, migrations, AI prompt guides) via the Task Router.
   - Added reminders to update the docs themselves whenever workflows or prompts change, so practices stay aligned.

## Benefits
- **Faster Guidance:** Claude sees the critical rule set immediately and jumps to the right deep-dive doc, conserving context window.
- **Reduced Duplication:** Long explanations now live in dedicated docs, so updates happen once in the proper place.
- **Scalable Structure:** Ownership map, testing matrix, and env overview help new features slot in with minimal friction.
- **Better Process Discipline:** Cross-feature checklist and doc hygiene section reinforce the hand-off steps, lowering regression risk.
- **Improved Collaboration:** Humans reviewing Claude’s work can follow the same map, keeping expectations consistent.

## Follow-up Actions
- Review `claude-optimized.md` during code review to ensure links remain accurate.
- When adding new major features, create/update docs in the relevant subfolder and add @ references in the guide.
- Once satisfied, replace `CLAUDE.md` with the optimized version (rename after approval).

This doc serves as the change log for the Claude guide overhaul. Update it when further structural adjustments are made.
