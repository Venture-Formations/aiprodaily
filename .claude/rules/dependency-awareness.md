# Dependency Awareness Rule

Before modifying any file in `src/lib/`, consult `docs/architecture/DEPENDENCY_MAP.md` to understand the impact.

## When to Check

1. **Before modifying a lib module** — Read the "Reverse Index: Lib Modules" section to see all files that import it. List affected dependents in your response.
2. **Before modifying a database table's schema** — Read the "Reverse Index: Tables" section to see all files that reference that table.
3. **When creating implementation plans** — Include a "Blast Radius" section listing affected crons, routes, and pages from the dependency map.
4. **When reviewing PRs** — Flag changes to high-connectivity files (Section 5 of the map) for extra scrutiny.

## How to Check

```
1. Read docs/architecture/DEPENDENCY_MAP.md
2. Search for the file/table/module you're changing
3. List all dependents in your plan or response
4. Consider whether dependents need updates too
```

## What to Report

When modifying a lib file, include in your response:
- Number of dependents (from the reverse index)
- Which crons are affected (tagged `[cron]` in the map)
- Which API routes are affected (tagged `[api]`)
- Which dashboard/pages are affected (tagged `[dash]`/`[page]`)
- Whether database tables touched by the file have other consumers

## Regenerating the Map

If you've made structural changes (new imports, new files, renamed modules), regenerate:
```bash
npm run generate:dep-map
```

## Priority

This rule applies to all implementation tasks. It does NOT apply to:
- Read-only research or exploration
- Documentation-only changes
- Test file changes (unless modifying shared test utilities)
