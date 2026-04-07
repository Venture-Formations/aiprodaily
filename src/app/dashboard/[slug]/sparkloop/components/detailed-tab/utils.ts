import type { Recommendation } from './types'

export const fmtDollars = (value: number) =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const getColumnWidthClass = (width?: 'xs' | 'sm' | 'md' | 'lg') => {
  switch (width) {
    case 'xs': return 'w-14 min-w-[3.5rem] max-w-[4rem]'
    case 'sm': return 'w-20 min-w-[5rem] max-w-[6rem]'
    case 'md': return 'w-28 min-w-[7rem] max-w-[8rem]'
    case 'lg': return 'w-44 min-w-[11rem] max-w-[14rem]'
    default: return 'w-24'
  }
}

export const getSourceColor = (source: string) => {
  if (source === 'override_with_data' || source === 'override_with_sl') return 'text-red-600 font-medium'
  if (source === 'override') return 'text-orange-600 font-medium'
  if (source === 'ours') return 'text-blue-600 font-medium'
  return ''
}

/** Check if an active rec is excluded from the popup */
export const getPopupExclusionReason = (rec: Recommendation): string | null => {
  if (rec.excluded || rec.status !== 'active') return null
  if (!rec.cpa || rec.cpa <= 0) return 'no CPA'
  if (rec.submission_capped) return 'sub capped'
  return null
}

export const getColumnValue = (rec: Recommendation, key: string): string => {
  const value = rec[key as keyof Recommendation]
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'

  // Currency formatting for export
  if (key === 'cpa' || key === 'max_payout') {
    return ((value as number) / 100).toFixed(2)
  }
  if (key === 'sparkloop_earnings' || key === 'sparkloop_net_earnings') {
    return ((value as number) / 100).toFixed(2)
  }
  if (key === 'calculated_score') {
    return (value as number).toFixed(4)
  }
  if (key === 'our_cr' || key === 'our_rcr' || key === 'sparkloop_rcr' || key === 'effective_cr' || key === 'effective_rcr' || key === 'page_cr' || key === 'rcr_14d' || key === 'rcr_30d' || key === 'slippage_14d' || key === 'slippage_30d') {
    return `${(value as number).toFixed(1)}%`
  }
  if (key === 'remaining_budget_dollars') {
    return (value as number).toFixed(2)
  }

  return String(value)
}
