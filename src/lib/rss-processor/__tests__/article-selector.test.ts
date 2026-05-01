import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

type SupaResponse = { data: any; error: any }
const supabase = vi.hoisted(() => ({
  responseQueue: [] as SupaResponse[],
  fromCalls: [] as Array<{ table: string; eqCalls: Array<[string, any]> }>,
  updateCalls: [] as Array<{ table: string; payload: any }>,
}))

function makeSupaChain(table: string, response: SupaResponse, eqCalls: Array<[string, any]>): any {
  const chain: any = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn((col: string, val: any) => {
    eqCalls.push([col, val])
    return chain
  })
  chain.single = vi.fn(() => Promise.resolve(response))
  chain.update = vi.fn((payload: any) => {
    supabase.updateCalls.push({ table, payload })
    return chain
  })
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(response).then(resolve, reject)
  return chain
}

vi.mock('../../supabase', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      const response = supabase.responseQueue.shift() ?? { data: null, error: null }
      const eqCalls: Array<[string, any]> = []
      supabase.fromCalls.push({ table, eqCalls })
      return makeSupaChain(table, response, eqCalls)
    }),
  },
}))

const mockSubjectLineGenerator = vi.hoisted(() => vi.fn())

vi.mock('../../openai', () => ({
  AI_CALL: {
    subjectLineGenerator: mockSubjectLineGenerator,
  },
}))

vi.mock('../shared-context', () => ({
  getNewsletterIdFromIssue: vi.fn().mockResolvedValue('pub-1'),
}))

import { ArticleSelector } from '../article-selector'

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})

  supabase.responseQueue.length = 0
  supabase.fromCalls.length = 0
  supabase.updateCalls.length = 0
  mockSubjectLineGenerator.mockReset()
})

afterEach(() => {
  expect(supabase.responseQueue).toHaveLength(0)
  vi.restoreAllMocks()
})

function makeIssueWithArticles(overrides: Record<string, any> = {}) {
  return {
    id: 'issue-1',
    date: '2026-05-15',
    status: 'in_review',
    subject_line: null,
    module_articles: [
      {
        headline: 'Top story',
        content: 'Top story body',
        is_active: true,
        rss_post: { post_rating: [{ total_score: 90 }] },
      },
      {
        headline: 'Lower story',
        content: 'Lower body',
        is_active: true,
        rss_post: { post_rating: [{ total_score: 50 }] },
      },
    ],
    ...overrides,
  }
}

describe('ArticleSelector.generateSubjectLineForIssue', () => {
  it('happy path: picks the highest-scoring active article, calls AI, writes subject_line', async () => {
    supabase.responseQueue.push({ data: makeIssueWithArticles(), error: null })
    supabase.responseQueue.push({ data: null, error: null }) // UPDATE succeeds
    mockSubjectLineGenerator.mockResolvedValue('Generated Subject!')

    await new ArticleSelector().generateSubjectLineForIssue('issue-1')

    // AI called exactly once with the top-scored article (total_score 90).
    expect(mockSubjectLineGenerator).toHaveBeenCalledTimes(1)
    const [topArticle] = mockSubjectLineGenerator.mock.calls[0]
    expect(topArticle.headline).toBe('Top story')
    // publication_issues UPDATE happened with the generated subject.
    const update = supabase.updateCalls.find(c => c.table === 'publication_issues')
    expect(update?.payload.subject_line).toBe('Generated Subject!')
  })

  it('skips AI call and DB update when subject_line is already set', async () => {
    supabase.responseQueue.push({
      data: makeIssueWithArticles({ subject_line: 'Already set' }),
      error: null,
    })

    await new ArticleSelector().generateSubjectLineForIssue('issue-1')

    expect(mockSubjectLineGenerator).not.toHaveBeenCalled()
    expect(supabase.updateCalls).toHaveLength(0)
  })

  it('skips AI call and DB update when no module_articles are active', async () => {
    supabase.responseQueue.push({
      data: makeIssueWithArticles({
        module_articles: [
          { headline: 'h', content: 'c', is_active: false, rss_post: null },
        ],
      }),
      error: null,
    })

    await new ArticleSelector().generateSubjectLineForIssue('issue-1')

    expect(mockSubjectLineGenerator).not.toHaveBeenCalled()
    expect(supabase.updateCalls).toHaveLength(0)
  })

  it('does NOT update publication_issues when AI returns an empty string (error is swallowed)', async () => {
    supabase.responseQueue.push({ data: makeIssueWithArticles(), error: null })
    mockSubjectLineGenerator.mockResolvedValue('   ')

    // The function catches its own errors and returns void; no .rejects assertion possible.
    await new ArticleSelector().generateSubjectLineForIssue('issue-1')

    expect(mockSubjectLineGenerator).toHaveBeenCalledTimes(1)
    expect(supabase.updateCalls).toHaveLength(0)
  })
})
