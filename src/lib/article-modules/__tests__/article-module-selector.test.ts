import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

type SupaResponse = { data: any; error: any }
const supabase = vi.hoisted(() => ({
  responseQueue: [] as SupaResponse[],
  // (table, [eq calls]) per from() invocation — used to assert tenant filters
  // and call ordering. Same pattern as openai/__tests__/core.test.ts.
  fromCalls: [] as Array<{ table: string; eqCalls: Array<[string, any]> }>,
  updateCalls: [] as Array<{ table: string; payload: any }>,
  upsertCalls: [] as Array<{ table: string; payload: any }>,
}))

function makeSupaChain(table: string, response: SupaResponse, eqCalls: Array<[string, any]>): any {
  const chain: any = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn((col: string, val: any) => {
    eqCalls.push([col, val])
    return chain
  })
  chain.not = vi.fn(() => chain)
  chain.gte = vi.fn(() => chain)
  chain.in = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.single = vi.fn(() => Promise.resolve(response))
  chain.maybeSingle = vi.fn(() => Promise.resolve(response))
  chain.update = vi.fn((payload: any) => {
    supabase.updateCalls.push({ table, payload })
    return chain
  })
  chain.upsert = vi.fn((payload: any) => {
    supabase.upsertCalls.push({ table, payload })
    return chain
  })
  chain.insert = vi.fn(() => chain)
  // Many queries await the chain directly (no .single()); make it thenable.
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(response).then(resolve, reject)
  return chain
}

vi.mock('../../supabase', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      // Strict: throw on unexpected from() calls instead of silently returning
      // a null/null fallback. Converts queue-underrun into a diagnosable error
      // (gate-review feedback W1).
      const response = supabase.responseQueue.shift()
      if (!response) {
        throw new Error(`[test] Unexpected supabaseAdmin.from('${table}') — add a response to the queue`)
      }
      const eqCalls: Array<[string, any]> = []
      supabase.fromCalls.push({ table, eqCalls })
      return makeSupaChain(table, response, eqCalls)
    }),
  },
}))

import { ArticleModuleSelector } from '../article-module-selector'

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})

  supabase.responseQueue.length = 0
  supabase.fromCalls.length = 0
  supabase.updateCalls.length = 0
  supabase.upsertCalls.length = 0
})

afterEach(() => {
  // Catch silent drift if a future SUT change adds a from() call without
  // updating test setup — see openai/__tests__/core.test.ts for the same pattern.
  expect(supabase.responseQueue).toHaveLength(0)
  vi.restoreAllMocks()
})

function makeArticle(overrides: Record<string, any> = {}) {
  return {
    id: 'art-default',
    post_id: 'post-default',
    headline: 'A headline',
    content: 'Article content',
    fact_check_score: 5,
    ...overrides,
  }
}

function makeRating(post_id: string, total_score: number, criteriaScores: Partial<Record<'criteria_1_score' | 'criteria_2_score' | 'criteria_3_score' | 'criteria_4_score' | 'criteria_5_score', number | null>> = {}) {
  return {
    post_id,
    total_score,
    criteria_1_score: criteriaScores.criteria_1_score ?? null,
    criteria_2_score: criteriaScores.criteria_2_score ?? null,
    criteria_3_score: criteriaScores.criteria_3_score ?? null,
    criteria_4_score: criteriaScores.criteria_4_score ?? null,
    criteria_5_score: criteriaScores.criteria_5_score ?? null,
  }
}

// Sequence: criteria SELECT, articles SELECT, ratings SELECT, deactivate-all
// UPDATE, activate UPDATE × N, upsert issue_article_modules.
// `activatedCount` is the number of activate calls the SUT will make —
// equals min(eligibleArticles.length, limit). All activate responses are
// success; tests exercising partial-activate failure must queue manually.
function pushActivateHappyPath(opts: {
  criteria?: Array<{ criteria_number: number; minimum_score: number; enforce_minimum: boolean; name: string }>
  articles: Array<ReturnType<typeof makeArticle>>
  ratings: Array<ReturnType<typeof makeRating>>
  activatedCount: number
}) {
  supabase.responseQueue.push({ data: opts.criteria ?? [], error: null })
  supabase.responseQueue.push({ data: opts.articles, error: null })
  supabase.responseQueue.push({ data: opts.ratings, error: null })
  supabase.responseQueue.push({ data: null, error: null })
  for (let i = 0; i < opts.activatedCount; i++) {
    supabase.responseQueue.push({ data: null, error: null })
  }
  supabase.responseQueue.push({ data: null, error: null })
}

// Sequence: criteria SELECT, articles SELECT, ratings SELECT, getModule
// SELECT, publication_issues metrics SELECT, publication_issues metrics UPDATE.
function pushInsufficientCandidatesPath(opts: {
  criteria: Array<{ criteria_number: number; minimum_score: number; enforce_minimum: boolean; name: string }>
  articles: Array<ReturnType<typeof makeArticle>>
  ratings: Array<ReturnType<typeof makeRating>>
  moduleName?: string
  existingMetrics?: Record<string, any>
}) {
  supabase.responseQueue.push({ data: opts.criteria, error: null })
  supabase.responseQueue.push({ data: opts.articles, error: null })
  supabase.responseQueue.push({ data: opts.ratings, error: null })
  supabase.responseQueue.push({ data: { id: 'mod-1', name: opts.moduleName ?? 'Top Stories' }, error: null })
  supabase.responseQueue.push({ data: { metrics: opts.existingMetrics ?? {} }, error: null })
  supabase.responseQueue.push({ data: null, error: null })
}

// ---------------------------------------------------------------------------
describe('ArticleModuleSelector.activateTopArticles', () => {
  it('happy path: sorts by total_score desc and activates top-N with rank 1..N', async () => {
    const a1 = makeArticle({ id: 'a1', post_id: 'p1' })
    const a2 = makeArticle({ id: 'a2', post_id: 'p2' })
    const a3 = makeArticle({ id: 'a3', post_id: 'p3' })
    pushActivateHappyPath({
      articles: [a1, a2, a3],
      ratings: [makeRating('p1', 10), makeRating('p2', 30), makeRating('p3', 20)],
      activatedCount: 3,
    })

    const result = await ArticleModuleSelector.activateTopArticles('issue-1', 'mod-1', 3)

    expect(result).toEqual({ success: true, activated: 3 })
    const activations = supabase.updateCalls.filter(c => c.payload.is_active === true)
    expect(activations.map(c => c.payload.rank)).toEqual([1, 2, 3])
    const upsert = supabase.upsertCalls.find(c => c.table === 'issue_article_modules')
    expect(upsert?.payload.article_ids).toEqual(['a2', 'a3', 'a1'])
  })

  it('skips minimum filtering when no enforced criteria are configured', async () => {
    pushActivateHappyPath({
      criteria: [], // no minimum-score criteria
      articles: [makeArticle({ id: 'a1', post_id: 'p1' })],
      ratings: [makeRating('p1', 5)],
      activatedCount: 1,
    })

    const result = await ArticleModuleSelector.activateTopArticles('issue-1', 'mod-1', 5)

    expect(result).toEqual({ success: true, activated: 1 })
  })

  it('AND logic: filters out articles failing any enforced minimum criterion', async () => {
    // Two criteria enforced with minimums of 3 each.
    // a1 passes both, a2 fails criteria_2_score, a3 fails criteria_1_score.
    pushActivateHappyPath({
      criteria: [
        { criteria_number: 1, minimum_score: 3, enforce_minimum: true, name: 'Relevance' },
        { criteria_number: 2, minimum_score: 3, enforce_minimum: true, name: 'Quality' },
      ],
      articles: [
        makeArticle({ id: 'a1', post_id: 'p1' }),
        makeArticle({ id: 'a2', post_id: 'p2' }),
        makeArticle({ id: 'a3', post_id: 'p3' }),
      ],
      ratings: [
        makeRating('p1', 10, { criteria_1_score: 5, criteria_2_score: 5 }), // pass
        makeRating('p2', 20, { criteria_1_score: 5, criteria_2_score: 1 }), // fail Quality
        makeRating('p3', 30, { criteria_1_score: 1, criteria_2_score: 5 }), // fail Relevance
      ],
      activatedCount: 1,
    })

    const result = await ArticleModuleSelector.activateTopArticles('issue-1', 'mod-1', 3)

    expect(result).toEqual({ success: true, activated: 1 })
    const upsert = supabase.upsertCalls.find(c => c.table === 'issue_article_modules')
    expect(upsert?.payload.article_ids).toEqual(['a1'])
  })

  it('treats null criterion score as failing (article filtered out)', async () => {
    pushActivateHappyPath({
      criteria: [
        { criteria_number: 1, minimum_score: 3, enforce_minimum: true, name: 'Relevance' },
      ],
      articles: [
        makeArticle({ id: 'a1', post_id: 'p1' }),
        makeArticle({ id: 'a2', post_id: 'p2' }),
      ],
      ratings: [
        makeRating('p1', 10, { criteria_1_score: 5 }),
        makeRating('p2', 20, { criteria_1_score: null }), // null counts as fail
      ],
      activatedCount: 1,
    })

    const result = await ArticleModuleSelector.activateTopArticles('issue-1', 'mod-1', 5)

    expect(result.activated).toBe(1)
    const upsert = supabase.upsertCalls.find(c => c.table === 'issue_article_modules')
    expect(upsert?.payload.article_ids).toEqual(['a1'])
  })

  it('insufficient candidates: returns success with skipped_reason and writes warning to issue.metrics', async () => {
    pushInsufficientCandidatesPath({
      criteria: [{ criteria_number: 1, minimum_score: 5, enforce_minimum: true, name: 'Relevance' }],
      articles: [makeArticle({ id: 'a1', post_id: 'p1' })],
      ratings: [makeRating('p1', 10, { criteria_1_score: 1 })], // score < min 5
    })

    const result = await ArticleModuleSelector.activateTopArticles('issue-1', 'mod-1', 3)

    expect(result.success).toBe(true)
    expect(result.activated).toBe(0)
    expect(result.skipped_reason).toMatch(/Relevance/)
    const metricsUpdate = supabase.updateCalls.find(
      c => c.table === 'publication_issues' && c.payload.metrics?.minimum_score_warnings,
    )
    expect(metricsUpdate).toBeDefined()
    expect(metricsUpdate?.payload.metrics.minimum_score_warnings[0]).toMatchObject({
      module_id: 'mod-1',
      module_name: 'Top Stories',
      total_articles: 1,
    })
  })

  it('insufficient candidates: preserves existing metrics warnings when appending', async () => {
    const existingWarning = { module_id: 'mod-other', module_name: 'Other', timestamp: 'earlier' }
    pushInsufficientCandidatesPath({
      criteria: [{ criteria_number: 1, minimum_score: 5, enforce_minimum: true, name: 'Quality' }],
      articles: [makeArticle({ id: 'a1', post_id: 'p1' })],
      ratings: [makeRating('p1', 10, { criteria_1_score: 1 })],
      existingMetrics: { minimum_score_warnings: [existingWarning] },
    })

    await ArticleModuleSelector.activateTopArticles('issue-1', 'mod-1', 3)

    const metricsUpdate = supabase.updateCalls.find(
      c => c.table === 'publication_issues' && c.payload.metrics?.minimum_score_warnings,
    )
    expect(metricsUpdate?.payload.metrics.minimum_score_warnings).toHaveLength(2)
    expect(metricsUpdate?.payload.metrics.minimum_score_warnings[0]).toMatchObject(existingWarning)
  })

  it('fewer eligible articles than limit: activates only what is available', async () => {
    pushActivateHappyPath({
      articles: [
        makeArticle({ id: 'a1', post_id: 'p1' }),
        makeArticle({ id: 'a2', post_id: 'p2' }),
      ],
      ratings: [makeRating('p1', 10), makeRating('p2', 20)],
      activatedCount: 2,
    })

    const result = await ArticleModuleSelector.activateTopArticles('issue-1', 'mod-1', 5)

    expect(result).toEqual({ success: true, activated: 2 })
    const activations = supabase.updateCalls.filter(c => c.payload.is_active === true)
    expect(activations).toHaveLength(2)
    expect(activations.map(c => c.payload.rank)).toEqual([1, 2])
  })

  it('returns activated=0 with success=true when the candidate fetch is empty (no articles, no minimums needed)', async () => {
    supabase.responseQueue.push({ data: [], error: null }) // no minimum criteria
    supabase.responseQueue.push({ data: [], error: null }) // no articles
    // No further DB calls — function returns early.

    const result = await ArticleModuleSelector.activateTopArticles('issue-1', 'mod-1', 3)

    expect(result).toEqual({ success: true, activated: 0 })
    expect(supabase.updateCalls).toHaveLength(0)
    expect(supabase.upsertCalls).toHaveLength(0)
  })

  it('candidate fetch applies fact_check_score >= 4, skipped=false, and non-null headline/content filters', async () => {
    pushActivateHappyPath({
      articles: [makeArticle({ id: 'a1', post_id: 'p1' })],
      ratings: [makeRating('p1', 10)],
      activatedCount: 1,
    })

    await ArticleModuleSelector.activateTopArticles('issue-1', 'mod-1', 3)

    const moduleArticlesQuery = supabase.fromCalls.find(c => c.table === 'module_articles')
    expect(moduleArticlesQuery).toBeDefined()
    // Filter assertions: skipped=false guard is the regression risk.
    expect(moduleArticlesQuery?.eqCalls).toContainEqual(['issue_id', 'issue-1'])
    expect(moduleArticlesQuery?.eqCalls).toContainEqual(['article_module_id', 'mod-1'])
    expect(moduleArticlesQuery?.eqCalls).toContainEqual(['skipped', false])
  })

  it('queries criteria scoped to the requested module (tenant/scope filter regression guard)', async () => {
    pushActivateHappyPath({
      articles: [makeArticle({ id: 'a1', post_id: 'p1' })],
      ratings: [makeRating('p1', 10)],
      activatedCount: 1,
    })

    await ArticleModuleSelector.activateTopArticles('issue-1', 'mod-XYZ', 3)

    const criteriaQuery = supabase.fromCalls.find(c => c.table === 'article_module_criteria')
    expect(criteriaQuery?.eqCalls).toContainEqual(['article_module_id', 'mod-XYZ'])
    expect(criteriaQuery?.eqCalls).toContainEqual(['enforce_minimum', true])
  })

  it('locks current behavior: criteria-fetch error silently disables minimum-score enforcement (fails open)', async () => {
    // SUT logs the error and proceeds with minimumFilters = [], so all
    // articles are eligible regardless of score. If a future change flips
    // this to fail-closed (e.g. throws or returns activated=0), this test
    // forces a deliberate decision.
    supabase.responseQueue.push({ data: null, error: { message: 'criteria fetch boom' } })
    supabase.responseQueue.push({
      data: [makeArticle({ id: 'a1', post_id: 'p1' })],
      error: null,
    })
    supabase.responseQueue.push({
      data: [makeRating('p1', 10, { criteria_1_score: 0 })], // score 0 — would fail any minimum
      error: null,
    })
    supabase.responseQueue.push({ data: null, error: null }) // deactivate
    supabase.responseQueue.push({ data: null, error: null }) // activate
    supabase.responseQueue.push({ data: null, error: null }) // upsert

    const result = await ArticleModuleSelector.activateTopArticles('issue-1', 'mod-1', 3)

    expect(result).toEqual({ success: true, activated: 1 })
    const upsert = supabase.upsertCalls.find(c => c.table === 'issue_article_modules')
    expect(upsert?.payload.article_ids).toEqual(['a1'])
  })

  it('locks current behavior: equal total_score preserves DB order', async () => {
    // a1, a2, a3 all have score 10. With stable sort, the DB order is preserved.
    pushActivateHappyPath({
      articles: [
        makeArticle({ id: 'a1', post_id: 'p1' }),
        makeArticle({ id: 'a2', post_id: 'p2' }),
        makeArticle({ id: 'a3', post_id: 'p3' }),
      ],
      ratings: [makeRating('p1', 10), makeRating('p2', 10), makeRating('p3', 10)],
      activatedCount: 3,
    })

    await ArticleModuleSelector.activateTopArticles('issue-1', 'mod-1', 3)

    const upsert = supabase.upsertCalls.find(c => c.table === 'issue_article_modules')
    // Locks the current contract: equal scores keep DB order. If sort behavior
    // changes (e.g. tie-break by id), this test forces a deliberate update.
    expect(upsert?.payload.article_ids).toEqual(['a1', 'a2', 'a3'])
  })
})

describe('ArticleModuleSelector.manuallySelectArticles', () => {
  it('deactivates all then activates the specified ids in given rank order', async () => {
    // 1. deactivate-all UPDATE
    supabase.responseQueue.push({ data: null, error: null })
    // 2. activate UPDATE × 2
    supabase.responseQueue.push({ data: null, error: null })
    supabase.responseQueue.push({ data: null, error: null })
    // 3. updateArticleSelections upsert
    supabase.responseQueue.push({ data: null, error: null })

    const result = await ArticleModuleSelector.manuallySelectArticles(
      'issue-1',
      'mod-1',
      ['art-pick-1', 'art-pick-2'],
    )

    expect(result).toEqual({ success: true })
    const deactivate = supabase.updateCalls[0]
    expect(deactivate.payload).toMatchObject({ is_active: false, rank: null })
    const activations = supabase.updateCalls.slice(1)
    expect(activations).toHaveLength(2)
    expect(activations[0].payload).toMatchObject({ is_active: true, rank: 1 })
    expect(activations[1].payload).toMatchObject({ is_active: true, rank: 2 })
    const upsert = supabase.upsertCalls.find(c => c.table === 'issue_article_modules')
    expect(upsert?.payload.article_ids).toEqual(['art-pick-1', 'art-pick-2'])
  })
})
