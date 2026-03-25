import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockSingle = vi.fn()
const mockUpsert = vi.fn(() => ({ error: null }))
const mockChain: Record<string, any> = {
  select: vi.fn(() => mockChain),
  eq: vi.fn(() => mockChain),
  limit: vi.fn(() => mockChain),
  single: mockSingle,
  upsert: mockUpsert,
  delete: vi.fn(() => mockChain),
}

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === 'publications') {
        // Always return a publication ID for getGlobalPublicationId
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: { id: 'pub-test-123' } }),
              })),
            })),
          })),
        }
      }
      return mockChain
    }),
  },
}))

import { isCircuitOpen, recordRateLimitHit, closeCircuit, _resetPublicationCache } from '../circuit-breaker'

beforeEach(() => {
  mockSingle.mockReset()
  mockUpsert.mockReset().mockReturnValue({ error: null })
  _resetPublicationCache()
})

describe('isCircuitOpen', () => {
  it('returns false when no circuit open timestamp exists', async () => {
    mockSingle.mockResolvedValue({ data: null })
    expect(await isCircuitOpen()).toBe(false)
  })

  it('returns true when circuit opened less than 5 minutes ago', async () => {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    mockSingle.mockResolvedValue({ data: { value: twoMinutesAgo } })
    expect(await isCircuitOpen()).toBe(true)
  })

  it('returns false and auto-closes when cooldown has elapsed', async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    mockSingle.mockResolvedValueOnce({ data: { value: tenMinutesAgo } })
    mockSingle.mockResolvedValue({ data: null })
    expect(await isCircuitOpen()).toBe(false)
  })

  it('returns false on database error (fail-open)', async () => {
    mockSingle.mockRejectedValue(new Error('DB down'))
    expect(await isCircuitOpen()).toBe(false)
  })
})

describe('recordRateLimitHit', () => {
  it('starts a new window on first hit', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: null }) // window_start
      .mockResolvedValueOnce({ data: null }) // 429_count

    const result = await recordRateLimitHit()
    expect(result.tripped).toBe(false)
  })

  it('does not trip on hits below threshold', async () => {
    const recentWindow = new Date(Date.now() - 60_000).toISOString()
    mockSingle
      .mockResolvedValueOnce({ data: { value: recentWindow } })
      .mockResolvedValueOnce({ data: { value: '1' } })

    const result = await recordRateLimitHit()
    expect(result.tripped).toBe(false)
  })

  it('trips when threshold reached', async () => {
    const recentWindow = new Date(Date.now() - 60_000).toISOString()
    mockSingle
      .mockResolvedValueOnce({ data: { value: recentWindow } })
      .mockResolvedValueOnce({ data: { value: '2' } })

    const result = await recordRateLimitHit()
    expect(result.tripped).toBe(true)
  })

  it('starts new window when existing window expired', async () => {
    const oldWindow = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    mockSingle
      .mockResolvedValueOnce({ data: { value: oldWindow } })
      .mockResolvedValueOnce({ data: { value: '5' } })

    const result = await recordRateLimitHit()
    expect(result.tripped).toBe(false)
  })

  it('returns tripped=false on error (fail-open)', async () => {
    mockSingle.mockRejectedValue(new Error('DB down'))
    const result = await recordRateLimitHit()
    expect(result.tripped).toBe(false)
  })
})

describe('closeCircuit', () => {
  it('deletes the open key and resets counters', async () => {
    mockSingle.mockResolvedValue({ data: null })
    await closeCircuit()
    expect(mockChain.delete).toHaveBeenCalled()
  })
})
