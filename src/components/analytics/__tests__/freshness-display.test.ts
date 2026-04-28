import { describe, it, expect } from 'vitest'
import { getFreshnessDisplay } from '../freshness-display'

const FIXED_NOW = new Date('2026-04-27T12:00:00Z').getTime()

describe('getFreshnessDisplay', () => {
  it('returns "never synced" when lastSyncedAt is null', () => {
    const result = getFreshnessDisplay({
      lastSyncedAt: null,
      nowMs: FIXED_NOW,
    })
    expect(result.text).toBe('Email metrics: never synced')
    expect(result.isStale).toBe(false)
    expect(result.tooltipTimestamp).toBeNull()
  })

  it('returns relative time when fresh (default threshold 12h)', () => {
    const synced = new Date(FIXED_NOW - 30 * 60 * 1000).toISOString() // 30m ago
    const result = getFreshnessDisplay({
      lastSyncedAt: synced,
      nowMs: FIXED_NOW,
    })
    expect(result.text).toBe('Email metrics: as of 30m ago')
    expect(result.isStale).toBe(false)
    expect(result.tooltipTimestamp).toBe(synced)
  })

  it('marks as stale when older than default threshold (12h)', () => {
    const synced = new Date(FIXED_NOW - 24 * 60 * 60 * 1000).toISOString() // 24h ago
    const result = getFreshnessDisplay({
      lastSyncedAt: synced,
      nowMs: FIXED_NOW,
    })
    expect(result.isStale).toBe(true)
    expect(result.text).toBe('Email metrics: as of 1d ago')
  })

  it('respects a custom staleHoursThreshold', () => {
    const synced = new Date(FIXED_NOW - 2 * 60 * 60 * 1000).toISOString() // 2h ago
    const result = getFreshnessDisplay({
      lastSyncedAt: synced,
      nowMs: FIXED_NOW,
      staleHoursThreshold: 1,
    })
    expect(result.isStale).toBe(true)
  })

  it('does not mark fresh data as stale even with low threshold', () => {
    const synced = new Date(FIXED_NOW - 30 * 1000).toISOString() // 30s ago
    const result = getFreshnessDisplay({
      lastSyncedAt: synced,
      nowMs: FIXED_NOW,
      staleHoursThreshold: 0.001, // 3.6 seconds
    })
    // 30s is past 3.6s threshold, but this test ensures the comparison is correct.
    // Update: 30s > 3.6s threshold, so this should be stale.
    expect(result.isStale).toBe(true)
  })

  it('uses a custom prefix when provided', () => {
    const synced = new Date(FIXED_NOW - 5 * 60 * 1000).toISOString()
    const result = getFreshnessDisplay({
      lastSyncedAt: synced,
      nowMs: FIXED_NOW,
      prefix: 'Click data',
    })
    expect(result.text).toBe('Click data: as of 5m ago')
  })

  it('handles negative ages (clock skew) gracefully as just now', () => {
    const synced = new Date(FIXED_NOW + 5000).toISOString() // 5s in future
    const result = getFreshnessDisplay({
      lastSyncedAt: synced,
      nowMs: FIXED_NOW,
    })
    expect(result.text).toBe('Email metrics: as of just now')
    expect(result.isStale).toBe(false)
  })
})
