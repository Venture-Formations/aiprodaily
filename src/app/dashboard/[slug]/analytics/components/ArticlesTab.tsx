'use client'

import { useEffect, useRef, useState } from 'react'

interface ScoredPost {
  id: string
  originalTitle: string
  originalDescription: string
  originalFullText: string
  publicationDate: string
  author: string
  sourceUrl: string
  sourceName: string
  imageUrl: string
  feedType: string
  feedName: string
  ingestDate: string
  criteria1Score: number | null
  criteria1Weight: number
  criteria1Reasoning: string
  criteria1Name: string
  criteria1Enabled: boolean
  criteria2Score: number | null
  criteria2Weight: number
  criteria2Reasoning: string
  criteria2Name: string
  criteria2Enabled: boolean
  criteria3Score: number | null
  criteria3Weight: number
  criteria3Reasoning: string
  criteria3Name: string
  criteria3Enabled: boolean
  criteria4Score: number | null
  criteria4Weight: number
  criteria4Reasoning: string
  criteria4Name: string
  criteria4Enabled: boolean
  criteria5Score: number | null
  criteria5Weight: number
  criteria5Reasoning: string
  criteria5Name: string
  criteria5Enabled: boolean
  totalScore: number | null
  finalPosition: number | null
}

interface Column {
  key: string
  label: string
  enabled: boolean
  exportable: boolean
  width?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}

interface Props {
  slug: string
  excludeIps?: boolean
}

type DatePreset = '7d' | '30d' | '90d' | 'custom'

function toLocalDateString(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDateRange(preset: DatePreset): { from: string; to: string } {
  if (preset === 'custom') return { from: '', to: '' }
  const today = new Date()
  const to = toLocalDateString(today)
  const from = new Date(today)
  const daysMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }
  from.setDate(from.getDate() - daysMap[preset])
  return { from: toLocalDateString(from), to }
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export default function ArticlesTab({ slug }: Props) {
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

  // Get unique positions for filter dropdown
  const uniquePositions = Array.from(new Set(posts.filter(a => a.finalPosition !== null).map(a => a.finalPosition as number))).sort((a, b) => a - b)

  // Get unique feed types for filter dropdown
  const uniqueFeedTypes = Array.from(new Set(posts.map(a => a.feedType))).filter(Boolean).sort()

  // Column visibility states
  const [columns, setColumns] = useState<Column[]>([
    { key: 'ingestDate', label: 'Ingest Date', enabled: true, exportable: true, width: 'sm' },
    { key: 'finalPosition', label: 'Pos', enabled: true, exportable: true, width: 'xs' },
    { key: 'feedType', label: 'Section', enabled: true, exportable: true, width: 'md' },
    { key: 'feedName', label: 'Feed Name', enabled: false, exportable: true, width: 'md' },
    { key: 'originalTitle', label: 'Original Title', enabled: true, exportable: true, width: 'lg' },
    { key: 'originalDescription', label: 'Original Description', enabled: false, exportable: true, width: 'xl' },
    { key: 'originalFullText', label: 'Original Full Text', enabled: false, exportable: true, width: 'xl' },
    { key: 'publicationDate', label: 'Pub Date', enabled: false, exportable: true, width: 'sm' },
    { key: 'author', label: 'Author', enabled: false, exportable: true, width: 'md' },
    { key: 'sourceName', label: 'Source', enabled: true, exportable: true, width: 'md' },
    { key: 'sourceUrl', label: 'Source URL', enabled: false, exportable: true, width: 'xs' },
    { key: 'imageUrl', label: 'Image', enabled: false, exportable: true, width: 'xs' },
    { key: 'totalScore', label: 'Score', enabled: true, exportable: true, width: 'xs' },
    { key: 'criteria1Score', label: 'C1', enabled: true, exportable: true, width: 'xs' },
    { key: 'criteria1Weight', label: 'C1 Wt', enabled: false, exportable: true, width: 'xs' },
    { key: 'criteria1Reasoning', label: 'C1 Reasoning', enabled: false, exportable: true, width: 'xl' },
    { key: 'criteria2Score', label: 'C2', enabled: true, exportable: true, width: 'xs' },
    { key: 'criteria2Weight', label: 'C2 Wt', enabled: false, exportable: true, width: 'xs' },
    { key: 'criteria2Reasoning', label: 'C2 Reasoning', enabled: false, exportable: true, width: 'xl' },
    { key: 'criteria3Score', label: 'C3', enabled: true, exportable: true, width: 'xs' },
    { key: 'criteria3Weight', label: 'C3 Wt', enabled: false, exportable: true, width: 'xs' },
    { key: 'criteria3Reasoning', label: 'C3 Reasoning', enabled: false, exportable: true, width: 'xl' },
    { key: 'criteria4Score', label: 'C4', enabled: false, exportable: true, width: 'xs' },
    { key: 'criteria4Weight', label: 'C4 Wt', enabled: false, exportable: true, width: 'xs' },
    { key: 'criteria4Reasoning', label: 'C4 Reasoning', enabled: false, exportable: true, width: 'xl' },
    { key: 'criteria5Score', label: 'C5', enabled: false, exportable: true, width: 'xs' },
    { key: 'criteria5Weight', label: 'C5 Wt', enabled: false, exportable: true, width: 'xs' },
    { key: 'criteria5Reasoning', label: 'C5 Reasoning', enabled: false, exportable: true, width: 'xl' },
  ])

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

  const applyFiltersAndSort = () => {
    let filtered = [...posts]

    if (feedTypeFilter !== 'all') {
      filtered = filtered.filter(a => a.feedType === feedTypeFilter)
    }

    // Position filter
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

    // Apply sorting
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

        // Date columns
        if (sortColumn === 'ingestDate' || sortColumn === 'publicationDate') {
          const dateA = new Date(aVal as string).getTime()
          const dateB = new Date(bVal as string).getTime()
          return sortDirection === 'asc' ? dateA - dateB : dateB - dateA
        }

        // Number columns
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
        }

        // String columns
        const strA = String(aVal).toLowerCase()
        const strB = String(bVal).toLowerCase()
        return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA)
      })
    }

    setFilteredPosts(filtered)
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

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A'
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [year, month, day] = dateStr.split('-')
        return `${parseInt(month)}/${parseInt(day)}/${year}`
      }
      return new Date(dateStr).toLocaleDateString('en-US', { timeZone: 'UTC' })
    } catch {
      return dateStr
    }
  }

  const getColumnWidthClass = (width?: 'xs' | 'sm' | 'md' | 'lg' | 'xl') => {
    switch (width) {
      case 'xs': return 'w-14 min-w-[3.5rem] max-w-[4rem]'
      case 'sm': return 'w-20 min-w-[5rem] max-w-[6rem]'
      case 'md': return 'w-28 min-w-[7rem] max-w-[8rem]'
      case 'lg': return 'w-44 min-w-[11rem] max-w-[14rem]'
      case 'xl': return 'w-64 min-w-[16rem] max-w-[20rem]'
      default: return 'w-24'
    }
  }

  const getColumnValue = (post: ScoredPost, key: string): string => {
    const value = post[key as keyof ScoredPost]
    if (value === null || value === undefined) return ''
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'number') return value.toString()
    return value.toString()
  }

  const exportToCSV = () => {
    const enabledColumns = columns.filter(col => col.enabled && col.exportable)
    const headers = enabledColumns.map(col => col.label).join(',')
    const rows = filteredPosts.map(post => {
      return enabledColumns.map(col => {
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

  const renderCellContent = (post: ScoredPost, columnKey: string) => {
    switch (columnKey) {
      case 'ingestDate':
      case 'publicationDate':
        return formatDate(post[columnKey as keyof ScoredPost] as string)
      case 'feedType': {
        const getColorClass = (type: string) => {
          if (type === 'Primary') return 'bg-blue-100 text-blue-800'
          if (type === 'Secondary') return 'bg-purple-100 text-purple-800'
          return 'bg-green-100 text-green-800'
        }
        return (
          <span
            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full max-w-full truncate ${getColorClass(post.feedType)}`}
            title={post.feedType}
          >
            {post.feedType}
          </span>
        )
      }
      case 'totalScore':
      case 'criteria1Score':
      case 'criteria2Score':
      case 'criteria3Score':
      case 'criteria4Score':
      case 'criteria5Score': {
        const score = post[columnKey as keyof ScoredPost] as number | null
        return score !== null ? score.toFixed(1) : 'N/A'
      }
      case 'finalPosition': {
        const num = post.finalPosition
        return num !== null ? num.toLocaleString() : '-'
      }
      case 'originalTitle':
        return post.originalTitle || ''
      case 'sourceUrl':
      case 'imageUrl': {
        const urlVal = post[columnKey as keyof ScoredPost] as string
        return urlVal ? (
          <a
            href={urlVal}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-primary hover:text-blue-700"
            onClick={(e) => e.stopPropagation()}
          >
            View
          </a>
        ) : 'N/A'
      }
      default:
        return String(post[columnKey as keyof ScoredPost] || '')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">Error: {error}</div>
        <button
          onClick={() => fetchPosts()}
          className="text-brand-primary hover:text-blue-700"
        >
          Try Again
        </button>
      </div>
    )
  }

  const enabledColumns = columns.filter(col => col.enabled)

  return (
    <div className="py-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Scored Posts
        </h2>
        <p className="text-sm text-gray-600">
          View all ingested and scored RSS posts with criteria scores and details.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        {/* Date Range Filter */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ingest Date Range
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {(['7d', '30d', '90d', 'custom'] as DatePreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => handleDatePresetChange(preset)}
                className={`px-3 py-1.5 text-sm rounded-md border ${
                  datePreset === preset
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {preset === '7d' ? 'Past 7 Days' : preset === '30d' ? 'Past 30 Days' : preset === '90d' ? 'Past 90 Days' : 'Custom'}
              </button>
            ))}
            {datePreset === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                />
                <span className="text-gray-500 text-sm">to</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                />
                <button
                  onClick={applyCustomDateRange}
                  disabled={!DATE_REGEX.test(customFrom) || !DATE_REGEX.test(customTo)}
                  className="px-3 py-1.5 text-sm rounded-md bg-brand-primary text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Section
            </label>
            <select
              value={feedTypeFilter}
              onChange={(e) => setFeedTypeFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Sections</option>
              {uniqueFeedTypes.map(feedType => (
                <option key={feedType} value={feedType}>{feedType}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Position
            </label>
            <select
              value={positionFilter}
              onChange={(e) => {
                const val = e.target.value
                if (val === 'all' || val === 'all_used') {
                  setPositionFilter(val)
                } else {
                  setPositionFilter(parseInt(val))
                }
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Posts</option>
              <option value="all_used">Used in Issue</option>
              {uniquePositions.map(pos => (
                <option key={pos} value={pos}>Position {pos}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              placeholder="Title, author, feed..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Min Score
            </label>
            <input
              type="number"
              placeholder="0"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value ? parseFloat(e.target.value) : '')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Score
            </label>
            <input
              type="number"
              placeholder="100"
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value ? parseFloat(e.target.value) : '')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Showing {filteredPosts.length} of {posts.length} scored posts (page {currentPage} of {totalPages}, {totalPosts} total)
            {sortColumn && (
              <span className="ml-2 text-gray-500">
                | Sorted by {columns.find(c => c.key === sortColumn)?.label} ({sortDirection === 'desc' ? 'Z→A / High→Low' : 'A→Z / Low→High'})
              </span>
            )}
          </div>
          <div className="flex gap-3">
            {sortColumn && (
              <button
                onClick={clearSort}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear Sort
              </button>
            )}
            <button
              onClick={clearFilters}
              className="text-sm text-brand-primary hover:text-blue-700"
            >
              Clear Filters
            </button>
            <button
              onClick={() => setShowColumnSelector(!showColumnSelector)}
              className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded"
            >
              Select Columns
            </button>
            <button
              onClick={exportToCSV}
              className="text-sm bg-brand-primary hover:bg-blue-700 text-white px-3 py-1 rounded"
            >
              Download CSV
            </button>
          </div>
        </div>

        {/* Column Selector */}
        {showColumnSelector && (
          <div className="mt-4 p-4 bg-gray-50 rounded border border-gray-200">
            <h3 className="text-sm font-semibold mb-2">Select Columns to Display</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {columns.map(col => (
                <label key={col.key} className="flex items-center space-x-2 text-sm">
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
      </div>

      {/* Posts Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-w-full">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {enabledColumns.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none ${getColumnWidthClass(col.width)}`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="truncate">{col.label}</span>
                      <span className="text-gray-400 flex-shrink-0">
                        {sortColumn === col.key ? (
                          sortDirection === 'desc' ? '▼' : '▲'
                        ) : null}
                      </span>
                    </div>
                  </th>
                ))}
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">

                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPosts.length === 0 ? (
                <tr>
                  <td colSpan={enabledColumns.length + 1} className="px-2 py-8 text-center text-gray-500">
                    No scored posts found
                  </td>
                </tr>
              ) : (
                filteredPosts.map((post) => (
                  <>
                    <tr key={post.id} className="hover:bg-gray-50">
                      {enabledColumns.map(col => (
                        <td key={col.key} className={`px-2 py-2 text-sm text-gray-900 break-words ${getColumnWidthClass(col.width)}`}>
                          {renderCellContent(post, col.key)}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-sm font-medium whitespace-nowrap w-16">
                        <button
                          onClick={() => toggleRow(post.id)}
                          className="text-brand-primary hover:text-blue-700"
                        >
                          {expandedRow === post.id ? 'Hide' : 'Details'}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Details Row */}
                    {expandedRow === post.id && (
                      <tr>
                        <td colSpan={enabledColumns.length + 1} className="px-6 py-4 bg-gray-50">
                          <div className="space-y-4 max-w-4xl overflow-hidden">
                            {/* Original Content Section */}
                            <div>
                              <h3 className="text-sm font-semibold text-gray-900 mb-2">Original RSS Content</h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="font-medium text-gray-700">Publication Date:</span>
                                  <span className="ml-2 text-gray-600">{formatDate(post.publicationDate)}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700">Author:</span>
                                  <span className="ml-2 text-gray-600">{post.author || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700">Feed Name:</span>
                                  <span className="ml-2 text-gray-600">{post.feedName}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700">Source URL:</span>
                                  <a
                                    href={post.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-2 text-brand-primary hover:text-blue-700"
                                  >
                                    View Original
                                  </a>
                                </div>
                              </div>
                              <div className="mt-2 overflow-hidden">
                                <span className="font-medium text-gray-700">Description:</span>
                                <p className="mt-1 text-gray-600 break-words [word-break:break-word]">{post.originalDescription}</p>
                              </div>
                              <div className="mt-2 overflow-hidden">
                                <span className="font-medium text-gray-700">Full Article Text:</span>
                                <p className="mt-1 text-gray-600 max-h-40 overflow-y-auto break-words whitespace-pre-wrap [word-break:break-word]">
                                  {post.originalFullText || 'Not available'}
                                </p>
                              </div>
                              {post.imageUrl && (
                                <div className="mt-2">
                                  <span className="font-medium text-gray-700">Image:</span>
                                  <a
                                    href={post.imageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-2 text-brand-primary hover:text-blue-700"
                                  >
                                    View Image
                                  </a>
                                </div>
                              )}
                            </div>

                            {/* Scoring Section */}
                            <div>
                              <h3 className="text-sm font-semibold text-gray-900 mb-2">Scoring Details</h3>
                              <div className="mb-2 text-sm">
                                <span className="font-medium text-gray-700">Total Score:</span>
                                <span className="ml-2 text-gray-900 font-semibold">{post.totalScore?.toFixed(1) ?? 'N/A'}</span>
                                {post.finalPosition !== null && (
                                  <span className="ml-4 text-green-700 font-medium">Used in issue (Position {post.finalPosition})</span>
                                )}
                              </div>
                              <div className="space-y-2">
                                {post.criteria1Enabled && (
                                  <div className="border-l-4 border-blue-400 pl-3">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <span className="font-medium text-gray-700">{post.criteria1Name}</span>
                                      <span className="text-gray-900 whitespace-nowrap">
                                        Score: {post.criteria1Score}/10 (Weight: {post.criteria1Weight})
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1 break-words">{post.criteria1Reasoning}</p>
                                  </div>
                                )}
                                {post.criteria2Enabled && (
                                  <div className="border-l-4 border-green-400 pl-3">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <span className="font-medium text-gray-700">{post.criteria2Name}</span>
                                      <span className="text-gray-900 whitespace-nowrap">
                                        Score: {post.criteria2Score}/10 (Weight: {post.criteria2Weight})
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1 break-words">{post.criteria2Reasoning}</p>
                                  </div>
                                )}
                                {post.criteria3Enabled && (
                                  <div className="border-l-4 border-yellow-400 pl-3">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <span className="font-medium text-gray-700">{post.criteria3Name}</span>
                                      <span className="text-gray-900 whitespace-nowrap">
                                        Score: {post.criteria3Score}/10 (Weight: {post.criteria3Weight})
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1 break-words">{post.criteria3Reasoning}</p>
                                  </div>
                                )}
                                {post.criteria4Enabled && (
                                  <div className="border-l-4 border-red-400 pl-3">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <span className="font-medium text-gray-700">{post.criteria4Name}</span>
                                      <span className="text-gray-900 whitespace-nowrap">
                                        Score: {post.criteria4Score}/10 (Weight: {post.criteria4Weight})
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1 break-words">{post.criteria4Reasoning}</p>
                                  </div>
                                )}
                                {post.criteria5Enabled && (
                                  <div className="border-l-4 border-purple-400 pl-3">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <span className="font-medium text-gray-700">{post.criteria5Name}</span>
                                      <span className="text-gray-900 whitespace-nowrap">
                                        Score: {post.criteria5Score}/10 (Weight: {post.criteria5Weight})
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1 break-words">{post.criteria5Reasoning}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Page {currentPage} of {totalPages} ({totalPosts} total posts)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <span className="text-sm text-gray-700 px-2">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Last
            </button>
          </div>
        </div>
      )}

      {filteredPosts.length > 0 && (
        <div className="mt-2 text-sm text-gray-600">
          <p>
            This Page: {filteredPosts.length} |
            Primary: {filteredPosts.filter(a => a.feedType === 'Primary').length} |
            Secondary: {filteredPosts.filter(a => a.feedType === 'Secondary').length} |
            Used: {filteredPosts.filter(a => a.finalPosition !== null).length} |
            Avg Score: {(filteredPosts.reduce((sum, a) => sum + (a.totalScore || 0), 0) / filteredPosts.length).toFixed(1)}
          </p>
        </div>
      )}
    </div>
  )
}
