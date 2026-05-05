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
  in: vi.fn(function () { return mockChain }),
  is: vi.fn(function () { return mockChain }),
  not: vi.fn(function () { return mockChain }),
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
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), correlationId: 'test-id' }
  return { createLogger: vi.fn(() => log) }
})

import {
  isIssueDeduplicated,
  listDuplicateGroupIdsByIssue,
  listDuplicatePostIdsByGroups,
  listDuplicatePostsForGroup,
  createDuplicateGroup,
  addDuplicatePostToGroup,
  storeDeduplicationResult,
} from '../dedup'

beforeEach(() => {
  vi.clearAllMocks()
  mockChainResult = { data: null, error: null }
  mockChain.select.mockReturnValue(mockChain)
  mockChain.insert.mockReturnValue(mockChain)
  mockChain.eq.mockReturnValue(mockChain)
  mockChain.in.mockReturnValue(mockChain)
  mockChain.limit.mockReturnValue(mockChain)
})

// ---------------------------------------------------------------------------
describe('isIssueDeduplicated', () => {
  it('returns true when a group exists', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'g1' }, error: null })
    expect(await isIssueDeduplicated('issue-1')).toBe(true)
  })

  it('returns false when no group exists', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    expect(await isIssueDeduplicated('issue-1')).toBe(false)
  })

  it('returns false on error', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { code: 'XX', message: 'fail' } })
    expect(await isIssueDeduplicated('issue-1')).toBe(false)
  })

  it('treats PGRST116 (not found) as not-deduplicated, not error', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116', message: 'no rows' } })
    expect(await isIssueDeduplicated('issue-1')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
describe('listDuplicateGroupIdsByIssue', () => {
  it('returns array of group ids', async () => {
    mockChainResult = { data: [{ id: 'g1' }, { id: 'g2' }], error: null }
    const result = await listDuplicateGroupIdsByIssue('issue-1')
    expect(result).toEqual(['g1', 'g2'])
    expect(mockChain.eq).toHaveBeenCalledWith('issue_id', 'issue-1')
  })

  it('returns [] on error', async () => {
    mockChainResult = { data: null, error: { message: 'fail' } }
    expect(await listDuplicateGroupIdsByIssue('issue-1')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
describe('listDuplicatePostIdsByGroups', () => {
  it('returns empty Set when groupIds empty', async () => {
    const result = await listDuplicatePostIdsByGroups([])
    expect(result.size).toBe(0)
  })

  it('returns Set of post_ids across groups', async () => {
    mockChainResult = { data: [{ post_id: 'p1' }, { post_id: 'p2' }], error: null }
    const result = await listDuplicatePostIdsByGroups(['g1'])
    expect(result).toEqual(new Set(['p1', 'p2']))
    expect(mockChain.in).toHaveBeenCalledWith('group_id', ['g1'])
  })
})

// ---------------------------------------------------------------------------
describe('listDuplicatePostsForGroup', () => {
  it('returns rows', async () => {
    mockChainResult = {
      data: [{ id: 'd1', group_id: 'g1', post_id: 'p1', similarity_score: 0.9 }],
      error: null,
    }
    const result = await listDuplicatePostsForGroup('g1')
    expect(result).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
describe('createDuplicateGroup', () => {
  it('returns inserted row on success', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'g1', issue_id: 'i1', primary_post_id: 'p1', topic_signature: 'sig' },
      error: null,
    })
    const result = await createDuplicateGroup({
      issueId: 'i1',
      primaryPostId: 'p1',
      topicSignature: 'sig',
    })
    expect(result?.id).toBe('g1')
  })

  it('returns null on error', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'fail' } })
    const result = await createDuplicateGroup({
      issueId: 'i1',
      primaryPostId: 'p1',
      topicSignature: null,
    })
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
describe('addDuplicatePostToGroup', () => {
  it('returns true on success', async () => {
    mockChainResult = { data: null, error: null }
    const ok = await addDuplicatePostToGroup('g1', {
      postId: 'p1',
      similarityScore: 0.85,
      detectionMethod: 'ai_semantic',
    })
    expect(ok).toBe(true)
  })

  it('returns false on error', async () => {
    mockChainResult = { data: null, error: { message: 'fail' } }
    const ok = await addDuplicatePostToGroup('g1', { postId: 'p1', similarityScore: 0.85 })
    expect(ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
describe('storeDeduplicationResult', () => {
  it('returns null group + 0 stored when group create fails', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'fail' } })
    const result = await storeDeduplicationResult({
      issueId: 'i1',
      primaryPostId: 'p1',
      topicSignature: null,
      duplicates: [{ postId: 'd1', similarityScore: 0.9 }],
    })
    expect(result.group).toBeNull()
    expect(result.storedDuplicates).toBe(0)
  })

  it('bulk-inserts all duplicates after group creation', async () => {
    // Group insert succeeds
    mockSingle.mockResolvedValueOnce({
      data: { id: 'g1', issue_id: 'i1', primary_post_id: 'p1', topic_signature: null },
      error: null,
    })
    // Bulk insert succeeds
    mockChainResult = { data: null, error: null }

    const result = await storeDeduplicationResult({
      issueId: 'i1',
      primaryPostId: 'p1',
      topicSignature: null,
      duplicates: [
        { postId: 'd1', similarityScore: 0.9 },
        { postId: 'd2', similarityScore: 0.8 },
      ],
    })
    expect(result.group?.id).toBe('g1')
    expect(result.storedDuplicates).toBe(2)
    // Verify exactly one INSERT call (bulk), not per-duplicate
    expect(mockChain.insert).toHaveBeenCalledTimes(2) // 1 for group, 1 for bulk duplicates
  })

  it('returns group with storedDuplicates=0 when bulk insert fails', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'g1', issue_id: 'i1', primary_post_id: 'p1', topic_signature: null },
      error: null,
    })
    // Bulk insert fails
    mockChainResult = { data: null, error: { message: 'bulk insert failed' } }

    const result = await storeDeduplicationResult({
      issueId: 'i1',
      primaryPostId: 'p1',
      topicSignature: null,
      duplicates: [
        { postId: 'd1', similarityScore: 0.9 },
        { postId: 'd2', similarityScore: 0.8 },
      ],
    })
    expect(result.group?.id).toBe('g1')
    expect(result.storedDuplicates).toBe(0)
  })

  it('skips bulk insert entirely when duplicates is empty', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'g1', issue_id: 'i1', primary_post_id: 'p1', topic_signature: null },
      error: null,
    })

    const result = await storeDeduplicationResult({
      issueId: 'i1',
      primaryPostId: 'p1',
      topicSignature: null,
      duplicates: [],
    })
    expect(result.group?.id).toBe('g1')
    expect(result.storedDuplicates).toBe(0)
    // Only the group insert; no duplicate insert
    expect(mockChain.insert).toHaveBeenCalledTimes(1)
  })
})
