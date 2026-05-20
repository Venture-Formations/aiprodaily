import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
const mockSingle = vi.fn()
const mockMaybeSingle = vi.fn()
let mockChainResult: { data: any; error: any } = { data: null, error: null }

const mockChain: Record<string, any> = {
  select: vi.fn(function (this: any) { return mockChain }),
  insert: vi.fn(function () { return mockChain }),
  update: vi.fn(function () { return mockChain }),
  delete: vi.fn(function () { return mockChain }),
  eq: vi.fn(function () { return mockChain }),
  neq: vi.fn(function () { return mockChain }),
  in: vi.fn(function () { return mockChain }),
  is: vi.fn(function () { return mockChain }),
  not: vi.fn(function () { return mockChain }),
  like: vi.fn(function () { return mockChain }),
  gte: vi.fn(function () { return mockChain }),
  lte: vi.fn(function () { return mockChain }),
  order: vi.fn(function () { return mockChain }),
  limit: vi.fn(function () { return mockChain }),
  range: vi.fn(function () { return Promise.resolve(mockChainResult) }),
  single: mockSingle,
  maybeSingle: mockMaybeSingle,
  then: function (onFulfilled: any) {
    return Promise.resolve(mockChainResult).then(onFulfilled)
  },
}

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => mockChain),
  },
}))

vi.mock('@/lib/logger', () => {
  const log = {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    correlationId: 'test-id',
  }
  return { createLogger: vi.fn(() => log) }
})

import {
  listModuleArticlesByIssue,
  moduleArticleExists,
  listArticlesNeedingBody,
  listArticlesNeedingFactCheck,
  insertModuleArticle,
  updateModuleArticleContent,
  updateModuleArticleFactCheck,
  listManualArticlesByPublication,
  findNextAvailableSlug,
  insertManualArticle,
  updateManualArticle,
  deleteManualArticle,
  listRecentlyFeaturedTickers,
} from '../articles'

beforeEach(() => {
  vi.clearAllMocks()
  mockChainResult = { data: null, error: null }
  mockChain.select.mockReturnValue(mockChain)
  mockChain.insert.mockReturnValue(mockChain)
  mockChain.update.mockReturnValue(mockChain)
  mockChain.delete.mockReturnValue(mockChain)
  mockChain.eq.mockReturnValue(mockChain)
  mockChain.neq.mockReturnValue(mockChain)
  mockChain.in.mockReturnValue(mockChain)
  mockChain.is.mockReturnValue(mockChain)
  mockChain.not.mockReturnValue(mockChain)
  mockChain.like.mockReturnValue(mockChain)
  mockChain.gte.mockReturnValue(mockChain)
  mockChain.lte.mockReturnValue(mockChain)
  mockChain.order.mockReturnValue(mockChain)
  mockChain.limit.mockReturnValue(mockChain)
})

// ---------------------------------------------------------------------------
describe('listModuleArticlesByIssue', () => {
  it('lists articles for an issue', async () => {
    mockChainResult = { data: [{ id: 'a1' }, { id: 'a2' }], error: null }
    const result = await listModuleArticlesByIssue('issue-1')
    expect(result).toHaveLength(2)
    expect(mockChain.eq).toHaveBeenCalledWith('issue_id', 'issue-1')
  })

  it('applies activeOnly + moduleId filters', async () => {
    mockChainResult = { data: [], error: null }
    await listModuleArticlesByIssue('issue-1', { moduleId: 'mod-1', activeOnly: true })
    expect(mockChain.eq).toHaveBeenCalledWith('article_module_id', 'mod-1')
    expect(mockChain.eq).toHaveBeenCalledWith('is_active', true)
  })

  it('uses lighter column shape for idsOnly', async () => {
    mockChainResult = { data: [], error: null }
    await listModuleArticlesByIssue('issue-1', { idsOnly: true })
    expect(mockChain.select).toHaveBeenCalledWith('id')
  })

  it('uses post_id column shape for postIdsOnly', async () => {
    mockChainResult = { data: [], error: null }
    await listModuleArticlesByIssue('issue-1', { postIdsOnly: true })
    expect(mockChain.select).toHaveBeenCalledWith('post_id')
  })

  it('returns [] on error', async () => {
    mockChainResult = { data: null, error: { message: 'fail' } }
    const result = await listModuleArticlesByIssue('issue-1')
    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------
describe('moduleArticleExists', () => {
  it('returns true when row exists', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'a1' }, error: null })
    const exists = await moduleArticleExists('p1', 'issue-1', 'mod-1')
    expect(exists).toBe(true)
  })

  it('returns false when no row', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const exists = await moduleArticleExists('p1', 'issue-1', 'mod-1')
    expect(exists).toBe(false)
  })

  it('returns false on error', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'fail' } })
    const exists = await moduleArticleExists('p1', 'issue-1', 'mod-1')
    expect(exists).toBe(false)
  })
})

// ---------------------------------------------------------------------------
describe('listArticlesNeedingBody', () => {
  it('applies content==="" + headline NOT NULL filters and limit', async () => {
    mockChainResult = { data: [], error: null }
    await listArticlesNeedingBody('issue-1', 'mod-1', 5)
    expect(mockChain.eq).toHaveBeenCalledWith('content', '')
    expect(mockChain.not).toHaveBeenCalledWith('headline', 'is', null)
    expect(mockChain.order).toHaveBeenCalledWith('post_id', { ascending: true })
    expect(mockChain.limit).toHaveBeenCalledWith(5)
  })
})

// ---------------------------------------------------------------------------
describe('listArticlesNeedingFactCheck', () => {
  it('applies content!="" + content NOT NULL + fact_check_score IS NULL', async () => {
    mockChainResult = { data: [], error: null }
    await listArticlesNeedingFactCheck('issue-1', 'mod-1')
    expect(mockChain.neq).toHaveBeenCalledWith('content', '')
    expect(mockChain.not).toHaveBeenCalledWith('content', 'is', null)
    expect(mockChain.is).toHaveBeenCalledWith('fact_check_score', null)
  })
})

// ---------------------------------------------------------------------------
describe('insertModuleArticle', () => {
  it('returns ok=true on success', async () => {
    mockChainResult = { data: null, error: null }
    const result = await insertModuleArticle({ post_id: 'p1', issue_id: 'i1', article_module_id: 'm1' })
    expect(result).toEqual({ ok: true, duplicate: false })
  })

  it('returns duplicate=true on 23505 (unique violation)', async () => {
    mockChainResult = { data: null, error: { code: '23505', message: 'duplicate key' } }
    const result = await insertModuleArticle({ post_id: 'p1', issue_id: 'i1', article_module_id: 'm1' })
    expect(result).toEqual({ ok: false, duplicate: true })
  })

  it('returns ok=false on other errors', async () => {
    mockChainResult = { data: null, error: { code: '99999', message: 'other' } }
    const result = await insertModuleArticle({ post_id: 'p1', issue_id: 'i1', article_module_id: 'm1' })
    expect(result).toEqual({ ok: false, duplicate: false })
  })
})

// ---------------------------------------------------------------------------
describe('updateModuleArticleContent', () => {
  it('updates content + word_count', async () => {
    mockChainResult = { data: null, error: null }
    const ok = await updateModuleArticleContent('a1', { content: 'body', wordCount: 42 })
    expect(ok).toBe(true)
    expect(mockChain.update).toHaveBeenCalledWith({ content: 'body', word_count: 42 })
  })

  it('returns false on error', async () => {
    mockChainResult = { data: null, error: { message: 'fail' } }
    const ok = await updateModuleArticleContent('a1', { content: 'body', wordCount: 42 })
    expect(ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
describe('updateModuleArticleFactCheck', () => {
  it('updates fact_check_score + fact_check_details', async () => {
    mockChainResult = { data: null, error: null }
    const ok = await updateModuleArticleFactCheck('a1', { score: 8, details: 'good' })
    expect(ok).toBe(true)
    expect(mockChain.update).toHaveBeenCalledWith({ fact_check_score: 8, fact_check_details: 'good' })
  })

  it('accepts null details', async () => {
    mockChainResult = { data: null, error: null }
    await updateModuleArticleFactCheck('a1', { score: 0, details: null })
    expect(mockChain.update).toHaveBeenCalledWith({ fact_check_score: 0, fact_check_details: null })
  })
})

// ---------------------------------------------------------------------------
describe('listManualArticlesByPublication', () => {
  it('filters by publication_id and orders by publish_date', async () => {
    mockChainResult = { data: [], error: null }
    await listManualArticlesByPublication('pub-1')
    expect(mockChain.eq).toHaveBeenCalledWith('publication_id', 'pub-1')
    expect(mockChain.order).toHaveBeenCalledWith('publish_date', { ascending: false })
  })

  it('applies status array via .in()', async () => {
    mockChainResult = { data: [], error: null }
    await listManualArticlesByPublication('pub-1', { status: ['draft', 'published'] })
    expect(mockChain.in).toHaveBeenCalledWith('status', ['draft', 'published'])
  })

  it('applies single status via .eq()', async () => {
    mockChainResult = { data: [], error: null }
    await listManualArticlesByPublication('pub-1', { status: 'used' })
    expect(mockChain.eq).toHaveBeenCalledWith('status', 'used')
  })
})

// ---------------------------------------------------------------------------
describe('findNextAvailableSlug', () => {
  it('returns base slug when no matching slugs exist', async () => {
    mockChainResult = { data: [], error: null }
    const slug = await findNextAvailableSlug('hello-world', 'pub-1')
    expect(slug).toBe('hello-world')
  })

  it('appends -2 when base slug is taken', async () => {
    mockChainResult = { data: [{ slug: 'hello-world' }], error: null }
    const slug = await findNextAvailableSlug('hello-world', 'pub-1')
    expect(slug).toBe('hello-world-2')
  })

  it('finds first free numbered slot when multiple are taken', async () => {
    mockChainResult = {
      data: [{ slug: 'topic' }, { slug: 'topic-2' }, { slug: 'topic-3' }],
      error: null,
    }
    const slug = await findNextAvailableSlug('topic', 'pub-1')
    expect(slug).toBe('topic-4')
  })

  it('finds gap in numbered sequence', async () => {
    mockChainResult = {
      data: [{ slug: 'topic' }, { slug: 'topic-3' }, { slug: 'topic-4' }],
      error: null,
    }
    const slug = await findNextAvailableSlug('topic', 'pub-1')
    expect(slug).toBe('topic-2')
  })

  it('uses LIKE filter on the base slug', async () => {
    mockChainResult = { data: [], error: null }
    await findNextAvailableSlug('hello-world', 'pub-1')
    expect(mockChain.like).toHaveBeenCalledWith('slug', 'hello-world%')
  })

  it('returns base slug on query error (best-effort fallback)', async () => {
    mockChainResult = { data: null, error: { message: 'fail' } }
    const slug = await findNextAvailableSlug('hello-world', 'pub-1')
    expect(slug).toBe('hello-world')
  })
})

// ---------------------------------------------------------------------------
describe('insertManualArticle', () => {
  it('returns inserted row on success', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'm1', title: 't', publication_id: 'pub-1' },
      error: null,
    })
    const result = await insertManualArticle({
      publication_id: 'pub-1',
      title: 't',
      slug: 't',
      body: 'body',
      image_url: null,
      section_type: 'primary_articles',
      category_id: null,
      publish_date: '2025-01-01',
      status: 'draft',
    })
    expect(result).not.toBeNull()
    expect(result?.id).toBe('m1')
  })

  it('returns null on error', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'fail' } })
    const result = await insertManualArticle({
      publication_id: 'pub-1',
      title: 't',
      slug: 't',
      body: 'body',
      image_url: null,
      section_type: 'primary_articles',
      category_id: null,
      publish_date: '2025-01-01',
      status: 'draft',
    })
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
describe('updateManualArticle', () => {
  it('enforces publicationId in WHERE clause', async () => {
    mockChainResult = { data: null, error: null }
    await updateManualArticle('m1', 'pub-1', { title: 'new' })
    expect(mockChain.eq).toHaveBeenCalledWith('id', 'm1')
    expect(mockChain.eq).toHaveBeenCalledWith('publication_id', 'pub-1')
  })

  it('returns false on error', async () => {
    mockChainResult = { data: null, error: { message: 'fail' } }
    const ok = await updateManualArticle('m1', 'pub-1', { title: 'new' })
    expect(ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
describe('deleteManualArticle', () => {
  it('enforces publicationId in WHERE clause', async () => {
    mockChainResult = { data: null, error: null }
    await deleteManualArticle('m1', 'pub-1')
    expect(mockChain.eq).toHaveBeenCalledWith('id', 'm1')
    expect(mockChain.eq).toHaveBeenCalledWith('publication_id', 'pub-1')
  })
})

// ---------------------------------------------------------------------------
describe('listRecentlyFeaturedTickers', () => {
  it('returns the distinct, upper-cased set of recent active tickers', async () => {
    mockChainResult = {
      data: [{ ticker: 'COR' }, { ticker: 'ibm' }, { ticker: 'COR' }],
      error: null,
    }
    const result = await listRecentlyFeaturedTickers('pub-1', '2026-05-20', 7, 'iss-cur')
    expect(result).toEqual(new Set(['COR', 'IBM']))
  })

  it('computes the cutoff date as issueDate minus cooldownDays', async () => {
    mockChainResult = { data: [], error: null }
    await listRecentlyFeaturedTickers('pub-1', '2026-05-20', 7, 'iss-cur')
    expect(mockChain.gte).toHaveBeenCalledWith('publication_issues.date', '2026-05-13')
    expect(mockChain.lte).toHaveBeenCalledWith('publication_issues.date', '2026-05-20')
  })

  it('filters by is_active, non-null ticker, publication, and excludes the current issue', async () => {
    mockChainResult = { data: [], error: null }
    await listRecentlyFeaturedTickers('pub-1', '2026-05-20', 7, 'iss-cur')
    expect(mockChain.eq).toHaveBeenCalledWith('is_active', true)
    expect(mockChain.not).toHaveBeenCalledWith('ticker', 'is', null)
    expect(mockChain.eq).toHaveBeenCalledWith('publication_issues.publication_id', 'pub-1')
    expect(mockChain.neq).toHaveBeenCalledWith('issue_id', 'iss-cur')
  })

  it('returns an empty set on query error', async () => {
    mockChainResult = { data: null, error: { message: 'fail' } }
    const result = await listRecentlyFeaturedTickers('pub-1', '2026-05-20', 7, 'iss-cur')
    expect(result).toEqual(new Set())
  })

  it('selects ticker plus the inner-joined publication_issues columns', async () => {
    mockChainResult = { data: [], error: null }
    await listRecentlyFeaturedTickers('pub-1', '2026-05-20', 7, 'iss-cur')
    expect(mockChain.select).toHaveBeenCalledWith('ticker, publication_issues!inner(publication_id, date)')
  })
})
