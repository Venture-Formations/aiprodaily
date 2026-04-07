'use client'

import type { Recommendation, GlobalStats, RangeStats, DateRangeMetrics } from './types'

interface GlobalStatsBarProps {
  globalStats: GlobalStats
  dateRangeActive: boolean
  rangeStats: RangeStats | null
  dateStart: string
  dateEnd: string
  dateRangeMetrics: Record<string, DateRangeMetrics> | null
  recommendations: Recommendation[]
}

export function GlobalStatsBar({
  globalStats,
  dateRangeActive,
  rangeStats,
  dateStart,
  dateEnd,
  dateRangeMetrics,
  recommendations,
}: GlobalStatsBarProps) {
  return (
    <div className="flex gap-4 mb-4 text-xs text-gray-600">
      <span>Global Unique IPs: <strong>{globalStats.uniqueIps}</strong></span>
      {dateRangeActive && rangeStats && (
        <>
          <span className="text-purple-600">Unique IPs ({dateStart} to {dateEnd}): <strong>{rangeStats.uniqueIps}</strong></span>
          <span className="text-purple-600">Avg Offers Selected: <strong>{rangeStats.avgOffersSelected.toFixed(1)}</strong></span>
          {rangeStats.avgValuePerSubscriber !== undefined && (
            <span className="text-purple-600">Avg Value/Sub: <strong>${rangeStats.avgValuePerSubscriber.toFixed(2)}</strong></span>
          )}
          {rangeStats.uniqueSubscribers !== undefined && dateRangeMetrics && (() => {
            // Est. Value/Sub: sum of (submissions x CPA x RCR x (1 - slip) x 0.767) / unique subs
            let estTotal = 0
            for (const rec of recommendations) {
              const drm = dateRangeMetrics[rec.ref_code]
              if (!drm) continue
              const popupSubs = drm.submissions || 0
              const pageSubs = drm.page_submissions || 0
              if (popupSubs + pageSubs === 0) continue
              const cpaDollars = (rec.cpa || 0) / 100
              // RCR: 30D > SL > default
              const rcr30d = rec.rcr_30d !== null ? rec.rcr_30d / 100 : null
              const slRcr = rec.sparkloop_rcr !== null ? Number(rec.sparkloop_rcr) / 100 : null
              const rcr = rcr30d ?? (slRcr && slRcr > 0 ? slRcr : 0.25)
              // Uses all-time effective_slip (no range-specific slip available from API)
              const slip = rec.effective_slip / 100
              const valuePerSend = cpaDollars * rcr * (1 - slip) * 0.767
              estTotal += (popupSubs + pageSubs) * valuePerSend
            }
            const estValuePerSub = rangeStats.uniqueSubscribers! > 0
              ? estTotal / rangeStats.uniqueSubscribers!
              : 0
            return (
              <span className="text-purple-600">Est. Value/Sub: <strong>${estValuePerSub.toFixed(2)}</strong></span>
            )
          })()}
          {rangeStats.uniqueSubscribers !== undefined && (
            <span className="text-purple-600">Unique Subs: <strong>{rangeStats.uniqueSubscribers}</strong></span>
          )}
          {rangeStats.uniqueSends !== undefined && (
            <span className="text-purple-600">Unique Sends: <strong>{rangeStats.uniqueSends}</strong></span>
          )}
        </>
      )}
      {!dateRangeActive && (
        <span>Avg Offers Selected: <strong>{globalStats.avgOffersSelected.toFixed(1)}</strong></span>
      )}
    </div>
  )
}
