import type { Column } from './types'

export const MS_PER_DAY = 86400000

export const STATUS_FILTERS = ['all', 'active', 'excluded', 'paused', 'archived'] as const

export const DEFAULT_COLUMNS: Column[] = [
  { key: 'publication_name', label: 'Newsletter', enabled: true, exportable: true, width: 'lg' },
  { key: 'ref_code', label: 'Ref Code', enabled: false, exportable: true, width: 'md' },
  { key: 'type', label: 'Type', enabled: false, exportable: true, width: 'xs' },
  { key: 'status', label: 'Status', enabled: true, exportable: true, width: 'sm' },
  { key: 'cpa', label: 'CPA', enabled: true, exportable: true, width: 'xs' },
  { key: 'screening_period', label: 'Screening', enabled: false, exportable: true, width: 'xs' },
  { key: 'sparkloop_rcr', label: 'SL RCR', enabled: true, exportable: true, width: 'sm' },
  { key: 'rcr_14d', label: '14D RCR', enabled: true, exportable: true, width: 'sm' },
  { key: 'rcr_30d', label: '30D RCR', enabled: true, exportable: true, width: 'sm' },
  { key: 'our_rcr', label: 'Our RCR', enabled: false, exportable: true, width: 'sm' },
  { key: 'effective_rcr', label: 'Eff. RCR', enabled: false, exportable: true, width: 'sm' },
  { key: 'rcr_source', label: 'RCR Source', enabled: false, exportable: true, width: 'sm' },
  { key: 'our_cr', label: 'Popup CR', enabled: true, exportable: true, width: 'sm' },
  { key: 'page_cr', label: 'Page CR', enabled: true, exportable: true, width: 'sm' },
  { key: 'effective_cr', label: 'Eff. CR', enabled: false, exportable: true, width: 'sm' },
  { key: 'cr_source', label: 'CR Source', enabled: false, exportable: true, width: 'sm' },
  { key: 'calculated_score', label: 'Score', enabled: true, exportable: true, width: 'sm' },
  { key: 'impressions', label: 'Popup Impr', enabled: true, exportable: true, width: 'xs' },
  { key: 'submissions', label: 'Popup Subs', enabled: true, exportable: true, width: 'xs' },
  { key: 'page_impressions', label: 'Page Impr', enabled: true, exportable: true, width: 'xs' },
  { key: 'page_submissions', label: 'Page Subs', enabled: true, exportable: true, width: 'xs' },
  { key: 'our_confirms', label: 'Our Conf', enabled: true, exportable: true, width: 'xs' },
  { key: 'our_rejections', label: 'Our Rej', enabled: true, exportable: true, width: 'xs' },
  { key: 'our_pending', label: 'Our Pend', enabled: true, exportable: true, width: 'xs' },
  { key: 'slippage_14d', label: '14D Slip%', enabled: true, exportable: true, width: 'sm' },
  { key: 'slippage_30d', label: '30D Slip%', enabled: true, exportable: true, width: 'sm' },
  { key: 'alltime_slip', label: 'AT Slip%', enabled: true, exportable: true, width: 'sm' },
  { key: 'sparkloop_confirmed', label: 'SL Confirmed', enabled: false, exportable: true, width: 'xs' },
  { key: 'sparkloop_rejected', label: 'SL Rejected', enabled: false, exportable: true, width: 'xs' },
  { key: 'sparkloop_pending', label: 'SL Pending', enabled: false, exportable: true, width: 'xs' },
  { key: 'sparkloop_earnings', label: 'Earnings', enabled: true, exportable: true, width: 'sm' },
  { key: 'sparkloop_net_earnings', label: 'Net Earnings', enabled: false, exportable: true, width: 'sm' },
  { key: 'remaining_budget_dollars', label: 'Budget Left', enabled: true, exportable: true, width: 'sm' },
  { key: 'max_payout', label: 'Max Payout', enabled: false, exportable: true, width: 'sm' },
  { key: 'unique_subs', label: 'Unique Subs', enabled: true, exportable: true, width: 'xs' },
  { key: 'excluded', label: 'Excluded', enabled: false, exportable: true, width: 'xs' },
  { key: 'excluded_reason', label: 'Excl. Reason', enabled: false, exportable: true, width: 'md' },
  { key: 'eligible_for_module', label: 'Module', enabled: true, exportable: true, width: 'xs' },
  { key: 'last_synced_at', label: 'Last Synced', enabled: false, exportable: true, width: 'md' },
]

// Columns that get overridden when date range is active
export const DATE_FILTERED_COLUMNS = new Set([
  'impressions', 'submissions', 'our_cr', 'our_confirms',
  'our_rejections', 'our_pending', 'page_impressions',
  'page_submissions', 'page_cr',
])
