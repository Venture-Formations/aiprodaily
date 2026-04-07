import { useEffect, useRef, useState } from 'react'
import type { Column, DatePreset, ScoredPost } from './types'
import { DEFAULT_COLUMNS } from './constants'
import { DATE_REGEX } from './constants'
import { getDateRange, getColumnValue } from './utils'

export function useArticlesTab(slug: string) {
  const [posts, setPosts] = useState<ScoredPost[]>([])
  const [filteredPosts, setFilteredPosts] = useState<ScoredPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [showColumnSelector, setShowColumnSelector] = useState(false)

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
  const [minScore, setMinScore] = useState<number | ''>('')
  const [maxScore, setMaxScore] = useState<number | ''>('')

  // Sort states
  const [sortColumn, setSortColumn] = useState<string | null>('ingestDate')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Column visibility
  const [columns, setColumns] = useState<Column[]>(DEFAULT_COLUMNS)

  // Derived values
  const uniquePositions = Array.from(
    new Set(posts.filter(a => a.finalPosition !== null).map(a => a.finalPosition as number))
  ).sort((a, b) => a - b)

  const uniqueFeedTypes = Array.from(new Set(posts.map(a => a.feedType))).filter(Boolean).sort()

  const enabledColumns = columns.filter(col => col.enabled)

  // Effects
  useEffect(() => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    fetchPosts(controller.signal)
    return () => controller.abort()
  }, [slug, dateFrom, dateTo, currentPage])

  useEffect(() => {
    applyFiltersAndSort()
  }, [posts, feedTypeFilter, positionFilter, searchTerm, minScore, maxScore, sortColumn, sortDirection])

  // Data fetching
  const fetchPosts = async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        publication_id: slug,
        page: String(currentPage),
        page_size: String(pageSize),
      })
      if (dateFrom) params.set('start_date', dateFrom)
      if (dateTo) params.set('end_date', dateTo)
      const response = await fetch(`/api/databases/articles?${params}`, { signal })
      if (!response.ok) {
        throw new Error('Failed to fetch scored posts')
      }
      const result = await response.json()
      setPosts(result.data || [])
      setTotalPosts(result.total || 0)
      setTotalPages(result.totalPages || 0)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Filtering and sorting
  const applyFiltersAndSort = () => {
    let filtered = [...posts]

    if (feedTypeFilter !== 'all') {
      filtered = filtered.filter(a => a.feedType === feedTypeFilter)
    }

    if (positionFilter === 'all_used') {
      filtered = filtered.filter(a => a.finalPosition !== null)
    } else if (typeof positionFilter === 'number') {
      filtered = filtered.filter(a => a.finalPosition === positionFilter)
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(a =>
        a.originalTitle.toLowerCase().includes(term) ||
        a.author.toLowerCase().includes(term) ||
        a.feedName.toLowerCase().includes(term) ||
        a.sourceName.toLowerCase().includes(term)
      )
    }

    if (minScore !== '') {
      filtered = filtered.filter(a => (a.totalScore || 0) >= minScore)
    }
    if (maxScore !== '') {
      filtered = filtered.filter(a => (a.totalScore || 0) <= maxScore)
    }

    if (sortColumn) {
      filtered.sort((a, b) => {
        const aVal = a[sortColumn as keyof ScoredPost]
        const bVal = b[sortColumn as keyof ScoredPost]

        if (aVal === null || aVal === undefined || aVal === '') {
          return sortDirection === 'asc' ? 1 : -1
        }
        if (bVal === null || bVal === undefined || bVal === '') {
          return sortDirection === 'asc' ? -1 : 1
        }

        if (sortColumn === 'ingestDate' || sortColumn === 'publicationDate') {
          const dateA = new Date(aVal as string).getTime()
          const dateB = new Date(bVal as string).getTime()
          return sortDirection === 'asc' ? dateA - dateB : dateB - dateA
        }

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
        }

        const strA = String(aVal).toLowerCase()
        const strB = String(bVal).toLowerCase()
        return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA)
      })
    }

    setFilteredPosts(filtered)
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

  const exportToCSV = () => {
    const exportColumns = columns.filter(col => col.enabled && col.exportable)
    const headers = exportColumns.map(col => col.label).join(',')
    const rows = filteredPosts.map(post => {
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
  }

  return {
    // State
    posts,
    filteredPosts,
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
