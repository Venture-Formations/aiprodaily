import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports that use them
// ---------------------------------------------------------------------------
const mockSingle = vi.fn()
const mockMaybeSingle = vi.fn()
// `mockTerminal` resolves the chain when no `.single()` is called (await query).
// vitest auto-resolves the chain via `then`.
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
  gte: vi.fn(function () { return mockChain }),
  lte: vi.fn(function () { return mockChain }),
  order: vi.fn(function () { return mockChain }),
  limit: vi.fn(function () { return mockChain }),
  range: vi.fn(function () {
    return Promise.resolve(mockChainResult)
  }),
  single: mockSingle,
  maybeSingle: mockMaybeSingle,
  // thenable so `await query` resolves to mockChainResult
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
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    correlationId: 'test-id',
  }
  return { createLogger: vi.fn(() => log) }
})

// Import after mocks are set up
import {
  getExistingExternalIds,
  listPostsByIssue,
  listPostsForScoring,
  listAssignedPostsForModule,
  listExtractedPostsByIds,
  listPendingExtractionPosts,
  listPostsForExtractionByIssue,
  getRatedPostIds,
  insertPost,
  updatePostExtraction,
  assignPostsToIssue,
  unassignPosts,
  insertPostRating,
} from '../posts'

beforeEach(() => {
  vi.clearAllMocks()
  mockChainResult = { data: null, error: null }
  // Reset chain returns
  mockChain.select.mockReturnValue(mockChain)
  mockChain.insert.mockReturnValue(mockChain)
  mockChain.update.mockReturnValue(mockChain)
  mockChain.delete.mockReturnValue(mockChain)
  mockChain.eq.mockReturnValue(mockChain)
  mockChain.neq.mockReturnValue(mockChain)
  mockChain.in.mockReturnValue(mockChain)
  mockChain.is.mockReturnValue(mockChain)
  mockChain.not.mockReturnValue(mockChain)
  mockChain.gte.mockReturnValue(mockChain)
  mockChain.lte.mockReturnValue(mockChain)
  mockChain.order.mockReturnValue(mockChain)
  mockChain.limit.mockReturnValue(mockChain)
})

// ---------------------------------------------------------------------------
describe('getExistingExternalIds', () => {
  it('returns empty Set when input is empty', async () => {
    const result = await getExistingExternalIds([], ['feed-1'])
    expect(result.size).toBe(0)
    const result2 = await getExistingExternalIds(['ext-1'], [])
    expect(result2.size).toBe(0)
  })

  it('returns Set of external_ids that exist in DB', async () => {
    // fetchAllPaginated calls .range(); short page (< pageSize) terminates loop
    mockChainResult = {
      data: [{ external_id: 'a' }, { external_id: 'b' }],
      error: null,
    }
    const result = await getExistingExternalIds(['a', 'b', 'c'], ['feed-1'])
    expect(result).toEqual(new Set(['a', 'b']))
  })

  it('returns empty Set on error', async () => {
    mockChainResult = { data: null, error: { message: 'boom', code: 'XX' } }
    const result = await getExistingExternalIds(['a'], ['feed-1'])
    expect(result.size).toBe(0)
  })
})

// ---------------------------------------------------------------------------
describe('listPostsByIssue', () => {
  it('returns posts on success', async () => {
    mockChainResult = {
      data: [{ id: 'p1' }, { id: 'p2' }],
      error: null,
    }
    const posts = await listPostsByIssue('issue-1')
    expect(posts).toHaveLength(2)
    expect(mockChain.eq).toHaveBeenCalledWith('issue_id', 'issue-1')
  })

  it('returns empty array on error', async () => {
    mockChainResult = { data: null, error: { message: 'fail' } }
    const posts = await listPostsByIssue('issue-1')
    expect(posts).toEqual([])
  })

  it('passes idsOnly column hint through', async () => {
    mockChainResult = { data: [{ id: 'p1' }], error: null }
    await listPostsByIssue('issue-1', { idsOnly: true })
    expect(mockChain.select).toHaveBeenCalledWith('id')
  })
})

// ---------------------------------------------------------------------------
describe('listPostsForScoring', () => {
  it('returns [] when feedIds is empty', async () => {
    const result = await listPostsForScoring([])
    expect(result).toEqual([])
  })

  it('applies unassignedOnly + sinceTimestamp + requireRating filters', async () => {
    mockChainResult = { data: [{ id: 'p1' }], error: null }
    await listPostsForScoring(['feed-1'], {
      unassignedOnly: true,
      sinceTimestamp: '2025-01-01T00:00:00Z',
      requireRating: true,
    })
    expect(mockChain.in).toHaveBeenCalledWith('feed_id', ['feed-1'])
    expect(mockChain.is).toHaveBeenCalledWith('issue_id', null)
    expect(mockChain.gte).toHaveBeenCalledWith('processed_at', '2025-01-01T00:00:00Z')
    expect(mockChain.not).toHaveBeenCalledWith('post_ratings', 'is', null)
  })
})

// ---------------------------------------------------------------------------
describe('listAssignedPostsForModule', () => {
  it('returns [] for empty feedIds', async () => {
    const result = await listAssignedPostsForModule('issue-1', 'mod-1', [])
    expect(result).toEqual([])
  })

  it('filters by issue, module, and feeds', async () => {
    mockChainResult = { data: [{ id: 'p1' }], error: null }
    await listAssignedPostsForModule('issue-1', 'mod-1', ['feed-1'])
    expect(mockChain.eq).toHaveBeenCalledWith('issue_id', 'issue-1')
    expect(mockChain.eq).toHaveBeenCalledWith('article_module_id', 'mod-1')
    expect(mockChain.in).toHaveBeenCalledWith('feed_id', ['feed-1'])
  })
})

// ---------------------------------------------------------------------------
describe('listExtractedPostsByIds', () => {
  it('returns [] when ids is empty', async () => {
    const result = await listExtractedPostsByIds([])
    expect(result).toEqual([])
  })

  it('filters to extracted posts with full text', async () => {
    mockChainResult = { data: [{ id: 'p1' }], error: null }
    await listExtractedPostsByIds(['p1', 'p2'])
    expect(mockChain.in).toHaveBeenCalledWith('id', ['p1', 'p2'])
    expect(mockChain.eq).toHaveBeenCalledWith('extraction_status', 'success')
    expect(mockChain.not).toHaveBeenCalledWith('full_article_text', 'is', null)
  })
})

// ---------------------------------------------------------------------------
describe('listPendingExtractionPosts', () => {
  it('applies limit and order', async () => {
    mockChainResult = { data: [{ id: 'p1', source_url: 'http://x' }], error: null }
    await listPendingExtractionPosts('feed-1', { limit: 5 })
    expect(mockChain.eq).toHaveBeenCalledWith('feed_id', 'feed-1')
    expect(mockChain.eq).toHaveBeenCalledWith('extraction_status', 'pending')
    expect(mockChain.order).toHaveBeenCalledWith('processed_at', { ascending: true })
    expect(mockChain.limit).toHaveBeenCalledWith(5)
  })

  it('applies excludeIds via .not("id", "in", ...) when ids are valid UUIDs', async () => {
    mockChainResult = { data: [], error: null }
    const id1 = '11111111-1111-1111-1111-111111111111'
    const id2 = '22222222-2222-2222-2222-222222222222'
    await listPendingExtractionPosts('feed-1', { excludeIds: [id1, id2] })
    expect(mockChain.not).toHaveBeenCalledWith('id', 'in', `(${id1},${id2})`)
  })

  it('drops non-UUID excludeIds and continues without injection', async () => {
    mockChainResult = { data: [], error: null }
    await listPendingExtractionPosts('feed-1', { excludeIds: ["a)'; DROP TABLE rss_posts; --"] })
    // All inputs were invalid UUIDs, so .not() should never be called
    expect(mockChain.not).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
describe('listPostsForExtractionByIssue', () => {
  it('returns posts needing extraction', async () => {
    mockChainResult = {
      data: [{ id: 'p1', source_url: 'x', title: 't', full_article_text: null, processed_at: 'd' }],
      error: null,
    }
    const result = await listPostsForExtractionByIssue('issue-1')
    expect(result).toHaveLength(1)
    expect(mockChain.eq).toHaveBeenCalledWith('issue_id', 'issue-1')
    expect(mockChain.not).toHaveBeenCalledWith('source_url', 'is', null)
  })

  it('honors sinceHours by passing a gte filter', async () => {
    mockChainResult = { data: [], error: null }
    await listPostsForExtractionByIssue('issue-1', { sinceHours: 24 })
    expect(mockChain.gte).toHaveBeenCalledWith('processed_at', expect.any(String))
  })
})

// ---------------------------------------------------------------------------
describe('getRatedPostIds', () => {
  it('returns empty set when input empty', async () => {
    const result = await getRatedPostIds([])
    expect(result.size).toBe(0)
  })

  it('returns Set of rated post_ids', async () => {
    mockChainResult = {
      data: [{ post_id: 'p1' }, { post_id: 'p2' }],
      error: null,
    }
    const result = await getRatedPostIds(['p1', 'p2', 'p3'])
    expect(result).toEqual(new Set(['p1', 'p2']))
  })
})

// ---------------------------------------------------------------------------
describe('insertPost', () => {
  it('returns inserted row on success', async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: 'p1', source_url: 'x' }, error: null })
    const result = await insertPost({ feed_id: 'f1', external_id: 'e1', title: 't' })
    expect(result).toEqual({ id: 'p1', source_url: 'x' })
  })

  it('returns null on error', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'fail' } })
    const result = await insertPost({ feed_id: 'f1', external_id: 'e1', title: 't' })
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
describe('updatePostExtraction', () => {
  it('returns true on success', async () => {
    mockChainResult = { data: null, error: null }
    const ok = await updatePostExtraction('p1', { extractionStatus: 'success', fullArticleText: 'text' })
    expect(ok).toBe(true)
    expect(mockChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        extraction_status: 'success',
        full_article_text: 'text',
      })
    )
  })

  it('clears extraction_error on success', async () => {
    mockChainResult = { data: null, error: null }
    await updatePostExtraction('p1', { extractionStatus: 'success' })
    expect(mockChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ extraction_error: null })
    )
  })

  it('returns false on error', async () => {
    mockChainResult = { data: null, error: { message: 'fail' } }
    const ok = await updatePostExtraction('p1', { extractionStatus: 'failed' })
    expect(ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
describe('assignPostsToIssue', () => {
  it('returns true (no-op) for empty postIds', async () => {
    const ok = await assignPostsToIssue([], 'issue-1')
    expect(ok).toBe(true)
  })

  it('updates issue_id only when no moduleId given', async () => {
    mockChainResult = { data: null, error: null }
    await assignPostsToIssue(['p1', 'p2'], 'issue-1')
    expect(mockChain.update).toHaveBeenCalledWith({ issue_id: 'issue-1' })
    expect(mockChain.in).toHaveBeenCalledWith('id', ['p1', 'p2'])
  })

  it('also stamps article_module_id when given', async () => {
    mockChainResult = { data: null, error: null }
    await assignPostsToIssue(['p1'], 'issue-1', { moduleId: 'mod-1' })
    expect(mockChain.update).toHaveBeenCalledWith({ issue_id: 'issue-1', article_module_id: 'mod-1' })
  })
})

// ---------------------------------------------------------------------------
describe('unassignPosts', () => {
  it('returns true (no-op) for empty list', async () => {
    const ok = await unassignPosts([])
    expect(ok).toBe(true)
  })

  it('sets issue_id to null', async () => {
    mockChainResult = { data: null, error: null }
    await unassignPosts(['p1'])
    expect(mockChain.update).toHaveBeenCalledWith({ issue_id: null })
  })
})

// ---------------------------------------------------------------------------
describe('insertPostRating', () => {
  it('returns { ok: true } on success', async () => {
    mockChainResult = { data: null, error: null }
    const result = await insertPostRating({ post_id: 'p1' })
    expect(result).toEqual({ ok: true })
  })

  it('returns { ok: false, errorMessage } on error', async () => {
    mockChainResult = { data: null, error: { message: 'duplicate key' } }
    const result = await insertPostRating({ post_id: 'p1' })
    expect(result.ok).toBe(false)
    expect(result.errorMessage).toBe('duplicate key')
  })
})
