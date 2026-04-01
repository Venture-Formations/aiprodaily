# Dependency Awareness Rule

GitNexus MCP provides live code intelligence via a knowledge graph. Use its tools instead of static dependency maps.

## When to Check

1. **Before modifying a lib module** — Use GitNexus `impact` tool to see blast radius with confidence scores.
2. **Before modifying a database table's schema** — Use GitNexus `context` tool for 360-degree symbol view.
3. **When creating implementation plans** — Use GitNexus `impact` tool and include results in a "Blast Radius" section.
4. **When reviewing PRs** — Use GitNexus `detect_changes` to map diffs to affected processes.

## Available GitNexus MCP Tools

| Tool | Purpose |
|------|---------|
| `query` | Hybrid search (BM25 + semantic) across the codebase |
| `context` | 360-degree symbol view with categorized references |
| `impact` | Blast radius analysis with depth grouping and confidence |
| `detect_changes` | Maps git diffs to affected processes |
| `rename` | Coordinated multi-file refactoring with graph validation |
| `cypher` | Raw graph queries for advanced analysis |
| `list_repos` | Discover all indexed repositories |

## Re-indexing

GitNexus auto-reindexes via PostToolUse hooks when files change. To manually re-index:
```bash
npx gitnexus analyze
```

## What to Report

When modifying a lib file, include in your response:
- Blast radius from GitNexus `impact` tool (with confidence scores)
- Which crons, API routes, and pages are affected
- Whether database tables touched by the file have other consumers

## Priority

This rule applies to all implementation tasks. It does NOT apply to:
- Read-only research or exploration
- Documentation-only changes
- Test file changes (unless modifying shared test utilities)
