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
  feedType: 'Primary' | 'Secondary'
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
}

interface Column {
  key: string
  label: string
  enabled: boolean
  exportable: boolean
}

export default function ArticlesTab({ slug }: { slug: string }) {
  const [articles, setArticles] = useState<Article[]>([])
  const [filteredArticles, setFilteredArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [showColumnSelector, setShowColumnSelector] = useState(false)

  // Filter states
  const [feedTypeFilter, setFeedTypeFilter] = useState<'all' | 'Primary' | 'Secondary'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [minScore, setMinScore] = useState<number | ''>('')
  const [maxScore, setMaxScore] = useState<number | ''>('')

  // Column visibility states
  const [columns, setColumns] = useState<Column[]>([
    { key: 'issueDate', label: 'Issue Date', enabled: true, exportable: true },
    { key: 'finalPosition', label: 'Position', enabled: true, exportable: true },
    { key: 'feedType', label: 'Feed Type', enabled: true, exportable: true },
    { key: 'feedName', label: 'Feed Name', enabled: false, exportable: true },
    { key: 'originalTitle', label: 'Original Title', enabled: true, exportable: true },
    { key: 'originalDescription', label: 'Original Description', enabled: false, exportable: true },
    { key: 'originalFullText', label: 'Original Full Text', enabled: false, exportable: true },
    { key: 'publicationDate', label: 'Publication Date', enabled: false, exportable: true },
    { key: 'author', label: 'Author', enabled: false, exportable: true },
    { key: 'sourceUrl', label: 'Source URL', enabled: false, exportable: true },
    { key: 'imageUrl', label: 'Image URL', enabled: false, exportable: true },
    { key: 'criteria1Score', label: 'Criteria 1 Score', enabled: false, exportable: true },
    { key: 'criteria1Weight', label: 'Criteria 1 Weight', enabled: false, exportable: true },
    { key: 'criteria1Reasoning', label: 'Criteria 1 Reasoning', enabled: false, exportable: true },
    { key: 'criteria2Score', label: 'Criteria 2 Score', enabled: false, exportable: true },
    { key: 'criteria2Weight', label: 'Criteria 2 Weight', enabled: false, exportable: true },
    { key: 'criteria2Reasoning', label: 'Criteria 2 Reasoning', enabled: false, exportable: true },
    { key: 'criteria3Score', label: 'Criteria 3 Score', enabled: false, exportable: true },
    { key: 'criteria3Weight', label: 'Criteria 3 Weight', enabled: false, exportable: true },
    { key: 'criteria3Reasoning', label: 'Criteria 3 Reasoning', enabled: false, exportable: true },
    { key: 'criteria4Score', label: 'Criteria 4 Score', enabled: false, exportable: true },
    { key: 'criteria4Weight', label: 'Criteria 4 Weight', enabled: false, exportable: true },
    { key: 'criteria4Reasoning', label: 'Criteria 4 Reasoning', enabled: false, exportable: true },
    { key: 'criteria5Score', label: 'Criteria 5 Score', enabled: false, exportable: true },
    { key: 'criteria5Weight', label: 'Criteria 5 Weight', enabled: false, exportable: true },
    { key: 'criteria5Reasoning', label: 'Criteria 5 Reasoning', enabled: false, exportable: true },
    { key: 'totalScore', label: 'Total Score', enabled: true, exportable: true },
    { key: 'headline', label: 'Headline', enabled: true, exportable: true },
    { key: 'content', label: 'Content', enabled: false, exportable: true },
    { key: 'factCheckScore', label: 'Fact Check Score', enabled: false, exportable: true },
    { key: 'wordCount', label: 'Word Count', enabled: true, exportable: true },
  ])

  useEffect(() => {
    fetchArticles()
  }, [slug])

  useEffect(() => {
    applyFilters()
  }, [articles, feedTypeFilter, searchTerm, minScore, maxScore])

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

  const applyFilters = () => {
    let filtered = [...articles]

    if (feedTypeFilter !== 'all') {
      filtered = filtered.filter(a => a.feedType === feedTypeFilter)
    }

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

    setFilteredArticles(filtered)
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
    setSearchTerm('')
    setMinScore('')
    setMaxScore('')
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A'
    try {
      return new Date(dateStr).toLocaleDateString()
    } catch {
      return dateStr
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
        return (
          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
            article.feedType === 'Primary'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-purple-100 text-purple-800'
          }`}>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Feed Type
            </label>
            <select
              value={feedTypeFilter}
              onChange={(e) => setFeedTypeFilter(e.target.value as any)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="Primary">Primary</option>
              <option value="Secondary">Secondary</option>
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
          </div>
          <div className="flex gap-3">
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
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {enabledColumns.map(col => (
                  <th
                    key={col.key}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {col.label}
                  </th>
                ))}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredArticles.length === 0 ? (
                <tr>
                  <td colSpan={enabledColumns.length + 1} className="px-6 py-8 text-center text-gray-500">
                    No articles found
                  </td>
                </tr>
              ) : (
                filteredArticles.map((article) => (
                  <>
                    <tr key={article.id} className="hover:bg-gray-50">
                      {enabledColumns.map(col => (
                        <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {renderCellContent(article, col.key)}
                        </td>
                      ))}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
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
                          <div className="space-y-4 max-w-full overflow-hidden">
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
                              <div className="mt-2">
                                <span className="font-medium text-gray-700">Description:</span>
                                <p className="mt-1 text-gray-600 break-words">{article.originalDescription}</p>
                              </div>
                              <div className="mt-2">
                                <span className="font-medium text-gray-700">Full Article Text:</span>
                                <p className="mt-1 text-gray-600 max-h-40 overflow-y-auto break-words whitespace-pre-wrap">
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
                                <div>
                                  <span className="font-medium text-gray-700">Content:</span>
                                  <div
                                    className="mt-1 text-gray-600 prose prose-sm max-w-none break-words overflow-hidden"
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
