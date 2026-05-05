import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  toLocalDateStr,
  toProjectDateStr,
  buildDateRangeBoundaries,
  getTodayStr,
  getDaysAgoStr,
  getTomorrowStr,
} from '../date-utils'

// vitest.config.ts pins TZ=UTC, so server-local time === UTC in tests.

describe('toLocalDateStr', () => {
  it('formats a Date as YYYY-MM-DD using local parts', () => {
    expect(toLocalDateStr(new Date('2025-06-15T12:00:00Z'))).toBe('2025-06-15')
  })

  it('zero-pads single-digit months and days', () => {
    expect(toLocalDateStr(new Date('2025-01-05T12:00:00Z'))).toBe('2025-01-05')
  })
})

describe('toProjectDateStr', () => {
  it('returns the CT calendar date for a UTC timestamp during CDT', () => {
    // 2025-06-15 04:30 UTC === 2025-06-14 23:30 CDT (UTC-5)
    expect(toProjectDateStr('2025-06-15T04:30:00Z')).toBe('2025-06-14')
  })

  it('returns the CT calendar date for a UTC timestamp during CST', () => {
    // 2025-01-01 05:30 UTC === 2024-12-31 23:30 CST (UTC-6)
    expect(toProjectDateStr('2025-01-01T05:30:00Z')).toBe('2024-12-31')
  })

  it('handles same-day midday UTC timestamps', () => {
    expect(toProjectDateStr('2025-06-15T18:00:00Z')).toBe('2025-06-15')
  })
})

describe('getTodayStr / getTomorrowStr — fake-time', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('getTodayStr("UTC") matches the current UTC date', () => {
    vi.setSystemTime(new Date('2025-06-15T18:00:00Z'))
    expect(getTodayStr('UTC')).toBe('2025-06-15')
  })

  it('getTodayStr("CST") returns the prior CT date when UTC is shortly past midnight', () => {
    // 2025-06-15 04:30 UTC === 2025-06-14 23:30 CDT
    vi.setSystemTime(new Date('2025-06-15T04:30:00Z'))
    expect(getTodayStr('CST')).toBe('2025-06-14')
    expect(getTodayStr('UTC')).toBe('2025-06-15')
  })

  it('getTomorrowStr("CST") rolls over at CT midnight, not UTC midnight', () => {
    // 23:55 CDT on 2025-06-15 === 04:55 UTC on 2025-06-16
    // "Today in CT" is 2025-06-15, so tomorrow in CT = 2025-06-16
    vi.setSystemTime(new Date('2025-06-16T04:55:00Z'))
    expect(getTomorrowStr('CST')).toBe('2025-06-16')
  })

  it('getTomorrowStr("UTC") returns the next UTC calendar day', () => {
    vi.setSystemTime(new Date('2025-06-15T23:30:00Z'))
    expect(getTomorrowStr('UTC')).toBe('2025-06-16')
  })

  it('getTomorrowStr handles month rollover', () => {
    vi.setSystemTime(new Date('2025-01-31T18:00:00Z'))
    expect(getTomorrowStr('UTC')).toBe('2025-02-01')
  })

  it('getTomorrowStr handles year rollover', () => {
    vi.setSystemTime(new Date('2024-12-31T18:00:00Z'))
    expect(getTomorrowStr('UTC')).toBe('2025-01-01')
  })

  it('getTomorrowStr("CST") is DST-safe across spring-forward', () => {
    // 2025-03-09 18:00 UTC === 2025-03-09 13:00 CDT (already after spring-forward)
    // Tomorrow should still be 2025-03-10 in CT calendar terms.
    vi.setSystemTime(new Date('2025-03-09T18:00:00Z'))
    expect(getTomorrowStr('CST')).toBe('2025-03-10')
  })
})

describe('getDaysAgoStr', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T18:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('subtracts whole days in UTC', () => {
    expect(getDaysAgoStr(7, 'UTC')).toBe('2025-06-08')
  })

  it('subtracts whole days in CST', () => {
    // 2025-06-15 18:00 UTC === 2025-06-15 13:00 CDT; minus 7 days === 2025-06-08
    expect(getDaysAgoStr(7, 'CST')).toBe('2025-06-08')
  })

  it('returns today for days=0', () => {
    expect(getDaysAgoStr(0, 'UTC')).toBe('2025-06-15')
  })
})

describe('buildDateRangeBoundaries', () => {
  it('UTC: midnight-to-end-of-day', () => {
    const { startDate, endDate } = buildDateRangeBoundaries('2025-06-01', '2025-06-30', 'UTC')
    expect(startDate.toISOString()).toBe('2025-06-01T00:00:00.000Z')
    expect(endDate.toISOString()).toBe('2025-06-30T23:59:59.999Z')
  })

  it('CST during summer (CDT, UTC-5): start = midnight CDT', () => {
    // CDT is UTC-5, so midnight CDT === 05:00 UTC
    const { startDate, endDate } = buildDateRangeBoundaries('2025-06-01', '2025-06-30', 'CST')
    expect(startDate.toISOString()).toBe('2025-06-01T05:00:00.000Z')
    expect(endDate.toISOString()).toBe('2025-07-01T04:59:59.999Z')
  })

  it('CST during winter (CST, UTC-6): start = midnight CST', () => {
    // CST is UTC-6, so midnight CST === 06:00 UTC
    const { startDate, endDate } = buildDateRangeBoundaries('2025-01-01', '2025-01-31', 'CST')
    expect(startDate.toISOString()).toBe('2025-01-01T06:00:00.000Z')
    expect(endDate.toISOString()).toBe('2025-02-01T05:59:59.999Z')
  })

  it('CST across spring-forward boundary (Mar 9 2025) — uses post-DST offset', () => {
    // The implementation probes at noon UTC, which on spring-forward day already
    // sees CDT (UTC-5). The whole local day is treated as CDT. This means
    // 00:00 "local" maps to 05:00 UTC even though the real wall-clock midnight
    // was in CST (06:00 UTC). Acceptable for analytics use; documented here so
    // future contributors don't regress this trade-off.
    const { startDate, endDate } = buildDateRangeBoundaries('2025-03-09', '2025-03-11', 'CST')
    expect(startDate.toISOString()).toBe('2025-03-09T05:00:00.000Z')
    expect(endDate.toISOString()).toBe('2025-03-12T04:59:59.999Z')
  })

  it('CST across fall-back boundary (Nov 2 2025) — uses post-DST offset', () => {
    // Same noon-UTC probe behavior: on fall-back day, noon UTC is already in
    // CST (UTC-6), so the whole local day is treated as CST. 00:00 "local"
    // maps to 06:00 UTC even though wall-clock midnight was in CDT (05:00 UTC).
    const { startDate, endDate } = buildDateRangeBoundaries('2025-11-02', '2025-11-03', 'CST')
    expect(startDate.toISOString()).toBe('2025-11-02T06:00:00.000Z')
    expect(endDate.toISOString()).toBe('2025-11-04T05:59:59.999Z')
  })
})
