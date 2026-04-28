import { formatAge } from './format-age'

export interface FreshnessDisplayInput {
  /** ISO timestamp of the most recent sync, or null if never synced. */
  lastSyncedAt: string | null
  /** Current time in ms epoch. Passed in to keep the function pure. */
  nowMs: number
  /** Hours-old threshold beyond which data is considered stale. Default 12. */
  staleHoursThreshold?: number
  /** Label prefix shown before the relative time. Default "Email metrics". */
  prefix?: string
}

export interface FreshnessDisplayResult {
  /** The fully formatted text to display, e.g. "Email metrics: as of 30m ago". */
  text: string
  /** True if the data is older than the staleness threshold. */
  isStale: boolean
  /** ISO timestamp for tooltip display, or null when never synced. */
  tooltipTimestamp: string | null
}

/**
 * Pure helper that computes the display state for a FreshnessBadge.
 * Exposed separately so it can be unit-tested without a DOM.
 */
export function getFreshnessDisplay(input: FreshnessDisplayInput): FreshnessDisplayResult {
  const {
    lastSyncedAt,
    nowMs,
    staleHoursThreshold = 12,
    prefix = 'Email metrics',
  } = input

  if (!lastSyncedAt) {
    return {
      text: `${prefix}: never synced`,
      isStale: false,
      tooltipTimestamp: null,
    }
  }

  const syncedTime = new Date(lastSyncedAt).getTime()
  const ageMs = Math.max(0, nowMs - syncedTime)
  const ageHours = ageMs / (1000 * 60 * 60)
  const isStale = ageHours > staleHoursThreshold

  return {
    text: `${prefix}: as of ${formatAge(ageMs)}`,
    isStale,
    tooltipTimestamp: lastSyncedAt,
  }
}
