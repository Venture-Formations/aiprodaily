'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Download, Settings2, Search, X, Calendar, Ban, Pause, Play, Pencil, RefreshCw, CheckCircle, Check } from 'lucide-react'

interface Recommendation {
  id: string
  ref_code: string
  publication_name: string
  publication_logo: string | null
  description: string | null
  type: 'free' | 'paid'
  status: 'active' | 'paused'
  cpa: number | null
  sparkloop_rcr: number | null
  max_payout: number | null
  screening_period: number | null
  excluded: boolean
  excluded_reason: string | null
  paused_reason: string | null
  impressions: number
  submissions: number
  confirms: number
  rejections: number
  our_cr: number | null
  our_rcr: number | null
  sparkloop_confirmed: number
  sparkloop_pending: number
  sparkloop_rejected: number
  sparkloop_earnings: number
  sparkloop_net_earnings: number
  our_total_subscribes: number
  our_confirms: number
  our_rejections: number
  our_pending: number
  remaining_budget_dollars: number | null
  last_synced_at: string | null
  calculated_score: number
  effective_cr: number
  effective_rcr: number
  cr_source: string
  rcr_source: string
  unique_ips: number
  override_cr: number | null
  override_rcr: number | null
  submission_capped?: boolean
  page_impressions: number
  page_submissions: number
  page_cr: number | null
  rcr_14d: number | null
  rcr_30d: number | null
  slippage_14d: number | null
  slippage_30d: number | null
  sends_14d: number
  sends_30d: number
  confirms_gained_14d: number
  confirms_gained_30d: number
  eligible_for_module: boolean
}

interface GlobalStats {
  uniqueIps: number
  avgOffersSelected: number
}

interface Column {
  key: string
  label: string
  enabled: boolean
  exportable: boolean
  width?: 'xs' | 'sm' | 'md' | 'lg'
}

interface Defaults {
  cr: number
  rcr: number
}

interface DetailedTabProps {
  recommendations: Recommendation[]
  globalStats: GlobalStats | null
  defaults: Defaults
  loading: boolean
  onRefresh: () => void
}

interface DateRangeMetrics {
  impressions: number
  submissions: number
  confirms: number
  rejections: number
  pending: number
  page_impressions: number
  page_submissions: number
}

interface RangeStats {
  uniqueIps: number
  avgOffersSelected: number
}

const DEFAULT_COLUMNS: Column[] = [
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
  { key: 'sparkloop_confirmed', label: 'SL Confirmed', enabled: false, exportable: true, width: 'xs' },
  { key: 'sparkloop_rejected', label: 'SL Rejected', enabled: false, exportable: true, width: 'xs' },
  { key: 'sparkloop_pending', label: 'SL Pending', enabled: false, exportable: true, width: 'xs' },
  { key: 'sparkloop_earnings', label: 'Earnings', enabled: true, exportable: true, width: 'sm' },
  { key: 'sparkloop_net_earnings', label: 'Net Earnings', enabled: false, exportable: true, width: 'sm' },
  { key: 'remaining_budget_dollars', label: 'Budget Left', enabled: true, exportable: true, width: 'sm' },
  { key: 'max_payout', label: 'Max Payout', enabled: false, exportable: true, width: 'sm' },
  { key: 'unique_ips', label: 'Unique IPs', enabled: true, exportable: true, width: 'xs' },
  { key: 'excluded', label: 'Excluded', enabled: false, exportable: true, width: 'xs' },
  { key: 'excluded_reason', label: 'Excl. Reason', enabled: false, exportable: true, width: 'md' },
  { key: 'eligible_for_module', label: 'Module', enabled: true, exportable: true, width: 'xs' },
  { key: 'last_synced_at', label: 'Last Synced', enabled: false, exportable: true, width: 'md' },
]

// Columns that get overridden when date range is active
const DATE_FILTERED_COLUMNS = new Set(['impressions', 'submissions', 'our_cr', 'our_confirms', 'our_rejections', 'our_pending', 'page_impressions', 'page_submissions', 'page_cr'])

const fmtDollars = (value: number) =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const getColumnWidthClass = (width?: 'xs' | 'sm' | 'md' | 'lg') => {
  switch (width) {
    case 'xs': return 'w-14 min-w-[3.5rem] max-w-[4rem]'
    case 'sm': return 'w-20 min-w-[5rem] max-w-[6rem]'
    case 'md': return 'w-28 min-w-[7rem] max-w-[8rem]'
    case 'lg': return 'w-44 min-w-[11rem] max-w-[14rem]'
    default: return 'w-24'
  }
}

export default function DetailedTab({ recommendations, globalStats, defaults, loading, onRefresh }: DetailedTabProps) {
  const [columns, setColumns] = useState<Column[]>(DEFAULT_COLUMNS)
  const [sortColumn, setSortColumn] = useState<string | null>('calculated_score')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'excluded' | 'paused'>('all')

  // Date range state
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [dateRangeMetrics, setDateRangeMetrics] = useState<Record<string, DateRangeMetrics> | null>(null)
  const [dateRangeLoading, setDateRangeLoading] = useState(false)
  const [rangeStats, setRangeStats] = useState<RangeStats | null>(null)

  // Action state
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Override modal state
  const [overrideRec, setOverrideRec] = useState<Recommendation | null>(null)
  const [overrideCrValue, setOverrideCrValue] = useState('')
  const [overrideRcrValue, setOverrideRcrValue] = useState('')
  const [overrideSaving, setOverrideSaving] = useState(false)

  // Default CR/RCR editing state
  const [editingDefaultCr, setEditingDefaultCr] = useState(false)
  const [editingDefaultRcr, setEditingDefaultRcr] = useState(false)
  const [defaultCrInput, setDefaultCrInput] = useState('')
  const [defaultRcrInput, setDefaultRcrInput] = useState('')
  const [defaultSaving, setDefaultSaving] = useState(false)

  const dateRangeActive = dateRangeMetrics !== null

  // Fetch date range metrics when dates change
  useEffect(() => {
    if (!dateStart || !dateEnd) {
      setDateRangeMetrics(null)
      setRangeStats(null)
      return
    }

    // Validate: start <= end
    if (dateStart > dateEnd) return

    const fetchDateRange = async () => {
      setDateRangeLoading(true)
      try {
        const res = await fetch(`/api/sparkloop/admin/daterange?start=${dateStart}&end=${dateEnd}`)
        const data = await res.json()
        if (data.success) {
          setDateRangeMetrics(data.metrics)
          setRangeStats(data.rangeStats || null)
        }
      } catch (error) {
        console.error('Failed to fetch date range metrics:', error)
      }
      setDateRangeLoading(false)
    }
    fetchDateRange()
  }, [dateStart, dateEnd])

  const clearDateRange = useCallback(() => {
    setDateStart('')
    setDateEnd('')
    setDateRangeMetrics(null)
    setRangeStats(null)
  }, [])

  const setQuickRange = useCallback((days: number) => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - days + 1)
    setDateStart(start.toISOString().split('T')[0])
    setDateEnd(end.toISOString().split('T')[0])
  }, [])

  const enabledColumns = columns.filter(col => col.enabled)

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(columnKey)
      setSortDirection('desc')
    }
  }

  const toggleColumn = (key: string) => {
    setColumns(columns.map(col =>
      col.key === key ? { ...col, enabled: !col.enabled } : col
    ))
  }

  // Apply date range overrides to recommendations before filtering/sorting
  const effectiveRecommendations = useMemo(() => {
    if (!dateRangeMetrics) return recommendations
    return recommendations.map(rec => {
      const drm = dateRangeMetrics[rec.ref_code]
      const impr = drm?.impressions ?? 0
      const subs = drm?.submissions ?? 0
      const pageImpr = drm?.page_impressions ?? 0
      const pageSubs = drm?.page_submissions ?? 0
      // Calculate CRs from date-filtered data
      const crForRange = impr > 0 ? Math.round((subs / impr) * 10000) / 100 : null
      const pageCrForRange = pageImpr > 0 ? Math.round((pageSubs / pageImpr) * 10000) / 100 : null
      return {
        ...rec,
        impressions: impr,
        submissions: subs,
        our_cr: crForRange,
        page_impressions: pageImpr,
        page_submissions: pageSubs,
        page_cr: pageCrForRange,
        our_confirms: drm?.confirms ?? 0,
        our_rejections: drm?.rejections ?? 0,
        our_pending: drm?.pending ?? 0,
      }
    })
  }, [recommendations, dateRangeMetrics])

  const filteredAndSorted = useMemo(() => {
    let result = [...effectiveRecommendations]

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(r =>
        r.publication_name.toLowerCase().includes(q) ||
        r.ref_code.toLowerCase().includes(q)
      )
    }

    // Status filter
    if (statusFilter === 'active') {
      result = result.filter(r => r.status === 'active' && !r.excluded)
    } else if (statusFilter === 'excluded') {
      result = result.filter(r => r.excluded)
    } else if (statusFilter === 'paused') {
      result = result.filter(r => r.status === 'paused' && !r.excluded)
    }

    // Sort
    if (sortColumn) {
      result.sort((a, b) => {
        // Status column: sort by the effective display label (what's in the badge)
        if (sortColumn === 'status') {
          const getStatusLabel = (r: Recommendation) => {
            if (r.excluded) return r.excluded_reason || 'excluded'
            if (r.status === 'paused') return r.paused_reason || 'paused'
            return 'active'
          }
          const strA = getStatusLabel(a).toLowerCase()
          const strB = getStatusLabel(b).toLowerCase()
          return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA)
        }

        const aVal = a[sortColumn as keyof Recommendation]
        const bVal = b[sortColumn as keyof Recommendation]

        if (aVal === null || aVal === undefined || aVal === '') {
          return sortDirection === 'asc' ? 1 : -1
        }
        if (bVal === null || bVal === undefined || bVal === '') {
          return sortDirection === 'asc' ? -1 : 1
        }

        // Date columns
        if (sortColumn === 'last_synced_at') {
          const dateA = new Date(aVal as string).getTime()
          const dateB = new Date(bVal as string).getTime()
          return sortDirection === 'asc' ? dateA - dateB : dateB - dateA
        }

        // Numbers
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
        }

        // Boolean
        if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
          return sortDirection === 'asc'
            ? (aVal === bVal ? 0 : aVal ? 1 : -1)
            : (aVal === bVal ? 0 : aVal ? -1 : 1)
        }

        // Strings
        const strA = String(aVal).toLowerCase()
        const strB = String(bVal).toLowerCase()
        return sortDirection === 'asc'
          ? strA.localeCompare(strB)
          : strB.localeCompare(strA)
      })
    }

    return result
  }, [effectiveRecommendations, searchQuery, statusFilter, sortColumn, sortDirection])

  // --- Action handlers ---
  async function handlePause(rec: Recommendation) {
    setActionLoading(rec.id)
    try {
      const res = await fetch('/api/sparkloop/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rec.id, action: 'pause' }),
      })
      const data = await res.json()
      if (data.success) {
        onRefresh()
      } else {
        alert('Pause failed: ' + data.error)
      }
    } catch {
      alert('Pause failed')
    }
    setActionLoading(null)
  }

  async function handleExclude(rec: Recommendation) {
    setActionLoading(rec.id)
    try {
      const res = await fetch('/api/sparkloop/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rec.id, excluded: true, excluded_reason: 'manual' }),
      })
      const data = await res.json()
      if (data.success) {
        onRefresh()
      } else {
        alert('Exclude failed: ' + data.error)
      }
    } catch {
      alert('Exclude failed')
    }
    setActionLoading(null)
  }

  async function handleReactivate(rec: Recommendation) {
    setActionLoading(rec.id)
    try {
      // If excluded, un-exclude. If paused, unpause.
      const body = rec.excluded
        ? { id: rec.id, excluded: false }
        : { id: rec.id, action: 'unpause' }
      const res = await fetch('/api/sparkloop/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        onRefresh()
      } else {
        alert('Reactivate failed: ' + data.error)
      }
    } catch {
      alert('Reactivate failed')
    }
    setActionLoading(null)
  }

  async function bulkAction(action: 'exclude' | 'reactivate' | 'pause') {
    if (selectedIds.size === 0) return

    const reason = action === 'exclude' ? prompt('Exclusion reason (e.g., budget_used_up):') : null
    if (action === 'exclude' && reason === null) return

    setActionLoading('bulk')
    try {
      const res = await fetch('/api/sparkloop/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ids: Array.from(selectedIds),
          excluded_reason: reason,
        }),
      })
      const data = await res.json()
      if (data.success) {
        const label = action === 'exclude' ? 'Excluded' : action === 'pause' ? 'Paused' : 'Reactivated'
        alert(`${label} ${data.updated} recommendations`)
        setSelectedIds(new Set())
        onRefresh()
      } else {
        alert('Bulk update failed: ' + data.error)
      }
    } catch {
      alert('Bulk update failed')
    }
    setActionLoading(null)
  }

  async function handleToggleModuleEligible(rec: Recommendation) {
    try {
      const res = await fetch('/api/sparkloop/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rec.id, action: 'toggle_module_eligible', eligible_for_module: !rec.eligible_for_module }),
      })
      const data = await res.json()
      if (data.success) {
        onRefresh()
      }
    } catch {
      // Silent fail - toggle will revert on refresh
    }
  }

  function toggleSelect(id: string) {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  function selectAll() {
    if (selectedIds.size === filteredAndSorted.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredAndSorted.map(r => r.id)))
    }
  }

  // --- Override modal ---
  function openOverrideModal(rec: Recommendation) {
    setOverrideRec(rec)
    setOverrideCrValue(rec.override_cr !== null && rec.override_cr !== undefined ? String(rec.override_cr) : '')
    setOverrideRcrValue(rec.override_rcr !== null && rec.override_rcr !== undefined ? String(rec.override_rcr) : '')
  }

  async function saveOverrides() {
    if (!overrideRec) return
    setOverrideSaving(true)
    try {
      const body: Record<string, unknown> = {
        id: overrideRec.id,
        action: 'set_overrides',
      }
      // Parse CR: empty string = clear (null), otherwise number
      body.override_cr = overrideCrValue.trim() === '' ? null : parseFloat(overrideCrValue)
      body.override_rcr = overrideRcrValue.trim() === '' ? null : parseFloat(overrideRcrValue)

      const res = await fetch('/api/sparkloop/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        setOverrideRec(null)
        onRefresh()
      } else {
        alert('Save failed: ' + data.error)
      }
    } catch {
      alert('Save failed')
    }
    setOverrideSaving(false)
  }

  async function saveDefault(field: 'cr' | 'rcr') {
    const value = field === 'cr' ? defaultCrInput : defaultRcrInput
    const parsed = parseFloat(value)
    if (isNaN(parsed) || parsed < 0 || parsed > 100) {
      alert('Value must be between 0 and 100')
      return
    }
    setDefaultSaving(true)
    try {
      const body: Record<string, unknown> = { action: 'set_defaults' }
      if (field === 'cr') body.default_cr = parsed
      if (field === 'rcr') body.default_rcr = parsed

      const res = await fetch('/api/sparkloop/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        if (field === 'cr') setEditingDefaultCr(false)
        if (field === 'rcr') setEditingDefaultRcr(false)
        onRefresh()
      } else {
        alert('Save failed: ' + data.error)
      }
    } catch {
      alert('Save failed')
    }
    setDefaultSaving(false)
  }

  // Total columns for colSpan = checkbox + enabled columns + actions
  const totalColumns = 2 + enabledColumns.length

  const getColumnValue = (rec: Recommendation, key: string): string => {
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

  const exportToCSV = () => {
    const exportCols = columns.filter(col => col.enabled && col.exportable)
    const headers = exportCols.map(col => col.label).join(',')

    const rows = filteredAndSorted.map(rec => {
      return exportCols.map(col => {
        const value = getColumnValue(rec, col.key)
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      }).join(',')
    })

    const csv = [headers, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `sparkloop-detailed-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getSourceColor = (source: string) => {
    if (source === 'override_with_data' || source === 'override_with_sl') return 'text-red-600 font-medium'
    if (source === 'override') return 'text-orange-600 font-medium'
    if (source === 'ours') return 'text-blue-600 font-medium'
    return ''
  }

  // Check if an active rec is excluded from the popup
  const getPopupExclusionReason = (rec: Recommendation): string | null => {
    if (rec.excluded || rec.status !== 'active') return null
    if (!rec.cpa || rec.cpa <= 0) return 'no CPA'
    if (rec.submission_capped) return 'sub capped'
    return null
  }

  const renderCellContent = (rec: Recommendation, columnKey: string) => {
    switch (columnKey) {
      case 'publication_name': {
        const popupExcluded = getPopupExclusionReason(rec) !== null
        return (
          <div className="flex items-center gap-2">
            {rec.publication_logo && (
              <img src={rec.publication_logo} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
            )}
            <span className="truncate">
              {popupExcluded && <span className="text-gray-400" title="Not in popup">*</span>}
              {rec.publication_name}
            </span>
          </div>
        )
      }

      case 'status': {
        if (rec.excluded) {
          return <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700">{rec.excluded_reason || 'excluded'}</span>
        }
        if (rec.status === 'paused') {
          return <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-yellow-100 text-yellow-700">{rec.paused_reason || 'paused'}</span>
        }
        const popupReason = getPopupExclusionReason(rec)
        return (
          <div>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-green-100 text-green-700">Active</span>
            {popupReason && (
              <div className="text-[9px] text-gray-400 mt-0.5">({popupReason})</div>
            )}
          </div>
        )
      }

      case 'cpa':
        return rec.cpa !== null ? `$${fmtDollars(rec.cpa / 100)}` : '-'

      case 'max_payout':
        return rec.max_payout !== null ? `$${fmtDollars(rec.max_payout / 100)}` : '-'

      case 'screening_period':
        return rec.screening_period ? `${rec.screening_period}d` : '-'

      case 'sparkloop_rcr':
        return rec.sparkloop_rcr !== null ? `${rec.sparkloop_rcr.toFixed(0)}%` : '-'

      case 'our_rcr':
        return rec.our_rcr !== null
          ? <span className="text-blue-600 font-medium">{rec.our_rcr.toFixed(1)}%</span>
          : '-'

      case 'rcr_14d':
        return rec.rcr_14d !== null
          ? <span className="text-green-600 font-medium" title={`${rec.confirms_gained_14d} confirms / ${rec.sends_14d} sends in 14D window`}>{rec.rcr_14d.toFixed(1)}%</span>
          : <span className="text-gray-400" title="Insufficient data (need 14+ days of snapshots and 5+ sends)">-</span>

      case 'rcr_30d':
        return rec.rcr_30d !== null
          ? <span className="text-green-600 font-medium" title={`${rec.confirms_gained_30d} confirms / ${rec.sends_30d} sends in 30D window`}>{rec.rcr_30d.toFixed(1)}%</span>
          : <span className="text-gray-400" title="Insufficient data (need 30+ days of snapshots and 5+ sends)">-</span>

      case 'slippage_14d': {
        if (rec.slippage_14d === null) return <span className="text-gray-400" title="Insufficient data">-</span>
        const color14 = rec.slippage_14d < 15 ? 'text-green-600' : rec.slippage_14d < 30 ? 'text-yellow-600' : 'text-red-600'
        const slipCount14 = Math.max(0, rec.sends_14d - (rec.confirms_gained_14d + (rec.sends_14d - rec.confirms_gained_14d - Math.round(rec.sends_14d * (100 - (rec.slippage_14d || 0)) / 100))))
        return <span className={`${color14} font-medium`} title={`${rec.sends_14d} sends - ${rec.confirms_gained_14d} confirms = unaccounted subs in 14D`}>{rec.slippage_14d.toFixed(1)}%</span>
      }

      case 'slippage_30d': {
        if (rec.slippage_30d === null) return <span className="text-gray-400" title="Insufficient data">-</span>
        const color30 = rec.slippage_30d < 15 ? 'text-green-600' : rec.slippage_30d < 30 ? 'text-yellow-600' : 'text-red-600'
        return <span className={`${color30} font-medium`} title={`${rec.sends_30d} sends - ${rec.confirms_gained_30d} confirms = unaccounted subs in 30D`}>{rec.slippage_30d.toFixed(1)}%</span>
      }

      case 'effective_rcr':
        return <span className={getSourceColor(rec.rcr_source)}>{rec.effective_rcr.toFixed(1)}%</span>

      case 'rcr_source':
        if (rec.rcr_source === 'override_with_sl') return <span className="text-red-600" title="Override active — SL RCR available">override*</span>
        if (rec.rcr_source === 'override') return <span className="text-orange-600">override</span>
        if (rec.rcr_source === 'ours') return <span className="text-blue-600">ours</span>
        if (rec.rcr_source === 'sparkloop') return 'SL'
        return 'default'

      case 'our_cr':
        return rec.our_cr !== null
          ? <span className={`font-medium ${dateRangeActive ? 'text-purple-600' : 'text-blue-600'}`}>{rec.our_cr.toFixed(1)}%</span>
          : '-'

      case 'page_cr':
        return rec.page_cr !== null
          ? <span className={`font-medium ${dateRangeActive ? 'text-purple-600' : 'text-teal-600'}`}>{rec.page_cr.toFixed(1)}%</span>
          : '-'

      case 'effective_cr':
        return <span className={getSourceColor(rec.cr_source)}>{rec.effective_cr.toFixed(1)}%</span>

      case 'cr_source':
        if (rec.cr_source === 'override_with_data') return <span className="text-red-600" title="Override active — Our CR available">override*</span>
        if (rec.cr_source === 'override') return <span className="text-orange-600">override</span>
        if (rec.cr_source === 'ours') return <span className="text-blue-600">ours</span>
        return 'default'

      case 'calculated_score': {
        const crOvr = rec.override_cr !== null && rec.override_cr !== undefined
        const rcrOvr = rec.override_rcr !== null && rec.override_rcr !== undefined
        const parts: string[] = []
        if (crOvr) parts.push(`CR:${rec.override_cr}%`)
        if (rcrOvr) parts.push(`RCR:${rec.override_rcr}%`)
        return (
          <div>
            <span className="font-mono font-medium">${rec.calculated_score.toFixed(4)}</span>
            {parts.length > 0 && (
              <div className="text-[9px] text-orange-500 mt-0.5">{parts.join(' ')}</div>
            )}
          </div>
        )
      }

      case 'impressions':
        return dateRangeActive
          ? <span className="text-purple-600">{rec.impressions}</span>
          : rec.impressions

      case 'submissions':
        return dateRangeActive
          ? <span className="text-purple-600">{rec.submissions}</span>
          : rec.submissions

      case 'page_impressions':
        return dateRangeActive
          ? <span className="text-purple-600">{rec.page_impressions}</span>
          : rec.page_impressions

      case 'page_submissions':
        return dateRangeActive
          ? <span className="text-purple-600">{rec.page_submissions}</span>
          : rec.page_submissions

      case 'our_confirms':
        return <span className={`font-medium ${dateRangeActive ? 'text-purple-600' : 'text-green-600'}`}>{rec.our_confirms}</span>

      case 'our_rejections':
        return <span className={dateRangeActive ? 'text-purple-600' : 'text-red-600'}>{rec.our_rejections}</span>

      case 'our_pending':
        return <span className={dateRangeActive ? 'text-purple-600' : 'text-yellow-600'}>{rec.our_pending}</span>

      case 'sparkloop_confirmed':
        return <span className="text-green-600/60">{rec.sparkloop_confirmed}</span>

      case 'sparkloop_rejected':
        return <span className="text-red-600/60">{rec.sparkloop_rejected}</span>

      case 'sparkloop_pending':
        return <span className="text-yellow-600/60">{rec.sparkloop_pending}</span>

      case 'sparkloop_earnings':
        return rec.sparkloop_earnings ? `$${fmtDollars(rec.sparkloop_earnings / 100)}` : '-'

      case 'sparkloop_net_earnings':
        return rec.sparkloop_net_earnings ? `$${fmtDollars(rec.sparkloop_net_earnings / 100)}` : '-'

      case 'remaining_budget_dollars':
        if (rec.remaining_budget_dollars === null || rec.remaining_budget_dollars === undefined) return '-'
        return `$${fmtDollars(rec.remaining_budget_dollars)}`

      case 'excluded':
        return rec.excluded ? 'Yes' : 'No'

      case 'eligible_for_module':
        return (
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleModuleEligible(rec) }}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              rec.eligible_for_module ? 'bg-indigo-600' : 'bg-gray-300'
            }`}
            title={rec.eligible_for_module ? 'Eligible for newsletter module' : 'Not in newsletter module'}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                rec.eligible_for_module ? 'translate-x-4.5' : 'translate-x-0.5'
              }`}
            />
          </button>
        )

      case 'last_synced_at':
        if (!rec.last_synced_at) return '-'
        return new Date(rec.last_synced_at).toLocaleDateString()

      case 'type':
        return rec.type === 'paid' ? (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-700">Paid</span>
        ) : (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-700">Free</span>
        )

      default: {
        const value = rec[columnKey as keyof Recommendation]
        if (value === null || value === undefined) return '-'
        if (typeof value === 'number') return value.toLocaleString()
        return String(value)
      }
    }
  }

  return (
    <div className="py-4">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search newsletters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex gap-1">
          {(['all', 'active', 'excluded', 'paused'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-lg capitalize ${
                statusFilter === s
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Column selector toggle */}
        <button
          onClick={() => setShowColumnSelector(!showColumnSelector)}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg ${
            showColumnSelector ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          Columns
        </button>

        {/* CSV export */}
        <button
          onClick={exportToCSV}
          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
        >
          <Download className="w-3.5 h-3.5" />
          CSV
        </button>

        {/* Results count */}
        <span className="text-xs text-gray-500 ml-auto">
          {filteredAndSorted.length} of {recommendations.length} recommendations
        </span>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 mb-4 p-2 bg-gray-50 rounded-lg border">
          <span className="text-sm text-gray-600 font-medium">{selectedIds.size} selected</span>
          <div className="flex gap-1 ml-auto">
            <button
              onClick={() => bulkAction('pause')}
              disabled={actionLoading === 'bulk'}
              className="flex items-center gap-1 px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 text-xs disabled:opacity-50"
            >
              <Pause className="w-3.5 h-3.5" /> Pause
            </button>
            <button
              onClick={() => bulkAction('exclude')}
              disabled={actionLoading === 'bulk'}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs disabled:opacity-50"
            >
              <Ban className="w-3.5 h-3.5" /> Exclude
            </button>
            <button
              onClick={() => bulkAction('reactivate')}
              disabled={actionLoading === 'bulk'}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 text-xs disabled:opacity-50"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Reactivate
            </button>
          </div>
        </div>
      )}

      {/* Date Range Picker */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Calendar className="w-4 h-4 text-gray-400" />
        <button
          onClick={() => setQuickRange(7)}
          className={`px-2 py-1 text-xs rounded-lg ${
            dateRangeActive && dateStart === new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0]
              ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
        >
          7 Days
        </button>
        <button
          onClick={() => setQuickRange(30)}
          className={`px-2 py-1 text-xs rounded-lg ${
            dateRangeActive && dateStart === new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0]
              ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
        >
          30 Days
        </button>
        <span className="text-xs text-gray-300">|</span>
        <input
          type="date"
          value={dateStart}
          onChange={(e) => setDateStart(e.target.value)}
          className="px-2 py-1 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <span className="text-xs text-gray-400">to</span>
        <input
          type="date"
          value={dateEnd}
          onChange={(e) => setDateEnd(e.target.value)}
          className="px-2 py-1 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        {(dateStart || dateEnd) && (
          <button
            onClick={clearDateRange}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
        {dateRangeLoading && (
          <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-gray-300 border-t-purple-500" />
        )}
        {dateRangeActive && !dateRangeLoading && (
          <span className="px-2 py-0.5 text-[10px] rounded-full bg-purple-100 text-purple-700">
            Filtered: Popup Impr/Subs/CR, Page Impr/Subs/CR, Conf, Rej, Pend
          </span>
        )}
      </div>

      {/* Global stats bar */}
      {globalStats && (
        <div className="flex gap-4 mb-4 text-xs text-gray-600">
          <span>Global Unique IPs: <strong>{globalStats.uniqueIps}</strong></span>
          {dateRangeActive && rangeStats && (
            <>
              <span className="text-purple-600">Unique IPs ({dateStart} to {dateEnd}): <strong>{rangeStats.uniqueIps}</strong></span>
              <span className="text-purple-600">Avg Offers Selected: <strong>{rangeStats.avgOffersSelected.toFixed(1)}</strong></span>
            </>
          )}
          {!dateRangeActive && (
            <span>Avg Offers Selected: <strong>{globalStats.avgOffersSelected.toFixed(1)}</strong></span>
          )}
        </div>
      )}

      {/* Default CR/RCR Controls */}
      <div className="flex items-center justify-end gap-4 mb-4">
        {/* Default CR */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-gray-500">Default CR:</span>
          {editingDefaultCr ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={defaultCrInput}
                onChange={e => setDefaultCrInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveDefault('cr')
                  if (e.key === 'Escape') setEditingDefaultCr(false)
                }}
                autoFocus
                className="w-16 px-1.5 py-0.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <span className="text-gray-400">%</span>
              <button
                onClick={() => saveDefault('cr')}
                disabled={defaultSaving}
                className="p-0.5 rounded text-green-600 hover:bg-green-100 disabled:opacity-50"
                title="Save"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setEditingDefaultCr(false)}
                className="p-0.5 rounded text-gray-400 hover:bg-gray-100"
                title="Cancel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="font-medium">{defaults.cr}%</span>
              <button
                onClick={() => {
                  setDefaultCrInput(String(defaults.cr))
                  setEditingDefaultCr(true)
                }}
                className="p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                title="Edit default CR"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Default RCR */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-gray-500">Default RCR:</span>
          {editingDefaultRcr ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={defaultRcrInput}
                onChange={e => setDefaultRcrInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveDefault('rcr')
                  if (e.key === 'Escape') setEditingDefaultRcr(false)
                }}
                autoFocus
                className="w-16 px-1.5 py-0.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <span className="text-gray-400">%</span>
              <button
                onClick={() => saveDefault('rcr')}
                disabled={defaultSaving}
                className="p-0.5 rounded text-green-600 hover:bg-green-100 disabled:opacity-50"
                title="Save"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setEditingDefaultRcr(false)}
                className="p-0.5 rounded text-gray-400 hover:bg-gray-100"
                title="Cancel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="font-medium">{defaults.rcr}%</span>
              <button
                onClick={() => {
                  setDefaultRcrInput(String(defaults.rcr))
                  setEditingDefaultRcr(true)
                }}
                className="p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                title="Edit default RCR"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Column Selector */}
      {showColumnSelector && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-xs font-semibold mb-2">Select Columns to Display</h3>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5">
            {columns.map(col => (
              <label key={col.key} className="flex items-center space-x-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={col.enabled}
                  onChange={() => toggleColumn(col.key)}
                  className="rounded border-gray-300"
                />
                <span>{col.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              {/* Fixed checkbox column */}
              <th className="px-2 py-2 text-left w-8">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filteredAndSorted.length && filteredAndSorted.length > 0}
                  onChange={selectAll}
                  className="rounded"
                />
              </th>
              {enabledColumns.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-2 py-2 text-left text-[11px] font-medium text-gray-500 cursor-pointer hover:bg-gray-100 whitespace-nowrap ${getColumnWidthClass(col.width)}`}
                >
                  <div className="flex items-center gap-1" title={col.label}>
                    <span className="truncate">
                      {col.label}
                      {dateRangeActive && DATE_FILTERED_COLUMNS.has(col.key) ? '*' : ''}
                    </span>
                    <span className="text-gray-400 flex-shrink-0">
                      {sortColumn === col.key ? (
                        sortDirection === 'desc' ? '▼' : '▲'
                      ) : null}
                    </span>
                  </div>
                </th>
              ))}
              {/* Fixed actions column */}
              <th className="px-2 py-2 text-center text-[11px] font-medium text-gray-500 w-24 whitespace-nowrap">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={totalColumns} className="px-4 py-8 text-center text-gray-500 text-sm">
                  Loading...
                </td>
              </tr>
            ) : filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={totalColumns} className="px-4 py-8 text-center text-gray-500 text-sm">
                  No recommendations found
                </td>
              </tr>
            ) : (
              filteredAndSorted.map(rec => (
                <tr
                  key={rec.id}
                  className={`hover:bg-gray-50 ${rec.excluded ? 'bg-red-50/50' : rec.status === 'paused' && rec.paused_reason === 'manual' ? 'bg-yellow-50/50' : ''}`}
                >
                  {/* Checkbox */}
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(rec.id)}
                      onChange={() => toggleSelect(rec.id)}
                      className="rounded"
                    />
                  </td>
                  {/* Data columns */}
                  {enabledColumns.map(col => (
                    <td
                      key={col.key}
                      className={`px-2 py-1.5 text-xs whitespace-nowrap ${getColumnWidthClass(col.width)}`}
                    >
                      {renderCellContent(rec, col.key)}
                    </td>
                  ))}
                  {/* Actions column */}
                  <td className="px-2 py-1.5 text-center">
                    {actionLoading === rec.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin inline" />
                    ) : (
                      <div className="flex items-center justify-center gap-0.5">
                        {rec.excluded || rec.status === 'paused' ? (
                          <button
                            onClick={() => handleReactivate(rec)}
                            title="Reactivate"
                            className="p-1 rounded text-green-600 hover:bg-green-100"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handlePause(rec)}
                              title="Pause"
                              className="p-1 rounded text-yellow-600 hover:bg-yellow-100"
                            >
                              <Pause className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleExclude(rec)}
                              title="Exclude"
                              className="p-1 rounded text-red-600 hover:bg-red-100"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => openOverrideModal(rec)}
                          title="Edit overrides"
                          className="p-1 rounded text-gray-500 hover:bg-gray-100"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-3 text-[10px] text-gray-500">
        <strong>Score</strong> = CR x CPA x RCR (expected revenue per impression) |
        <span className="text-blue-600 ml-1">Blue</span> = popup data |
        <span className="text-teal-600 ml-1">Teal</span> = page data |
        <span className="text-orange-600 ml-1">Orange</span> = override (no real data) |
        <span className="text-red-600 ml-1">Red</span> = override (real data available)
        {dateRangeActive && (
          <>
            {' | '}
            <span className="text-purple-600">* Purple</span> = filtered by date range ({dateStart} to {dateEnd})
          </>
        )}
      </div>

      {/* Override Modal */}
      {overrideRec && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setOverrideRec(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">Edit Default Overrides</h3>
            <p className="text-sm text-gray-500 mb-4">{overrideRec.publication_name}</p>
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-4">Overrides take highest priority — they replace both real data and defaults. Values shown in <span className="text-red-600 font-semibold">red</span> when overriding available real data.</p>

            {/* Current values display */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500">Our CR (calculated):</span>
                <span className="text-blue-600 font-medium">
                  {overrideRec.our_cr !== null ? `${overrideRec.our_cr.toFixed(1)}%` : '-'}
                  {overrideRec.impressions < 50 && <span className="text-gray-400 ml-1">(&lt;50 impressions)</span>}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">SparkLoop RCR:</span>
                <span>{overrideRec.sparkloop_rcr !== null ? `${overrideRec.sparkloop_rcr.toFixed(0)}%` : '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Default CR:</span>
                <span>{defaults.cr}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Default RCR:</span>
                <span>{defaults.rcr}%</span>
              </div>
              <div className="border-t pt-1.5 flex justify-between font-medium">
                <span className="text-gray-700">Current effective CR:</span>
                <span className={overrideRec.cr_source === 'override_with_data' ? 'text-red-600' : overrideRec.cr_source === 'override' ? 'text-orange-600' : overrideRec.cr_source === 'ours' ? 'text-blue-600' : ''}>
                  {overrideRec.effective_cr.toFixed(1)}% ({overrideRec.cr_source.replace('_with_data', '*')})
                </span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-gray-700">Current effective RCR:</span>
                <span className={overrideRec.rcr_source === 'override_with_sl' ? 'text-red-600' : overrideRec.rcr_source === 'override' ? 'text-orange-600' : overrideRec.rcr_source === 'sparkloop' ? '' : ''}>
                  {overrideRec.effective_rcr.toFixed(1)}% ({overrideRec.rcr_source.replace('_with_sl', '*')})
                </span>
              </div>
            </div>

            {/* Override inputs */}
            <div className="space-y-3 mb-5">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Override CR (%) <span className="text-gray-400 font-normal">— always takes priority over all sources</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="Leave empty to use global default"
                    value={overrideCrValue}
                    onChange={e => setOverrideCrValue(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={() => setOverrideCrValue('')}
                    className="px-3 py-2 text-xs bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-600"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Override RCR (%) <span className="text-gray-400 font-normal">— always takes priority over all sources</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="Leave empty to use global default"
                    value={overrideRcrValue}
                    onChange={e => setOverrideRcrValue(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={() => setOverrideRcrValue('')}
                    className="px-3 py-2 text-xs bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-600"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setOverrideRec(null)}
                className="px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={saveOverrides}
                disabled={overrideSaving}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {overrideSaving ? 'Saving...' : 'Save Overrides'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
