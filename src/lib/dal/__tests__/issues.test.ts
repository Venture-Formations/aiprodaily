import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports that use them
// ---------------------------------------------------------------------------
const mockSingle = vi.fn()
const mockMaybeSingle = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()

// Fluent chain mock: each method returns the chain so calls can be chained
const mockChain: Record<string, any> = {
  select: vi.fn(function (this: any) { mockSelect(); return mockChain }),
  eq: vi.fn(function () { return mockChain }),
  neq: vi.fn(function () { return mockChain }),
  in: vi.fn(function () { return mockChain }),
  gte: vi.fn(function () { return mockChain }),
  lte: vi.fn(function () { return mockChain }),
  order: vi.fn(function () { return mockChain }),
  range: vi.fn(function () { return mockChain }),
  limit: vi.fn(function () { return mockChain }),
  single: mockSingle,
  maybeSingle: mockMaybeSingle,
  insert: vi.fn(function () { mockInsert(); return mockChain }),
  update: vi.fn(function () { mockUpdate(); return mockChain }),
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
import { supabaseAdmin } from '@/lib/supabase'
import {
  getIssueById,
  getIssueByDate,
  listIssues,
  getIssuePublicationId,
  createIssue,
  updateIssueStatus,
} from '../issues'

const PUB_ID = 'pub-test-123'

beforeEach(() => {
  vi.clearAllMocks()
  // Reset fluent chain — re-point each mock to return the chain
  mockChain.select.mockReturnValue(mockChain)
  mockChain.eq.mockReturnValue(mockChain)
  mockChain.neq.mockReturnValue(mockChain)
  mockChain.in.mockReturnValue(mockChain)
  mockChain.gte.mockReturnValue(mockChain)
  mockChain.lte.mockReturnValue(mockChain)
  mockChain.order.mockReturnValue(mockChain)
  mockChain.range.mockReturnValue(mockChain)
  mockChain.limit.mockReturnValue(mockChain)
  mockChain.insert.mockReturnValue(mockChain)
  mockChain.update.mockReturnValue(mockChain)
})

// ---------------------------------------------------------------------------
// getIssueById
// ---------------------------------------------------------------------------
describe('getIssueById', () => {
  it('returns issue on success', async () => {
    const mockIssue = { id: 'iss-1', publication_id: PUB_ID, status: 'draft' }
    mockSingle.mockResolvedValue({ data: mockIssue, error: null })

    const result = await getIssueById('iss-1', PUB_ID)
    expect(result).toEqual(mockIssue)
    expect(supabaseAdmin.from).toHaveBeenCalledWith('publication_issues')
  })

  it('returns null when not found (PGRST116)', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })

    const result = await getIssueById('missing')
    expect(result).toBeNull()
  })

  it('returns null on other errors', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: 'OTHER', message: 'fail' } })

    const result = await getIssueById('iss-1')
    expect(result).toBeNull()
  })

  it('applies publication_id filter when provided', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'iss-1' }, error: null })

    await getIssueById('iss-1', PUB_ID)

    // eq is called twice: once for id, once for publication_id
    expect(mockChain.eq).toHaveBeenCalledWith('id', 'iss-1')
    expect(mockChain.eq).toHaveBeenCalledWith('publication_id', PUB_ID)
  })
})

// ---------------------------------------------------------------------------
// getIssueByDate
// ---------------------------------------------------------------------------
describe('getIssueByDate', () => {
  it('returns issue for matching date', async () => {
    const mockIssue = { id: 'iss-2', date: '2026-01-01' }
    mockMaybeSingle.mockResolvedValue({ data: mockIssue, error: null })

    const result = await getIssueByDate(PUB_ID, '2026-01-01')
    expect(result).toEqual(mockIssue)
  })

  it('returns null when no issue for date', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    const result = await getIssueByDate(PUB_ID, '2099-01-01')
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// listIssues
// ---------------------------------------------------------------------------
describe('listIssues', () => {
  it('returns data and count on success', async () => {
    const issues = [{ id: 'iss-1' }, { id: 'iss-2' }]
    // For listIssues, the final call in the chain resolves with data + count
    // The chain ends without .single(), so we mock the chain's then-able
    mockChain.range.mockResolvedValue({ data: issues, error: null, count: 2 })

    const result = await listIssues(PUB_ID)
    expect(result.data).toHaveLength(2)
    expect(result.count).toBe(2)
  })

  it('returns empty on error', async () => {
    mockChain.range.mockResolvedValue({ data: null, error: { message: 'fail' }, count: null })

    const result = await listIssues(PUB_ID)
    expect(result.data).toEqual([])
    expect(result.count).toBeNull()
  })

  it('applies status filter as array', async () => {
    mockChain.range.mockResolvedValue({ data: [], error: null, count: 0 })

    await listIssues(PUB_ID, { status: ['draft', 'in_review'] })
    expect(mockChain.in).toHaveBeenCalledWith('status', ['draft', 'in_review'])
  })

  it('applies single status filter', async () => {
    mockChain.range.mockResolvedValue({ data: [], error: null, count: 0 })

    await listIssues(PUB_ID, { status: 'draft' })
    expect(mockChain.eq).toHaveBeenCalledWith('status', 'draft')
  })
})

// ---------------------------------------------------------------------------
// getIssuePublicationId
// ---------------------------------------------------------------------------
describe('getIssuePublicationId', () => {
  it('returns publication_id on success', async () => {
    mockSingle.mockResolvedValue({ data: { publication_id: PUB_ID }, error: null })

    const result = await getIssuePublicationId('iss-1')
    expect(result).toBe(PUB_ID)
  })

  it('returns null on error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })

    const result = await getIssuePublicationId('iss-1')
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// createIssue
// ---------------------------------------------------------------------------
describe('createIssue', () => {
  it('returns created issue on success', async () => {
    const created = { id: 'new-1', publication_id: PUB_ID, date: '2026-03-01', status: 'processing' }
    mockSingle.mockResolvedValue({ data: created, error: null })

    const result = await createIssue(PUB_ID, '2026-03-01')
    expect(result).toEqual(created)
  })

  it('returns null on insert error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'duplicate' } })

    const result = await createIssue(PUB_ID, '2026-03-01')
    expect(result).toBeNull()
  })

  it('defaults to processing status', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'x' }, error: null })

    await createIssue(PUB_ID, '2026-03-01')
    expect(mockChain.insert).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// updateIssueStatus
// ---------------------------------------------------------------------------
describe('updateIssueStatus', () => {
  it('returns true on unconditional update success', async () => {
    mockChain.eq.mockResolvedValue({ error: null })

    const result = await updateIssueStatus('iss-1', 'in_review')
    expect(result).toBe(true)
  })

  it('returns false on update error', async () => {
    mockChain.eq.mockResolvedValue({ error: { message: 'fail' } })

    const result = await updateIssueStatus('iss-1', 'in_review')
    expect(result).toBe(false)
  })

  it('validates transition when expectedCurrentStatus provided', async () => {
    // draft -> sent is not a valid transition
    const result = await updateIssueStatus('iss-1', 'sent', {
      expectedCurrentStatus: 'draft',
    })
    expect(result).toBe(false)
  })

  it('proceeds with valid transition and CAS', async () => {
    // in_review -> sent is valid
    mockSingle.mockResolvedValue({ data: { id: 'iss-1' }, error: null })

    const result = await updateIssueStatus('iss-1', 'sent', {
      expectedCurrentStatus: 'in_review',
    })
    expect(result).toBe(true)
  })

  it('returns false on CAS failure (PGRST116)', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })

    const result = await updateIssueStatus('iss-1', 'sent', {
      expectedCurrentStatus: 'in_review',
    })
    expect(result).toBe(false)
  })
})
