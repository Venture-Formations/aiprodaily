'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Column, DatePreset, ScoredPost } from './types'
import { DEFAULT_COLUMNS } from './constants'
import { DATE_REGEX } from './constants'
import { getDateRange, getColumnValue } from './utils'

export function useArticlesTab(slug: string) {
  const [posts, setPosts] = useState<ScoredPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const [csvExporting, setCsvExporting] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPosts, setTotalPosts] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const pageSize = 100

  // Date range filter
  const initialRange = getDateRange('7d')
  const [datePreset, setDatePreset] = useState<DatePreset>('7d')
  const [dateFrom, setDateFrom] = useState(initialRange.from)
  const [dateTo, setDateTo] = useState(initialRange.to)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  // Filter states
  const [feedTypeFilter, setFeedTypeFilter] = useState<string>('all')
  const [positionFilter, setPositionFilter] = useState<'all' | 'all_used' | number>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [minScore, setMinScore] = useState<number | ''>('')
  const [maxScore, setMaxScore] = useState<number | ''>('')

  // Sort states
  const [sortColumn, setSortColumn] = useState<string | null>('ingestDate')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Column visibility
  const [columns, setColumns] = useState<Column[]>(DEFAULT_COLUMNS)

  // Server-provided filter options (from all data, not just current page)
  const [uniqueFeedTypes, setUniqueFeedTypes] = useState<string[]>([])
  const [uniquePositions, setUniquePositions] = useState<number[]>([])
  const [companyScoredCounts, setCompanyScoredCounts] = useState<Record<string, number>>({})

  const enabledColumns = columns.filter(col => col.enabled)

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch when any filter/sort/page changes
  useEffect(() => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    fetchPosts(controller.signal)
    return () => controller.abort()
  }, [slug, dateFrom, dateTo, currentPage, feedTypeFilter, positionFilter, debouncedSearch, minScore, maxScore, sortColumn, sortDirection])

  // Reset to page 1 when filters change
  const resetPage = useCallback(() => {
    setCurrentPage(1)
  }, [])

  useEffect(() => {
    resetPage()
  }, [feedTypeFilter, positionFilter, debouncedSearch, minScore, maxScore])

  // Build query params shared between fetch and export
  const buildParams = useCallback((overrides?: { exportAll?: boolean }) => {
    const params = new URLSearchParams({
      publication_id: slug,
      page: String(overrides?.exportAll ? 1 : currentPage),
      page_size: String(pageSize),
    })
    if (dateFrom) params.set('start_date', dateFrom)
    if (dateTo) params.set('end_date', dateTo)
    if (feedTypeFilter !== 'all') params.set('feed_type', feedTypeFilter)
    if (positionFilter !== 'all') params.set('position', String(positionFilter))
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (minScore !== '') params.set('min_score', String(minScore))
    if (maxScore !== '') params.set('max_score', String(maxScore))
    if (sortColumn) params.set('sort_column', sortColumn)
    params.set('sort_direction', sortDirection)
    if (overrides?.exportAll) params.set('export_all', 'true')
    return params
  }, [slug, currentPage, dateFrom, dateTo, feedTypeFilter, positionFilter, debouncedSearch, minScore, maxScore, sortColumn, sortDirection])

  // Data fetching
  const fetchPosts = async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const params = buildParams()
      const response = await fetch(`/api/databases/articles?${params}`, { signal })
      if (!response.ok) {
        throw new Error('Failed to fetch scored posts')
      }
      const result = await response.json()
      setPosts(result.data || [])
      setTotalPosts(result.total || 0)
      setTotalPages(result.totalPages || 0)
      if (result.allFeedTypes) setUniqueFeedTypes(result.allFeedTypes)
      if (result.allPositions) setUniquePositions(result.allPositions)
      if (result.companyScoredCounts) setCompanyScoredCounts(result.companyScoredCounts)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Handlers
  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset)
    if (preset !== 'custom') {
      const range = getDateRange(preset)
      setDateFrom(range.from)
      setDateTo(range.to)
      setCurrentPage(1)
    } else {
      setCustomFrom(dateFrom)
      setCustomTo(dateTo)
    }
  }

  const applyCustomDateRange = () => {
    if (DATE_REGEX.test(customFrom) && DATE_REGEX.test(customTo)) {
      setDateFrom(customFrom)
      setDateTo(customTo)
      setCurrentPage(1)
    }
  }

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

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id)
  }

  const clearFilters = () => {
    setFeedTypeFilter('all')
    setPositionFilter('all')
    setSearchTerm('')
    setMinScore('')
    setMaxScore('')
    handleDatePresetChange('7d')
  }

  const clearSort = () => {
    setSortColumn(null)
    setSortDirection('desc')
  }

  const exportToCSV = async () => {
    try {
      setCsvExporting(true)
      // Fetch ALL filtered data (no pagination) for export
      const params = buildParams({ exportAll: true })
      const response = await fetch(`/api/databases/articles?${params}`)
      if (!response.ok) throw new Error('Failed to fetch export data')
      const result = await response.json()
      const allData: ScoredPost[] = result.data || []

      const exportColumns = columns.filter(col => col.enabled && col.exportable)
      const headers = exportColumns.map(col => col.label).join(',')
      const rows = allData.map(post => {
        return exportColumns.map(col => {
          const value = getColumnValue(post, col.key)
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
      link.setAttribute('download', `scored-posts-export-${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('CSV export failed:', err)
    } finally {
      setCsvExporting(false)
    }
  }

  return {
    // State
    posts,
    filteredPosts: posts, // posts are already filtered server-side
    loading,
    error,
    expandedRow,
    showColumnSelector,
    currentPage,
    totalPosts,
    totalPages,
    datePreset,
    customFrom,
    customTo,
    feedTypeFilter,
    positionFilter,
    searchTerm,
    minScore,
    maxScore,
    sortColumn,
    sortDirection,
    columns,
    enabledColumns,
    uniquePositions,
    uniqueFeedTypes,
    companyScoredCounts,
    csvExporting,

    // Setters
    setShowColumnSelector,
    setCurrentPage,
    setCustomFrom,
    setCustomTo,
    setFeedTypeFilter,
    setPositionFilter,
    setSearchTerm,
    setMinScore,
    setMaxScore,

    // Handlers
    handleDatePresetChange,
    applyCustomDateRange,
    handleSort,
    toggleColumn,
    toggleRow,
    clearFilters,
    clearSort,
    exportToCSV,
    fetchPosts,
  }
}
