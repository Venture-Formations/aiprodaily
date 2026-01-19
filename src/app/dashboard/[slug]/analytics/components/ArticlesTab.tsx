'use client'

import { useEffect, useState } from 'react'

interface Article {
  id: string
  originalTitle: string
  originalDescription: string
  originalFullText: string
  publicationDate: string
  author: string
  sourceUrl: string
  imageUrl: string
  feedType: string
  feedName: string
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
  headline: string
  content: string
  factCheckScore: number | null
  wordCount: number | null
  finalPosition: number | null
  createdAt: string
  issueDate: string
  // Click metrics (for sent articles)
  uniqueClickers: number | null
  totalClicks: number | null
  totalRecipients: number | null
  ctr: number | null
}

interface Column {
  key: string
  label: string
  enabled: boolean
  exportable: boolean
  width?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' // Column width hint
}

export default function ArticlesTab({ slug }: { slug: string }) {
  const [articles, setArticles] = useState<Article[]>([])
  const [filteredArticles, setFilteredArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [showColumnSelector, setShowColumnSelector] = useState(false)

  // Filter states
  const [feedTypeFilter, setFeedTypeFilter] = useState<string>('all')
  const [positionFilter, setPositionFilter] = useState<'all' | 'all_sent' | number>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [minScore, setMinScore] = useState<number | ''>('')
  const [maxScore, setMaxScore] = useState<number | ''>('')

  // Sort states
  const [sortColumn, setSortColumn] = useState<string | null>('issueDate')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Get unique positions for filter dropdown
  const uniquePositions = Array.from(new Set(articles.filter(a => a.finalPosition !== null).map(a => a.finalPosition as number))).sort((a, b) => a - b)

  // Get unique feed types for filter dropdown (includes module names)
  const uniqueFeedTypes = Array.from(new Set(articles.map(a => a.feedType))).filter(Boolean).sort()

  // Column visibility states with width hints:
  // xs: ~50px (tiny numbers), sm: ~70px (small numbers/short), md: ~100px (medium), lg: ~180px (text), xl: ~280px (long text)
  const [columns, setColumns] = useState<Column[]>([
    { key: 'issueDate', label: 'Issue Date', enabled: true, exportable: true, width: 'sm' },
    { key: 'finalPosition', label: 'Pos', enabled: true, exportable: true, width: 'xs' },
    { key: 'feedType', label: 'Section', enabled: true, exportable: true, width: 'lg' },
    { key: 'feedName', label: 'Feed Name', enabled: false, exportable: true, width: 'md' },
    { key: 'originalTitle', label: 'Original Title', enabled: true, exportable: true, width: 'lg' },
    { key: 'originalDescription', label: 'Original Description', enabled: false, exportable: true, width: 'xl' },
    { key: 'originalFullText', label: 'Original Full Text', enabled: false, exportable: true, width: 'xl' },
    { key: 'publicationDate', label: 'Pub Date', enabled: false, exportable: true, width: 'sm' },
    { key: 'author', label: 'Author', enabled: false, exportable: true, width: 'md' },
    { key: 'sourceUrl', label: 'Source', enabled: false, exportable: true, width: 'xs' },
    { key: 'imageUrl', label: 'Image', enabled: false, exportable: true, width: 'xs' },
    { key: 'criteria1Score', label: 'C1', enabled: false, exportable: true, width: 'xs' },
    { key: 'criteria1Weight', label: 'C1 Wt', enabled: false, exportable: true, width: 'xs' },
    { key: 'criteria1Reasoning', label: 'C1 Reasoning', enabled: false, exportable: true, width: 'xl' },
    { key: 'criteria2Score', label: 'C2', enabled: false, exportable: true, width: 'xs' },
    { key: 'criteria2Weight', label: 'C2 Wt', enabled: false, exportable: true, width: 'xs' },
    { key: 'criteria2Reasoning', label: 'C2 Reasoning', enabled: false, exportable: true, width: 'xl' },
    { key: 'criteria3Score', label: 'C3', enabled: false, exportable: true, width: 'xs' },
    { key: 'criteria3Weight', label: 'C3 Wt', enabled: false, exportable: true, width: 'xs' },
    { key: 'criteria3Reasoning', label: 'C3 Reasoning', enabled: false, exportable: true, width: 'xl' },
    { key: 'criteria4Score', label: 'C4', enabled: false, exportable: true, width: 'xs' },
    { key: 'criteria4Weight', label: 'C4 Wt', enabled: false, exportable: true, width: 'xs' },
    { key: 'criteria4Reasoning', label: 'C4 Reasoning', enabled: false, exportable: true, width: 'xl' },
    { key: 'criteria5Score', label: 'C5', enabled: false, exportable: true, width: 'xs' },
    { key: 'criteria5Weight', label: 'C5 Wt', enabled: false, exportable: true, width: 'xs' },
    { key: 'criteria5Reasoning', label: 'C5 Reasoning', enabled: false, exportable: true, width: 'xl' },
    { key: 'totalScore', label: 'Score', enabled: true, exportable: true, width: 'xs' },
    { key: 'headline', label: 'Headline', enabled: true, exportable: true, width: 'lg' },
    { key: 'content', label: 'Content', enabled: false, exportable: true, width: 'xl' },
    { key: 'factCheckScore', label: 'Fact', enabled: false, exportable: true, width: 'xs' },
    { key: 'wordCount', label: 'Words', enabled: true, exportable: true, width: 'xs' },
    { key: 'uniqueClickers', label: 'Clickers', enabled: true, exportable: true, width: 'xs' },
    { key: 'totalClicks', label: 'Clicks', enabled: true, exportable: true, width: 'xs' },
    { key: 'ctr', label: 'CTR', enabled: true, exportable: true, width: 'xs' },
    { key: 'totalRecipients', label: 'Sent', enabled: false, exportable: true, width: 'xs' },
  ])

  useEffect(() => {
    fetchArticles()
  }, [slug])

  useEffect(() => {
    applyFiltersAndSort()
  }, [articles, feedTypeFilter, positionFilter, searchTerm, minScore, maxScore, sortColumn, sortDirection])

  const fetchArticles = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/databases/articles?publication_id=${slug}`)
      if (!response.ok) {
        throw new Error('Failed to fetch articles')
      }
      const result = await response.json()
      setArticles(result.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const applyFiltersAndSort = () => {
    let filtered = [...articles]

    if (feedTypeFilter !== 'all') {
      filtered = filtered.filter(a => a.feedType === feedTypeFilter)
    }

    // Position filter
    if (positionFilter === 'all_sent') {
      // Show only articles that were sent (have a position)
      filtered = filtered.filter(a => a.finalPosition !== null)
    } else if (typeof positionFilter === 'number') {
      // Show articles with specific position
      filtered = filtered.filter(a => a.finalPosition === positionFilter)
    }
    // 'all' shows everything including unsent articles

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(a =>
        a.originalTitle.toLowerCase().includes(term) ||
        a.headline.toLowerCase().includes(term) ||
        a.author.toLowerCase().includes(term) ||
        a.feedName.toLowerCase().includes(term)
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
        const aVal = a[sortColumn as keyof Article]
        const bVal = b[sortColumn as keyof Article]

        // Handle null/undefined values - push them to the end
        if (aVal === null || aVal === undefined || aVal === '') {
          return sortDirection === 'asc' ? 1 : -1
        }
        if (bVal === null || bVal === undefined || bVal === '') {
          return sortDirection === 'asc' ? -1 : 1
        }

        // Date columns
        if (sortColumn === 'issueDate' || sortColumn === 'publicationDate' || sortColumn === 'createdAt') {
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
        if (sortDirection === 'asc') {
          return strA.localeCompare(strB)
        } else {
          return strB.localeCompare(strA)
        }
      })
    }

    setFilteredArticles(filtered)
  }

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // New column - start with descending
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
  }

  const clearSort = () => {
    setSortColumn(null)
    setSortDirection('desc')
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A'
    try {
      return new Date(dateStr).toLocaleDateString()
    } catch {
      return dateStr
    }
  }

  // Get CSS classes for column width
  const getColumnWidthClass = (width?: 'xs' | 'sm' | 'md' | 'lg' | 'xl') => {
    switch (width) {
      case 'xs': return 'w-14 min-w-[3.5rem] max-w-[4rem]'    // ~56px for tiny numbers
      case 'sm': return 'w-20 min-w-[5rem] max-w-[6rem]'      // ~80px for dates, short text
      case 'md': return 'w-28 min-w-[7rem] max-w-[8rem]'      // ~112px for medium text
      case 'lg': return 'w-44 min-w-[11rem] max-w-[14rem]'    // ~176px for titles
      case 'xl': return 'w-64 min-w-[16rem] max-w-[20rem]'    // ~256px for long text
      default: return 'w-24'
    }
  }

  const truncateText = (text: string, maxLength: number) => {
    if (!text) return ''
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
  }

  const stripHtml = (html: string) => {
    const tmp = document.createElement('div')
    tmp.innerHTML = html
    return tmp.textContent || tmp.innerText || ''
  }

  const getColumnValue = (article: Article, key: string): string => {
    const value = article[key as keyof Article]

    if (value === null || value === undefined) return ''
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'number') return value.toString()
    if (key === 'content') return stripHtml(value as string)
    return value.toString()
  }

  const exportToCSV = () => {
    const enabledColumns = columns.filter(col => col.enabled && col.exportable)

    // CSV Headers
    const headers = enabledColumns.map(col => col.label).join(',')

    // CSV Rows
    const rows = filteredArticles.map(article => {
      return enabledColumns.map(col => {
        const value = getColumnValue(article, col.key)
        // Escape quotes and wrap in quotes if contains comma or quote
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      }).join(',')
    })

    const csv = [headers, ...rows].join('\n')

    // Create download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `articles-export-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const renderCellContent = (article: Article, columnKey: string) => {
    switch (columnKey) {
      case 'issueDate':
      case 'publicationDate':
      case 'createdAt':
        return formatDate(article[columnKey as keyof Article] as string)
      case 'feedType':
        // Dynamic color based on section type
        const getColorClass = (type: string) => {
          if (type === 'Primary') return 'bg-blue-100 text-blue-800'
          if (type === 'Secondary') return 'bg-purple-100 text-purple-800'
          // Module sections get distinct colors
          return 'bg-green-100 text-green-800'
        }
        return (
          <span
            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full max-w-full truncate ${getColorClass(article.feedType)}`}
            title={article.feedType}
          >
            {article.feedType}
          </span>
        )
      case 'totalScore':
      case 'factCheckScore':
      case 'criteria1Score':
      case 'criteria2Score':
      case 'criteria3Score':
      case 'criteria4Score':
      case 'criteria5Score':
        const score = article[columnKey as keyof Article] as number | null
        return score !== null ? score.toFixed(1) : 'N/A'
      case 'wordCount':
      case 'finalPosition':
        const num = article[columnKey as keyof Article] as number | null
        return num !== null ? num.toLocaleString() : 'N/A'
      case 'originalTitle':
      case 'headline':
        return truncateText(article[columnKey as keyof Article] as string, 60)
      case 'sourceUrl':
      case 'imageUrl':
        const url = article[columnKey as keyof Article] as string
        return url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-primary hover:text-blue-700"
            onClick={(e) => e.stopPropagation()}
          >
            View
          </a>
        ) : 'N/A'
      case 'content':
        return truncateText(stripHtml(article.content), 60)
      case 'uniqueClickers':
      case 'totalClicks':
      case 'totalRecipients':
        const clickNum = article[columnKey as keyof Article] as number | null
        return clickNum !== null ? clickNum.toLocaleString() : '-'
      case 'ctr':
        const ctrValue = article.ctr
        return ctrValue !== null ? `${ctrValue.toFixed(2)}%` : '-'
      default:
        return truncateText(String(article[columnKey as keyof Article] || ''), 60)
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
          onClick={fetchArticles}
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
          Articles Database
        </h2>
        <p className="text-sm text-gray-600">
          View all current and past articles with original RSS content, scoring details, and generated content.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
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
                if (val === 'all' || val === 'all_sent') {
                  setPositionFilter(val)
                } else {
                  setPositionFilter(parseInt(val))
                }
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Articles</option>
              <option value="all_sent">All Sent</option>
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
              placeholder="Title, headline, author..."
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
            Showing {filteredArticles.length} of {articles.length} articles
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

      {/* Articles Table */}
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
              {filteredArticles.length === 0 ? (
                <tr>
                  <td colSpan={enabledColumns.length + 1} className="px-2 py-8 text-center text-gray-500">
                    No articles found
                  </td>
                </tr>
              ) : (
                filteredArticles.map((article) => (
                  <>
                    <tr key={article.id} className="hover:bg-gray-50">
                      {enabledColumns.map(col => (
                        <td key={col.key} className={`px-2 py-2 text-sm text-gray-900 break-words ${getColumnWidthClass(col.width)}`}>
                          {renderCellContent(article, col.key)}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-sm font-medium whitespace-nowrap w-16">
                        <button
                          onClick={() => toggleRow(article.id)}
                          className="text-brand-primary hover:text-blue-700"
                        >
                          {expandedRow === article.id ? 'Hide' : 'Details'}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Details Row */}
                    {expandedRow === article.id && (
                      <tr>
                        <td colSpan={enabledColumns.length + 1} className="px-6 py-4 bg-gray-50">
                          <div className="space-y-4 max-w-4xl overflow-hidden">
                            {/* Original Content Section */}
                            <div>
                              <h3 className="text-sm font-semibold text-gray-900 mb-2">Original RSS Content</h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="font-medium text-gray-700">Publication Date:</span>
                                  <span className="ml-2 text-gray-600">{formatDate(article.publicationDate)}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700">Author:</span>
                                  <span className="ml-2 text-gray-600">{article.author || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700">Feed Name:</span>
                                  <span className="ml-2 text-gray-600">{article.feedName}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700">Source URL:</span>
                                  <a
                                    href={article.sourceUrl}
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
                                <p className="mt-1 text-gray-600 break-words [word-break:break-word]">{article.originalDescription}</p>
                              </div>
                              <div className="mt-2 overflow-hidden">
                                <span className="font-medium text-gray-700">Full Article Text:</span>
                                <p className="mt-1 text-gray-600 max-h-40 overflow-y-auto break-words whitespace-pre-wrap [word-break:break-word]">
                                  {article.originalFullText || 'Not available'}
                                </p>
                              </div>
                              {article.imageUrl && (
                                <div className="mt-2">
                                  <span className="font-medium text-gray-700">Image:</span>
                                  <a
                                    href={article.imageUrl}
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
                              <div className="space-y-2">
                                {article.criteria1Enabled && (
                                  <div className="border-l-4 border-blue-400 pl-3">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <span className="font-medium text-gray-700">{article.criteria1Name}</span>
                                      <span className="text-gray-900 whitespace-nowrap">
                                        Score: {article.criteria1Score}/10 (Weight: {article.criteria1Weight})
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1 break-words">{article.criteria1Reasoning}</p>
                                  </div>
                                )}
                                {article.criteria2Enabled && (
                                  <div className="border-l-4 border-green-400 pl-3">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <span className="font-medium text-gray-700">{article.criteria2Name}</span>
                                      <span className="text-gray-900 whitespace-nowrap">
                                        Score: {article.criteria2Score}/10 (Weight: {article.criteria2Weight})
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1 break-words">{article.criteria2Reasoning}</p>
                                  </div>
                                )}
                                {article.criteria3Enabled && (
                                  <div className="border-l-4 border-yellow-400 pl-3">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <span className="font-medium text-gray-700">{article.criteria3Name}</span>
                                      <span className="text-gray-900 whitespace-nowrap">
                                        Score: {article.criteria3Score}/10 (Weight: {article.criteria3Weight})
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1 break-words">{article.criteria3Reasoning}</p>
                                  </div>
                                )}
                                {article.criteria4Enabled && (
                                  <div className="border-l-4 border-red-400 pl-3">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <span className="font-medium text-gray-700">{article.criteria4Name}</span>
                                      <span className="text-gray-900 whitespace-nowrap">
                                        Score: {article.criteria4Score}/10 (Weight: {article.criteria4Weight})
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1 break-words">{article.criteria4Reasoning}</p>
                                  </div>
                                )}
                                {article.criteria5Enabled && (
                                  <div className="border-l-4 border-purple-400 pl-3">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <span className="font-medium text-gray-700">{article.criteria5Name}</span>
                                      <span className="text-gray-900 whitespace-nowrap">
                                        Score: {article.criteria5Score}/10 (Weight: {article.criteria5Weight})
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1 break-words">{article.criteria5Reasoning}</p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Generated Content Section */}
                            <div>
                              <h3 className="text-sm font-semibold text-gray-900 mb-2">Generated Article</h3>
                              <div className="space-y-2">
                                <div>
                                  <span className="font-medium text-gray-700">Headline:</span>
                                  <p className="mt-1 text-gray-900 break-words">{article.headline}</p>
                                </div>
                                <div className="overflow-hidden">
                                  <span className="font-medium text-gray-700">Content:</span>
                                  <div
                                    className="mt-1 text-gray-600 prose prose-sm max-w-prose break-words overflow-hidden [word-break:break-word]"
                                    dangerouslySetInnerHTML={{ __html: article.content }}
                                  />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <span className="font-medium text-gray-700">Fact Check Score:</span>
                                    <span className="ml-2 text-gray-900">
                                      {article.factCheckScore?.toFixed(1) || 'N/A'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-medium text-gray-700">Word Count:</span>
                                    <span className="ml-2 text-gray-900">
                                      {article.wordCount?.toLocaleString() || 'N/A'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-medium text-gray-700">Created:</span>
                                    <span className="ml-2 text-gray-900">{formatDate(article.createdAt)}</span>
                                  </div>
                                </div>
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

      {filteredArticles.length > 0 && (
        <div className="mt-4 text-sm text-gray-600">
          <p>
            Total Articles: {filteredArticles.length} |
            Primary: {filteredArticles.filter(a => a.feedType === 'Primary').length} |
            Secondary: {filteredArticles.filter(a => a.feedType === 'Secondary').length} |
            Avg Score: {(filteredArticles.reduce((sum, a) => sum + (a.totalScore || 0), 0) / filteredArticles.length).toFixed(1)}
          </p>
        </div>
      )}
    </div>
  )
}
