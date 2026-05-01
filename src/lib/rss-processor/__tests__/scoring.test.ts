import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// =============================================================================
// Hoisted mock state — see article-selector.test.ts for the canonical template.
// Strict variant (post-#63 gate-review): from() throws on empty queue so silent
// extra DB calls surface as immediate failures.
// =============================================================================

type SupaResponse = { data: any; error: any }

const supabase = vi.hoisted(() => ({
  responseQueue: [] as SupaResponse[],
  fromCalls: [] as Array<{
    table: string
    eqCalls: Array<[string, any]>
    orderCalls: Array<[string, any]>
  }>,
  insertCalls: [] as Array<{ table: string; payload: any }>,
}))

function makeSupaChain(
  table: string,
  response: SupaResponse,
  eqCalls: Array<[string, any]>,
  orderCalls: Array<[string, any]>,
): any {
  const chain: any = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn((col: string, val: any) => {
    eqCalls.push([col, val])
    return chain
  })
  chain.in = vi.fn(() => chain)
  chain.order = vi.fn((col: string, opts?: any) => {
    orderCalls.push([col, opts])
    return chain
  })
  chain.limit = vi.fn(() => chain)
  chain.single = vi.fn(() => Promise.resolve(response))
  chain.maybeSingle = vi.fn(() => Promise.resolve(response))
  chain.insert = vi.fn((payload: any) => {
    supabase.insertCalls.push({ table, payload })
    return chain
  })
  // Awaiting the chain (without .single()) resolves to the queued response.
  // Required for queries that end with .order() or .limit().
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(response).then(resolve, reject)
  return chain
}

vi.mock('../../supabase', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      const response = supabase.responseQueue.shift()
      if (!response) {
        throw new Error(
          `[test] Unexpected supabaseAdmin.from('${table}') — add a response to the queue`,
        )
      }
      const eqCalls: Array<[string, any]> = []
      const orderCalls: Array<[string, any]> = []
      supabase.fromCalls.push({ table, eqCalls, orderCalls })
      return makeSupaChain(table, response, eqCalls, orderCalls)
    }),
  },
}))

const mockCallWithStructuredPrompt = vi.hoisted(() => vi.fn())

vi.mock('../../openai', () => ({
  callWithStructuredPrompt: mockCallWithStructuredPrompt,
}))

vi.mock('../shared-context', () => ({
  getNewsletterIdFromIssue: vi.fn().mockResolvedValue('pub-1'),
}))

import { Scoring } from '../scoring'

// =============================================================================
// Fixtures
// =============================================================================

function makeCriterion(overrides: Record<string, any> = {}) {
  return {
    criteria_number: 1,
    name: 'Interest',
    weight: 5,
    ai_prompt: JSON.stringify({ model: 'gpt-4o' }),
    is_active: true,
    enforce_minimum: false,
    minimum_score: null,
    evaluation_order: 1,
    ...overrides,
  }
}

function makePost(overrides: Record<string, any> = {}) {
  return {
    id: 'post-1',
    title: 'Sample post',
    description: 'desc',
    content: 'content',
    full_article_text: 'full text',
    feed_id: 'feed-1',
    issue_id: 'issue-1',
    ...overrides,
  } as any
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})

  supabase.responseQueue.length = 0
  supabase.fromCalls.length = 0
  supabase.insertCalls.length = 0
  mockCallWithStructuredPrompt.mockReset()
})

afterEach(() => {
  expect(supabase.responseQueue).toHaveLength(0)
  vi.restoreAllMocks()
})

// =============================================================================
// evaluatePost — high-value method
// =============================================================================

describe('Scoring.evaluatePost', () => {
  it('happy path with single criterion: weighted total, criteria_scores, legacy field mapping', async () => {
    supabase.responseQueue.push({
      data: [makeCriterion({ weight: 5 })],
      error: null,
    })
    mockCallWithStructuredPrompt.mockResolvedValueOnce({ score: 8, reason: 'good' })

    const result = await new Scoring().evaluatePost(makePost(), 'pub-1', 'primary', 'mod-1')

    expect(mockCallWithStructuredPrompt).toHaveBeenCalledTimes(1)
    expect(result.total_score).toBe(40) // 8 * 5
    expect(result.criteria_scores).toEqual([
      { score: 8, reason: 'good', weight: 5, criteria_number: 1 },
    ])
    expect(result.interest_level).toBe(8)
    expect(result.local_relevance).toBe(0)
    expect(result.community_impact).toBe(0)
    expect(result.reasoning).toBe('Interest: good')

    // Lock the criteria fetch ordering — evaluation_order then criteria_number.
    expect(supabase.fromCalls[0].table).toBe('article_module_criteria')
    expect(supabase.fromCalls[0].eqCalls).toEqual([
      ['article_module_id', 'mod-1'],
      ['is_active', true],
    ])
    expect(supabase.fromCalls[0].orderCalls).toEqual([
      ['evaluation_order', { ascending: true }],
      ['criteria_number', { ascending: true }],
    ])
  })

  it('multiple criteria: weighted sum across all evaluated criteria; legacy fields = first 3 scores', async () => {
    supabase.responseQueue.push({
      data: [
        makeCriterion({ criteria_number: 1, name: 'A', weight: 1 }),
        makeCriterion({ criteria_number: 2, name: 'B', weight: 2 }),
        makeCriterion({ criteria_number: 3, name: 'C', weight: 3 }),
      ],
      error: null,
    })
    mockCallWithStructuredPrompt
      .mockResolvedValueOnce({ score: 5, reason: 'r1' })
      .mockResolvedValueOnce({ score: 6, reason: 'r2' })
      .mockResolvedValueOnce({ score: 7, reason: 'r3' })

    const result = await new Scoring().evaluatePost(makePost(), 'pub-1', 'primary', 'mod-1')

    expect(mockCallWithStructuredPrompt).toHaveBeenCalledTimes(3)
    expect(result.total_score).toBe(5 * 1 + 6 * 2 + 7 * 3) // 38
    expect(result.criteria_scores).toHaveLength(3)
    expect(result.interest_level).toBe(5)
    expect(result.local_relevance).toBe(6)
    expect(result.community_impact).toBe(7)
    expect(result.reasoning).toBe('A: r1\n\nB: r2\n\nC: r3')
  })

  it('provider auto-detect: claude model name routes to claude provider, others to openai', async () => {
    supabase.responseQueue.push({
      data: [
        makeCriterion({
          criteria_number: 1,
          ai_prompt: JSON.stringify({ model: 'claude-sonnet-4-6' }),
        }),
      ],
      error: null,
    })
    mockCallWithStructuredPrompt.mockResolvedValueOnce({ score: 5, reason: '' })

    await new Scoring().evaluatePost(makePost(), 'pub-1', 'primary', 'mod-1')

    const args = mockCallWithStructuredPrompt.mock.calls[0]
    expect(args[2]).toBe('claude') // provider arg

    // Now the openai branch.
    supabase.responseQueue.push({
      data: [makeCriterion({ ai_prompt: JSON.stringify({ model: 'gpt-4o' }) })],
      error: null,
    })
    mockCallWithStructuredPrompt.mockResolvedValueOnce({ score: 5, reason: '' })
    await new Scoring().evaluatePost(makePost(), 'pub-1', 'primary', 'mod-1')
    expect(mockCallWithStructuredPrompt.mock.calls[1][2]).toBe('openai')
  })

  it('{{company_name}} placeholder: ticker uppercased, looked up via ticker_company_names; falls back to "" when no mapping', async () => {
    supabase.responseQueue.push({ data: [makeCriterion()], error: null })
    supabase.responseQueue.push({
      data: { company_name: 'Acme Corp' },
      error: null,
    })
    mockCallWithStructuredPrompt.mockResolvedValueOnce({ score: 5, reason: '' })

    await new Scoring().evaluatePost(makePost({ ticker: 'acme' }), 'pub-1', 'primary', 'mod-1')

    expect(supabase.fromCalls[1].table).toBe('ticker_company_names')
    expect(supabase.fromCalls[1].eqCalls).toEqual([['ticker', 'ACME']])
    expect(mockCallWithStructuredPrompt.mock.calls[0][1].company_name).toBe('Acme Corp')

    // No-mapping fallback: ticker present but lookup returns null.
    supabase.responseQueue.push({ data: [makeCriterion()], error: null })
    supabase.responseQueue.push({ data: null, error: null })
    mockCallWithStructuredPrompt.mockResolvedValueOnce({ score: 5, reason: '' })
    await new Scoring().evaluatePost(makePost({ ticker: 'XYZ' }), 'pub-1', 'primary', 'mod-1')
    expect(mockCallWithStructuredPrompt.mock.calls[1][1].company_name).toBe('')

    // No ticker: ticker_company_names is NOT queried (strict mock asserts this).
    supabase.responseQueue.push({ data: [makeCriterion()], error: null })
    mockCallWithStructuredPrompt.mockResolvedValueOnce({ score: 5, reason: '' })
    await new Scoring().evaluatePost(makePost(), 'pub-1', 'primary', 'mod-1')
    expect(mockCallWithStructuredPrompt.mock.calls[2][1].company_name).toBe('')
  })

  it.each([
    { input: 'Sale (Partial)', expected: 'Sale' },
    { input: 'Purchase (Partial)', expected: 'Purchase' }, // verifies partial-handling claim
    { input: 'PURCHASE', expected: 'Purchase' },
    { input: null, expected: '' },
  ])('{{transaction_type}}: $input → $expected (real normalizeTransactionType)', async ({ input, expected }) => {
    supabase.responseQueue.push({ data: [makeCriterion()], error: null })
    mockCallWithStructuredPrompt.mockResolvedValueOnce({ score: 5, reason: '' })
    await new Scoring().evaluatePost(
      makePost({ transaction_type: input }),
      'pub-1', 'primary', 'mod-1',
    )
    expect(mockCallWithStructuredPrompt.mock.calls[0][1].transaction_type).toBe(expected)
  })

  it('early termination: enforce_minimum=true and score < minimum_score skips remaining criteria', async () => {
    supabase.responseQueue.push({
      data: [
        makeCriterion({
          criteria_number: 1, weight: 4,
          enforce_minimum: true, minimum_score: 5,
        }),
        makeCriterion({ criteria_number: 2, weight: 3 }),
        makeCriterion({ criteria_number: 3, weight: 2 }),
      ],
      error: null,
    })
    mockCallWithStructuredPrompt.mockResolvedValueOnce({ score: 4, reason: 'below min' })
    // Criteria 2 & 3 must NOT be called — no further mockResolvedValueOnce queued.

    const result = await new Scoring().evaluatePost(makePost(), 'pub-1', 'primary', 'mod-1')

    expect(mockCallWithStructuredPrompt).toHaveBeenCalledTimes(1)
    expect(result.criteria_scores).toHaveLength(1)
    expect(result.total_score).toBe(4 * 4) // weighted sum over evaluated criteria only
  })

  it('no early termination when enforce_minimum=false (even if minimum_score is set)', async () => {
    supabase.responseQueue.push({
      data: [
        makeCriterion({
          criteria_number: 1, weight: 1,
          enforce_minimum: false, minimum_score: 5,
        }),
        makeCriterion({ criteria_number: 2, weight: 1 }),
      ],
      error: null,
    })
    mockCallWithStructuredPrompt
      .mockResolvedValueOnce({ score: 1, reason: '' })
      .mockResolvedValueOnce({ score: 2, reason: '' })

    const result = await new Scoring().evaluatePost(makePost(), 'pub-1', 'primary', 'mod-1')

    expect(mockCallWithStructuredPrompt).toHaveBeenCalledTimes(2)
    expect(result.criteria_scores).toHaveLength(2)
  })

  it('throws when moduleId is missing', async () => {
    await expect(
      new Scoring().evaluatePost(makePost(), 'pub-1', 'primary'),
    ).rejects.toThrow(/moduleId is required for scoring/)
    // Strict mock asserts no DB call was made.
    expect(supabase.fromCalls).toHaveLength(0)
  })

  it('throws when criteria fetch returns DB error', async () => {
    supabase.responseQueue.push({ data: null, error: { message: 'boom' } })
    await expect(
      new Scoring().evaluatePost(makePost(), 'pub-1', 'primary', 'mod-1'),
    ).rejects.toThrow(/Failed to fetch criteria for mod/)
  })

  it('throws when no active criteria are found', async () => {
    supabase.responseQueue.push({ data: [], error: null })
    await expect(
      new Scoring().evaluatePost(makePost(), 'pub-1', 'primary', 'mod-1'),
    ).rejects.toThrow(/No active criteria found for mod/)
  })

  it('throws when a criterion has no ai_prompt configured', async () => {
    supabase.responseQueue.push({
      data: [makeCriterion({ ai_prompt: null })],
      error: null,
    })
    await expect(
      new Scoring().evaluatePost(makePost(), 'pub-1', 'primary', 'mod-1'),
    ).rejects.toThrow(/has no ai_prompt configured/)
  })

  it('throws when AI returns non-object response', async () => {
    supabase.responseQueue.push({ data: [makeCriterion()], error: null })
    mockCallWithStructuredPrompt.mockResolvedValueOnce('hello' as any)
    await expect(
      new Scoring().evaluatePost(makePost(), 'pub-1', 'primary', 'mod-1'),
    ).rejects.toThrow(/Invalid AI response type/)
  })

  it.each([
    { score: -1, label: 'below 0' },
    { score: 11, label: 'above 10' },
    { score: '5' as any, label: 'non-number string' },
    { score: NaN, label: 'NaN' },
  ])('throws when AI score is $label ($score)', async ({ score }) => {
    supabase.responseQueue.push({ data: [makeCriterion()], error: null })
    mockCallWithStructuredPrompt.mockResolvedValueOnce({ score, reason: '' })
    await expect(
      new Scoring().evaluatePost(makePost(), 'pub-1', 'primary', 'mod-1'),
    ).rejects.toThrow(/score must be between 0-10/)
  })
})

// =============================================================================
// scorePostsForSection — orchestration around evaluatePost
// =============================================================================

describe('Scoring.scorePostsForSection', () => {
  it('returns {scored:0, errors:0} when no active feeds match the section', async () => {
    supabase.responseQueue.push({ data: [], error: null })

    const result = await new Scoring().scorePostsForSection('issue-1', 'primary')

    expect(result).toEqual({ scored: 0, errors: 0 })
    expect(supabase.fromCalls).toHaveLength(1)
    expect(supabase.fromCalls[0].table).toBe('rss_feeds')
    expect(supabase.insertCalls).toHaveLength(0)
  })

  it('section filter: primary uses use_for_primary_section, secondary uses use_for_secondary_section', async () => {
    // primary
    supabase.responseQueue.push({ data: [], error: null })
    await new Scoring().scorePostsForSection('issue-1', 'primary')
    expect(supabase.fromCalls[0].eqCalls).toEqual([
      ['active', true],
      ['use_for_primary_section', true],
    ])

    // secondary
    supabase.responseQueue.push({ data: [], error: null })
    await new Scoring().scorePostsForSection('issue-1', 'secondary')
    expect(supabase.fromCalls[1].eqCalls).toEqual([
      ['active', true],
      ['use_for_secondary_section', true],
    ])
  })

  it('inserts a post_ratings row with the expected shape when evaluatePost succeeds', async () => {
    supabase.responseQueue.push({ data: [{ id: 'feed-1' }], error: null }) // feeds
    supabase.responseQueue.push({ data: [makePost({ id: 'p-1' })], error: null }) // posts
    supabase.responseQueue.push({ data: null, error: null }) // post_ratings.insert

    const scoring = new Scoring()
    vi.spyOn(scoring, 'evaluatePost').mockResolvedValue({
      interest_level: 7,
      local_relevance: 8,
      community_impact: 9,
      reasoning: 'r',
      criteria_scores: [
        { score: 7, reason: 'a', weight: 1, criteria_number: 1 },
        { score: 8, reason: 'b', weight: 2, criteria_number: 2 },
      ],
      total_score: 99,
    })

    const result = await scoring.scorePostsForSection('issue-1', 'primary')

    expect(result).toEqual({ scored: 1, errors: 0 })

    const insert = supabase.insertCalls.find(c => c.table === 'post_ratings')
    expect(insert).toBeDefined()
    const payload = insert!.payload[0]
    expect(payload.post_id).toBe('p-1')
    expect(payload.interest_level).toBe(7)
    expect(payload.local_relevance).toBe(8)
    expect(payload.community_impact).toBe(9)
    expect(payload.ai_reasoning).toBe('r')
    expect(payload.total_score).toBe(99) // explicit total_score wins over fallback
    expect(payload.criteria_1_score).toBe(7)
    expect(payload.criteria_1_reason).toBe('a')
    expect(payload.criteria_1_weight).toBe(1)
    expect(payload.criteria_2_score).toBe(8)
    expect(payload.criteria_2_reason).toBe('b')
    expect(payload.criteria_2_weight).toBe(2)
  })

  it('total_score fallback when evaluation.total_score is absent: (interest+local+community)/30 * 100', async () => {
    supabase.responseQueue.push({ data: [{ id: 'feed-1' }], error: null })
    supabase.responseQueue.push({ data: [makePost()], error: null })
    supabase.responseQueue.push({ data: null, error: null })

    const scoring = new Scoring()
    vi.spyOn(scoring, 'evaluatePost').mockResolvedValue({
      interest_level: 6,
      local_relevance: 6,
      community_impact: 6,
      reasoning: 'r',
      criteria_scores: [],
      // total_score intentionally absent
    })

    await scoring.scorePostsForSection('issue-1', 'primary')

    const payload = supabase.insertCalls[0].payload[0]
    // (6 + 6 + 6) / 30 * 100 = 60
    expect(payload.total_score).toBe(60)
  })

  it('passes post.article_module_id through to evaluatePost', async () => {
    supabase.responseQueue.push({ data: [{ id: 'feed-1' }], error: null }) // feeds
    supabase.responseQueue.push({
      data: [
        makePost({ id: 'p-1', article_module_id: 'mod-1' }),
        makePost({ id: 'p-2', article_module_id: 'mod-1' }),
      ],
      error: null,
    })

    const scoring = new Scoring()
    const evalSpy = vi.spyOn(scoring, 'evaluatePost').mockResolvedValue({
      interest_level: 5,
      local_relevance: 5,
      community_impact: 5,
      reasoning: 'r',
      criteria_scores: [{ score: 5, reason: 'r', weight: 1, criteria_number: 1 }],
      total_score: 50,
    })

    // Each successful evaluation triggers a post_ratings insert.
    supabase.responseQueue.push({ data: null, error: null })
    supabase.responseQueue.push({ data: null, error: null })

    const result = await scoring.scorePostsForSection('issue-1', 'primary')

    expect(result).toEqual({ scored: 2, errors: 0 })
    expect(evalSpy).toHaveBeenCalledTimes(2)
    // Fourth arg is moduleId — verify it came from the post.
    expect(evalSpy.mock.calls[0][3]).toBe('mod-1')
    expect(evalSpy.mock.calls[1][3]).toBe('mod-1')
  })

  it('errors out gracefully when post.article_module_id is null', async () => {
    // The existing guard at scoring.ts:121 throws when moduleId is missing.
    // scorePostsForSection catches this, increments errorCount, and continues.
    // Locks the no-module fallback shape — posts without module assignment
    // are surfaced as errors rather than crashing the whole batch.
    supabase.responseQueue.push({ data: [{ id: 'feed-1' }], error: null })
    supabase.responseQueue.push({
      data: [
        makePost({ id: 'p-1', article_module_id: null }),
        makePost({ id: 'p-2', article_module_id: null }),
      ],
      error: null,
    })
    // No further DB responses — evaluatePost throws on missing moduleId
    // before any from() call.

    const result = await new Scoring().scorePostsForSection('issue-1', 'primary')

    expect(result).toEqual({ scored: 0, errors: 2 })
    expect(supabase.insertCalls).toHaveLength(0)
  })
})
