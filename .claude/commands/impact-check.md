---
description: Check dependency impact of a file, function, or table before making changes
user-invocable: true
argument: file path, function name, or table name to check
---

# Impact Check

You are performing a dependency impact analysis. The user wants to know what depends on a specific file, function, or database table before making changes.

## Steps

1. **Read the dependency map**: Read `docs/architecture/DEPENDENCY_MAP.md`

2. **Identify the target**: Parse the user's argument — it could be:
   - A file path (e.g., `src/lib/openai.ts`)
   - A lib module name (e.g., `openai`, `rss-processor`)
   - A database table name (e.g., `publication_issues`)
   - A function or class name (search for it in the map)

3. **Search the map for the target**:
   - If it's a lib module: Find it in "Section 4: Reverse Index: Lib Modules" and "Section 5: High-Connectivity Files"
   - If it's a table: Find it in "Section 3: Reverse Index: Tables"
   - If it's a cron: Find it in "Section 1: Cron Jobs"
   - If it's an API route: Find it in "Section 2: API Routes"

4. **If the map is stale or missing**: Run `npm run generate:dep-map` first, then read the output

5. **Report the impact** in this format:

```
## Impact Analysis: {target}

### Direct Dependents ({count})
- [cron] ...
- [api] ...
- [lib] ...
- [dash] ...

### Database Tables Affected
- `table_name` — also used by: {other files}

### Blast Radius: {LOW | MEDIUM | HIGH}
- LOW: 1-3 dependents, no crons affected
- MEDIUM: 4-10 dependents, or crons affected
- HIGH: 10+ dependents, critical path (send-final, trigger-workflow)

### Suggested Testing
- {List specific crons/routes to test after changes}
```

6. **Cross-reference**: If the target imports other lib modules, briefly note their dependents too (transitive dependencies).

## Important

- Always use the generated map, not manual code reading, for completeness
- If the map seems incomplete for a file, suggest the user regenerate with `npm run generate:dep-map`
- Flag any HIGH blast radius items prominently
