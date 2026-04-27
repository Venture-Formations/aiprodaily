import { useState, useEffect, useMemo, useCallback } from 'react'
import { toLocalDateStr } from '@/lib/date-utils'
import { MS_PER_DAY, DEFAULT_COLUMNS } from './constants'
import { getColumnValue } from './utils'
import type { Column, Recommendation, DateRangeMetrics, RangeStats, StatusFilter } from './types'

interface UseDetailedTabStateOptions {
  recommendations: Recommendation[]
  onRefresh: () => void
  publicationId: string | null
}

export function useDetailedTabState({ recommendations, onRefresh, publicationId }: UseDetailedTabStateOptions) {
  const [columns, setColumns] = useState<Column[]>(DEFAULT_COLUMNS)
  const [sortColumn, setSortColumn] = useState<string | null>('calculated_score')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // Date range state — default to last 30 days so snapshot-derived metrics show immediately
  const [dateStart, setDateStart] = useState(() => toLocalDateStr(new Date(Date.now() - 29 * MS_PER_DAY)))
  const [dateEnd, setDateEnd] = useState(() => toLocalDateStr(new Date()))
  const [dateRangeMetrics, setDateRangeMetrics] = useState<Record<string, DateRangeMetrics> | null>(null)
  const [dateRangeLoading, setDateRangeLoading] = useState(false)
  const [rangeStats, setRangeStats] = useState<RangeStats | null>(null)
  const [timezone, setTimezone] = useState<'CST' | 'UTC'>('CST')

  // Action state
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Override modal state
  const [overrideRec, setOverrideRec] = useState<Recommendation | null>(null)
  const [overrideCrValue, setOverrideCrValue] = useState('')
  const [overrideRcrValue, setOverrideRcrValue] = useState('')
  const [overrideSlipValue, setOverrideSlipValue] = useState('')
  const [overrideSaving, setOverrideSaving] = useState(false)

  // Default CR/RCR editing state
  const [editingDefaultCr, setEditingDefaultCr] = useState(false)
  const [editingDefaultRcr, setEditingDefaultRcr] = useState(false)
  const [defaultCrInput, setDefaultCrInput] = useState('')
  const [defaultRcrInput, setDefaultRcrInput] = useState('')
  const [editingDefaultMcb, setEditingDefaultMcb] = useState(false)
  const [defaultMcbInput, setDefaultMcbInput] = useState('')
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
    if (!publicationId) return

    const fetchDateRange = async () => {
      setDateRangeLoading(true)
      try {
        const res = await fetch(`/api/sparkloop/admin/daterange?start=${dateStart}&end=${dateEnd}&tz=${timezone}&publication_id=${publicationId}`)
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
  }, [dateStart, dateEnd, timezone, publicationId])

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
    setDateStart(toLocalDateStr(start))
    setDateEnd(toLocalDateStr(end))
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
      // Use raw impressions (all popup opens, not just confirmed subscribers)
      const impr = drm?.impressions ?? 0
      const subs = drm?.submissions ?? 0
      const pageImpr = drm?.page_impressions ?? 0
      const pageSubs = drm?.page_submissions ?? 0
      // Calculate CRs from raw impressions
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
    } else if (statusFilter === 'archived') {
      result = result.filter(r => r.status === 'archived' || r.status === 'awaiting_approval')
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
            if (r.status === 'archived') return 'archived'
            if (r.status === 'awaiting_approval') return 'awaiting approval'
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

  const adminUrl = publicationId
    ? `/api/sparkloop/admin?publication_id=${publicationId}`
    : '/api/sparkloop/admin'

  // --- Action handlers ---
  async function handlePause(rec: Recommendation) {
    if (!publicationId) return
    setActionLoading(rec.id)
    try {
      const res = await fetch(adminUrl, {
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
    if (!publicationId) return
    setActionLoading(rec.id)
    try {
      const res = await fetch(adminUrl, {
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
    if (!publicationId) return
    setActionLoading(rec.id)
    try {
      // If excluded, un-exclude. If paused, unpause.
      const body = rec.excluded
        ? { id: rec.id, excluded: false }
        : { id: rec.id, action: 'unpause' }
      const res = await fetch(adminUrl, {
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
    if (selectedIds.size === 0 || !publicationId) return

    const reason = action === 'exclude' ? prompt('Exclusion reason (e.g., budget_used_up):') : null
    if (action === 'exclude' && reason === null) return

    setActionLoading('bulk')
    try {
      const res = await fetch(adminUrl, {
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
    if (!publicationId) return
    try {
      const res = await fetch(adminUrl, {
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
    setOverrideSlipValue(rec.override_slip !== null && rec.override_slip !== undefined ? String(rec.override_slip) : '')
  }

  async function saveOverrides() {
    if (!overrideRec || !publicationId) return
    setOverrideSaving(true)
    try {
      const body: Record<string, unknown> = {
        id: overrideRec.id,
        action: 'set_overrides',
      }
      // Parse CR: empty string = clear (null), otherwise number
      body.override_cr = overrideCrValue.trim() === '' ? null : parseFloat(overrideCrValue)
      body.override_rcr = overrideRcrValue.trim() === '' ? null : parseFloat(overrideRcrValue)
      body.override_slip = overrideSlipValue.trim() === '' ? null : parseFloat(overrideSlipValue)

      const res = await fetch(adminUrl, {
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

  async function saveDefault(field: 'cr' | 'rcr' | 'mcb') {
    if (!publicationId) return
    const value = field === 'cr' ? defaultCrInput : field === 'rcr' ? defaultRcrInput : defaultMcbInput
    const parsed = field === 'mcb' ? parseInt(value) : parseFloat(value)
    if (field === 'mcb') {
      if (isNaN(parsed) || parsed < 1 || parsed > 100) {
        alert('Value must be between 1 and 100')
        return
      }
    } else {
      if (isNaN(parsed) || parsed < 0 || parsed > 100) {
        alert('Value must be between 0 and 100')
        return
      }
    }
    setDefaultSaving(true)
    try {
      const body: Record<string, unknown> = { action: 'set_defaults' }
      if (field === 'cr') body.default_cr = parsed
      if (field === 'rcr') body.default_rcr = parsed
      if (field === 'mcb') body.min_conversions_budget = parsed

      const res = await fetch(adminUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        if (field === 'cr') setEditingDefaultCr(false)
        if (field === 'rcr') setEditingDefaultRcr(false)
        if (field === 'mcb') setEditingDefaultMcb(false)
        onRefresh()
      } else {
        alert('Save failed: ' + data.error)
      }
    } catch {
      alert('Save failed')
    }
    setDefaultSaving(false)
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

  // Total columns for colSpan = checkbox + enabled columns + actions
  const totalColumns = 2 + enabledColumns.length

  return {
    // Column state
    columns,
    enabledColumns,
    showColumnSelector,
    setShowColumnSelector,
    toggleColumn,

    // Sort state
    sortColumn,
    sortDirection,
    handleSort,

    // Filter state
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,

    // Date range state
    dateStart,
    setDateStart,
    dateEnd,
    setDateEnd,
    dateRangeActive,
    dateRangeLoading,
    dateRangeMetrics,
    rangeStats,
    timezone,
    setTimezone,
    clearDateRange,
    setQuickRange,

    // Selection state
    selectedIds,
    toggleSelect,
    selectAll,

    // Data
    filteredAndSorted,
    totalColumns,

    // Action handlers
    actionLoading,
    handlePause,
    handleExclude,
    handleReactivate,
    bulkAction,
    handleToggleModuleEligible,

    // Override modal
    overrideRec,
    setOverrideRec,
    overrideCrValue,
    setOverrideCrValue,
    overrideRcrValue,
    setOverrideRcrValue,
    overrideSlipValue,
    setOverrideSlipValue,
    overrideSaving,
    saveOverrides,
    openOverrideModal,

    // Default editing
    editingDefaultCr,
    setEditingDefaultCr,
    editingDefaultRcr,
    setEditingDefaultRcr,
    defaultCrInput,
    setDefaultCrInput,
    defaultRcrInput,
    setDefaultRcrInput,
    editingDefaultMcb,
    setEditingDefaultMcb,
    defaultMcbInput,
    setDefaultMcbInput,
    defaultSaving,
    saveDefault,

    // Export
    exportToCSV,
  }
}
