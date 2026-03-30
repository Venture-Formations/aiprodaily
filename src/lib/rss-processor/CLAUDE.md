# RSS Processor

## Module Structure

| File | Responsibility |
|------|---------------|
| `rss-processor.ts` | Main orchestrator — facade for all sub-modules |
| `feed-ingestion.ts` | Fetching RSS feeds, extracting posts |
| `scoring.ts` | AI-based post scoring against module criteria |
| `article-generator.ts` | Generating newsletter article titles and bodies |
| `article-selector.ts` | Selecting top articles for issues |
| `article-extraction.ts` | Full text extraction from URLs |
| `deduplication.ts` | Duplicate post detection and grouping |
| `module-articles.ts` | Assigning posts to article modules |
| `step-workflow.ts` | Step-based issue processing orchestration |
| `issue-lifecycle.ts` | Issue status and data management |
| `shared-context.ts` | Dependency injection context and AI refusal detection |
| `utils.ts` | Shared utilities |

## AI Refusal Detection (CRITICAL)

Always validate AI output before storing in the database:

```typescript
import { detectAIRefusal } from './shared-context'

const result = await callAIWithPrompt(...)
const refusal = detectAIRefusal(result)
if (refusal) {
  logger.error({ phrase: refusal }, 'AI refusal detected — skipping')
  return null  // Do not store refusal text
}
```

This prevents "I'm sorry, I need the content..." from being sent to subscribers.

## Scoring Pattern

- Criteria are per-module (`article_module_criteria` table)
- Process criteria sequentially (not parallel) to manage memory with full article text
- Early termination: if `enforce_minimum` is set and score < `minimum_score`, skip remaining criteria
- Calculate weighted totals using `weight` from each criterion

## Dependency Injection

Use `createDefaultContext()` from `shared-context.ts`:
```typescript
const context = createDefaultContext()
// Provides: errorHandler, slack, imageStorage, archiveService, articleExtractor
```

## Multi-Tenant Processing

All methods iterate over active publications:
```typescript
const { data: pubs } = await supabaseAdmin
  .from('publications').select('id, name, slug').eq('is_active', true)
for (const pub of pubs) {
  // Process feeds for pub.id
}
```

## Key Tables

`rss_feeds`, `rss_posts`, `publication_issues`, `module_articles`, `article_module_criteria`, `duplicate_groups`, `post_ratings`
