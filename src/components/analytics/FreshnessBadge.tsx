'use client'

import { useEffect, useState } from 'react'
import { getFreshnessDisplay } from './freshness-display'

interface FreshnessBadgeProps {
  /** ISO timestamp of the most recent sync, or null if never synced. */
  lastSyncedAt: string | null
  /** Hours-old threshold beyond which the badge renders with a warning color. Default 12. */
  staleHoursThreshold?: number
  /** Label prefix shown before the relative time. Default "Email metrics". */
  prefix?: string
}

/**
 * Renders "<prefix>: as of Xm ago" with a tooltip showing the full timestamp.
 * Re-renders every 60 seconds so the relative time stays current without a refetch.
 *
 * Stale styling (amber) kicks in past staleHoursThreshold.
 *
 * Display logic lives in getFreshnessDisplay (freshness-display.ts) and is
 * unit-tested separately.
 */
export function FreshnessBadge({
  lastSyncedAt,
  staleHoursThreshold,
  prefix,
}: FreshnessBadgeProps) {
  const [now, setNow] = useState<number>(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(interval)
  }, [])

  const display = getFreshnessDisplay({
    lastSyncedAt,
    nowMs: now,
    staleHoursThreshold,
    prefix,
  })

  const colorClass = display.isStale ? 'text-amber-600' : 'text-gray-500'
  const tooltipText = display.tooltipTimestamp
    ? new Date(display.tooltipTimestamp).toLocaleString()
    : 'No sync recorded'

  return (
    <span className={`text-xs ${colorClass}`} title={tooltipText}>
      {display.text}
    </span>
  )
}
