import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports that use them
// ---------------------------------------------------------------------------
let mockChainResult: { data: any; error: any } = { data: null, error: null }

const mockChain: Record<string, any> = {
  select: vi.fn(function () { return mockChain }),
  eq: vi.fn(function () { return mockChain }),
  order: vi.fn(function () { return mockChain }),
  range: vi.fn(function () { return Promise.resolve(mockChainResult) }),
}

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: vi.fn(() => mockChain) },
}))

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    correlationId: 'test-id',
  })),
}))

import { getExcludedIPs } from '../excluded-ips'

beforeEach(() => {
  vi.clearAllMocks()
  mockChainResult = { data: null, error: null }
  mockChain.select.mockReturnValue(mockChain)
  mockChain.eq.mockReturnValue(mockChain)
  mockChain.order.mockReturnValue(mockChain)
})

describe('getExcludedIPs', () => {
  it('returns normalized IPExclusion[] with is_range coerced to boolean', async () => {
    mockChainResult = {
      data: [
        { ip_address: '1.2.3.4', is_range: false, cidr_prefix: null },
        { ip_address: '10.0.0.0', is_range: true, cidr_prefix: 24 },
        { ip_address: '5.6.7.8', is_range: null, cidr_prefix: null }, // null → false
      ],
      error: null,
    }

    const result = await getExcludedIPs('pub-1')

    expect(result).toEqual([
      { ip_address: '1.2.3.4', is_range: false, cidr_prefix: null },
      { ip_address: '10.0.0.0', is_range: true, cidr_prefix: 24 },
      { ip_address: '5.6.7.8', is_range: false, cidr_prefix: null },
    ])
  })

  it('returns empty array when publicationId is empty (defensive guard)', async () => {
    const result = await getExcludedIPs('')
    expect(result).toEqual([])
    // Did NOT issue a query
    expect(mockChain.range).not.toHaveBeenCalled()
  })

  it('returns empty array on DB error (errors swallowed, not thrown)', async () => {
    mockChainResult = { data: null, error: { message: 'connection reset' } }

    const result = await getExcludedIPs('pub-1')
    expect(result).toEqual([])
  })

  it('uses the provided label for pagination logging', async () => {
    mockChainResult = { data: [], error: null }

    await getExcludedIPs('pub-1', 'custom-label')
    // Range was called (i.e. fetchAllPaginated ran)
    expect(mockChain.range).toHaveBeenCalled()
  })

  it('orders by id for stable offset pagination', async () => {
    mockChainResult = { data: [], error: null }

    await getExcludedIPs('pub-1')
    expect(mockChain.order).toHaveBeenCalledWith('id')
  })

  it('throws on DB error when throwOnError: true is passed', async () => {
    mockChainResult = { data: null, error: { message: 'connection reset' } }

    await expect(
      getExcludedIPs('pub-1', 'cron-label', { throwOnError: true }),
    ).rejects.toBeDefined()
  })

  it('still swallows on DB error when throwOnError is false (default)', async () => {
    mockChainResult = { data: null, error: { message: 'connection reset' } }

    const result = await getExcludedIPs('pub-1', 'analytics-label')
    expect(result).toEqual([])
  })
})
