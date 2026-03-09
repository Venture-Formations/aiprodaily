#!/bin/bash
# Pre-push guard: blocks git push and gh pr create unless /simplify and
# /requesting-code-review have been run for the current HEAD commit.
#
# Delegates to Node.js to avoid jq dependency on Windows.

set -e

cd "$CLAUDE_PROJECT_DIR/.claude/hooks"
cat | npx tsx pre-push-guard.ts
