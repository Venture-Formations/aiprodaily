---
name: module-articles-migration
created: 2026-03-31T13:42:40Z
updated: 2026-03-31T13:42:40Z
status: planning
---

# Spec Initialization: Complete module_articles Migration

## Origin
Database optimization plan Phase 3, Q6 — identified during comprehensive DB audit (2026-03-30).

## Context
The newsletter system currently has **three coexisting article tables**:
- `articles` (legacy, 56 code references) — global per-issue primary articles
- `secondary_articles` (legacy, 29 references) — per-issue secondary articles
- `module_articles` (new, 73 references) — per-module articles with richer schema

The module system was introduced to support multi-publication, per-module content management. However, the migration is incomplete — both systems run in parallel, creating maintenance burden, data inconsistency risks, and developer confusion.

## Goal
Sunset `articles` and `secondary_articles` tables, making `module_articles` the single source of truth for all newsletter article content.

## Scope
- RSS processing pipeline (article generation, selection, scoring)
- Newsletter template rendering
- Dashboard UI (article management, reordering)
- Archiving system
- Breaking news system
- Debug/testing endpoints
- TypeScript types
