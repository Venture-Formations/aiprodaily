import { describe, it, expect, vi, beforeEach } from 'vitest'

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

import { fetchAllPaginated } from '../paginate'

// ---------------------------------------------------------------------------
// Test helpers — build a stub query whose .range(from, to) returns a slice
// ---------------------------------------------------------------------------

function makeRowSource<T>(allRows: T[]) {
  // Returns a builder factory that, on each call, produces a fresh stub query
  // whose .range() returns the requested slice. Tracks how many .range() calls
  // were made so tests can assert page count.
  const calls: Array<{ from: number; to: number }> = []
  const buildQuery = () => ({
    range: (from: number, to: number) => {
      calls.push({ from, to })
      const slice = allRows.slice(from, to + 1)
      return Promise.resolve({ data: slice, error: null })
    },
  })
  return { buildQuery, calls }
}

function makeErrorSource(errorOnPage: number) {
  // Returns a builder that succeeds for the first N pages, then errors.
  let pageIndex = 0
  const calls: number[] = []
  const buildQuery = () => ({
    range: (from: number, to: number) => {
      const thisPage = pageIndex
      pageIndex += 1
      calls.push(thisPage)
      if (thisPage === errorOnPage) {
        return Promise.resolve({
          data: null,
          error: { message: 'simulated postgrest error', code: 'XX000' } as any,
        })
      }
      // Fill page with synthetic rows so the loop advances
      const size = to - from + 1
      const rows = Array.from({ length: size }, (_, i) => ({ id: from + i }))
      return Promise.resolve({ data: rows, error: null })
    },
  })
  return { buildQuery, calls: () => calls }
}

// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchAllPaginated', () => {
  it('returns [] for an empty source in 1 page', async () => {
    const { buildQuery, calls } = makeRowSource<{ id: number }>([])
    const result = await fetchAllPaginated<{ id: number }>(buildQuery)
    expect(result).toEqual([])
    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual({ from: 0, to: 999 })
  })

  it('returns all rows in 1 page when source is smaller than pageSize', async () => {
    const rows = Array.from({ length: 42 }, (_, i) => ({ id: i }))
    const { buildQuery, calls } = makeRowSource(rows)
    const result = await fetchAllPaginated<{ id: number }>(buildQuery)
    expect(result).toHaveLength(42)
    expect(result[0]).toEqual({ id: 0 })
    expect(result[41]).toEqual({ id: 41 })
    expect(calls).toHaveLength(1)
  })

  it('uses 2 pages when source has exactly pageSize rows (second page empty)', async () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({ id: i }))
    const { buildQuery, calls } = makeRowSource(rows)
    const result = await fetchAllPaginated<{ id: number }>(buildQuery)
    expect(result).toHaveLength(1000)
    expect(calls).toHaveLength(2)
    expect(calls[0]).toEqual({ from: 0, to: 999 })
    expect(calls[1]).toEqual({ from: 1000, to: 1999 })
  })

  it('pages through 2500 rows across 3 pages', async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => ({ id: i }))
    const { buildQuery, calls } = makeRowSource(rows)
    const result = await fetchAllPaginated<{ id: number }>(buildQuery)
    expect(result).toHaveLength(2500)
    expect(calls).toHaveLength(3)
    expect(calls[2]).toEqual({ from: 2000, to: 2999 })
  })

  it('honors custom pageSize', async () => {
    const rows = Array.from({ length: 1200 }, (_, i) => ({ id: i }))
    const { buildQuery, calls } = makeRowSource(rows)
    const result = await fetchAllPaginated<{ id: number }>(buildQuery, { pageSize: 500 })
    expect(result).toHaveLength(1200)
    expect(calls).toHaveLength(3)
    expect(calls[0]).toEqual({ from: 0, to: 499 })
    expect(calls[1]).toEqual({ from: 500, to: 999 })
    expect(calls[2]).toEqual({ from: 1000, to: 1499 })
  })

  it('throws when an error is returned mid-loop and does not return partial', async () => {
    const { buildQuery, calls } = makeErrorSource(1)
    await expect(fetchAllPaginated<{ id: number }>(buildQuery)).rejects.toMatchObject({
      message: 'simulated postgrest error',
    })
    expect(calls()).toEqual([0, 1])
  })

  it('throws when maxPages is exceeded', async () => {
    // Source returns full pages forever. With pageSize=10 and maxPages=3 we
    // should bail after the third successful page (since the loop never
    // sees a short page).
    const rows = Array.from({ length: 1000 }, (_, i) => ({ id: i }))
    const { buildQuery } = makeRowSource(rows)
    await expect(
      fetchAllPaginated<{ id: number }>(buildQuery, { pageSize: 10, maxPages: 3 }),
    ).rejects.toThrow(/maxPages/)
  })

  it('rejects pageSize <= 0', async () => {
    const { buildQuery } = makeRowSource<{ id: number }>([])
    await expect(
      fetchAllPaginated<{ id: number }>(buildQuery, { pageSize: 0 }),
    ).rejects.toThrow(/pageSize/)
  })

  it('rejects maxPages <= 0', async () => {
    const { buildQuery } = makeRowSource<{ id: number }>([])
    await expect(
      fetchAllPaginated<{ id: number }>(buildQuery, { maxPages: 0 }),
    ).rejects.toThrow(/maxPages/)
  })
})
