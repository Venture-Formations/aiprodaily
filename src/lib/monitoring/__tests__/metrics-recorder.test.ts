import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockSingle = vi.fn()
const mockInsert = vi.fn(() => ({ error: null }))
const mockDelete = vi.fn()
const mockChain: Record<string, any> = {
  select: vi.fn(() => mockChain),
  eq: vi.fn(() => mockChain),
  gte: vi.fn(() => mockChain),
  lt: vi.fn(() => mockChain),
  order: vi.fn(() => mockChain),
  limit: vi.fn(() => mockChain),
  single: mockSingle,
  insert: mockInsert,
  delete: vi.fn(() => mockChain),
}

// For delete().lt().select(), chain needs to resolve with { count }
let deleteCount = 5
mockChain.delete.mockImplementation(() => {
  const chain = {
    lt: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ count: deleteCount, error: null })),
    })),
    eq: vi.fn(() => chain),
  }
  return chain
})

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => mockChain),
  },
}))

import { MetricsRecorder } from '../metrics-recorder'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MetricsRecorder', () => {
  describe('record', () => {
    it('inserts a metric row', async () => {
      const recorder = new MetricsRecorder('pub-123')
      await recorder.record('test_metric', 42, { tag: 'value' })

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          publication_id: 'pub-123',
          metric_name: 'test_metric',
          metric_value: 42,
          tags: { tag: 'value' },
        })
      )
    })

    it('does not throw on insert failure', async () => {
      mockInsert.mockReturnValueOnce({ error: { message: 'DB error' } } as any)
      const recorder = new MetricsRecorder('pub-123')
      // Should not throw
      await recorder.record('failing_metric', 1)
    })
  })

  describe('recordTiming', () => {
    it('records elapsed time from startMs', async () => {
      const recorder = new MetricsRecorder('pub-123')
      const startMs = Date.now() - 500

      await recorder.recordTiming('latency', startMs)

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metric_name: 'latency',
          // Value should be approximately 500ms
          metric_value: expect.any(Number),
        })
      )
    })
  })

  describe('getRollingAverage', () => {
    it('returns avg and stddev for metric data', async () => {
      // Mock: return 5 data points
      mockChain.gte.mockReturnValue({
        data: [
          { metric_value: 100 },
          { metric_value: 200 },
          { metric_value: 300 },
          { metric_value: 400 },
          { metric_value: 500 },
        ],
        error: null,
      })

      const result = await MetricsRecorder.getRollingAverage('pub-123', 'test', 7)

      expect(result.avg).toBe(300)
      expect(result.count).toBe(5)
      expect(result.stddev).toBeGreaterThan(0)
    })

    it('returns zeros when no data', async () => {
      mockChain.gte.mockReturnValue({ data: [], error: null })

      const result = await MetricsRecorder.getRollingAverage('pub-123', 'test', 7)

      expect(result.avg).toBe(0)
      expect(result.stddev).toBe(0)
      expect(result.count).toBe(0)
    })
  })

  describe('queryForChart', () => {
    it('returns empty array on error', async () => {
      // queryForChart chains .select().eq().eq().gte().order()
      // When the chain returns mockChain (no data property), it falls through to empty
      const result = await MetricsRecorder.queryForChart('pub-123', 'test', 7)
      expect(result).toEqual([])
    })
  })
})
