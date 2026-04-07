'use client'

import type { Column, DatePreset } from './types'
import { DATE_REGEX } from './constants'

interface FilterBarProps {
  datePreset: DatePreset
  customFrom: string
  customTo: string
  feedTypeFilter: string
  positionFilter: 'all' | 'all_used' | number
  searchTerm: string
  minScore: number | ''
  maxScore: number | ''
  sortColumn: string | null
  sortDirection: 'asc' | 'desc'
  columns: Column[]
  enabledColumns: Column[]
  showColumnSelector: boolean
  filteredPosts: { length: number }
  posts: { length: number }
  currentPage: number
  totalPages: number
  totalPosts: number
  uniqueFeedTypes: string[]
  uniquePositions: number[]

  onDatePresetChange: (preset: DatePreset) => void
  onApplyCustomDateRange: () => void
  onCustomFromChange: (value: string) => void
  onCustomToChange: (value: string) => void
  onFeedTypeFilterChange: (value: string) => void
  onPositionFilterChange: (value: 'all' | 'all_used' | number) => void
  onSearchTermChange: (value: string) => void
  onMinScoreChange: (value: number | '') => void
  onMaxScoreChange: (value: number | '') => void
  onClearSort: () => void
  onClearFilters: () => void
  onToggleColumnSelector: () => void
  onToggleColumn: (key: string) => void
  onExportCSV: () => void
}

export default function FilterBar({
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
  showColumnSelector,
  filteredPosts,
  posts,
  currentPage,
  totalPages,
  totalPosts,
  uniqueFeedTypes,
  uniquePositions,

  onDatePresetChange,
  onApplyCustomDateRange,
  onCustomFromChange,
  onCustomToChange,
  onFeedTypeFilterChange,
  onPositionFilterChange,
  onSearchTermChange,
  onMinScoreChange,
  onMaxScoreChange,
  onClearSort,
  onClearFilters,
  onToggleColumnSelector,
  onToggleColumn,
  onExportCSV,
}: FilterBarProps) {
  return (
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
              onClick={() => onDatePresetChange(preset)}
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
                onChange={(e) => onCustomFromChange(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              />
              <span className="text-gray-500 text-sm">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => onCustomToChange(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              />
              <button
                onClick={onApplyCustomDateRange}
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
            onChange={(e) => onFeedTypeFilterChange(e.target.value)}
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
                onPositionFilterChange(val)
              } else {
                onPositionFilterChange(parseInt(val))
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
            onChange={(e) => onSearchTermChange(e.target.value)}
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
            onChange={(e) => onMinScoreChange(e.target.value ? parseFloat(e.target.value) : '')}
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
            onChange={(e) => onMaxScoreChange(e.target.value ? parseFloat(e.target.value) : '')}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-between items-center">
        <div className="text-sm text-gray-600">
          Showing {filteredPosts.length} of {posts.length} scored posts (page {currentPage} of {totalPages}, {totalPosts} total)
          {sortColumn && (
            <span className="ml-2 text-gray-500">
              | Sorted by {columns.find(c => c.key === sortColumn)?.label} ({sortDirection === 'desc' ? 'Z->A / High->Low' : 'A->Z / Low->High'})
            </span>
          )}
        </div>
        <div className="flex gap-3">
          {sortColumn && (
            <button
              onClick={onClearSort}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear Sort
            </button>
          )}
          <button
            onClick={onClearFilters}
            className="text-sm text-brand-primary hover:text-blue-700"
          >
            Clear Filters
          </button>
          <button
            onClick={onToggleColumnSelector}
            className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded"
          >
            Select Columns
          </button>
          <button
            onClick={onExportCSV}
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
                  onChange={() => onToggleColumn(col.key)}
                  className="rounded border-gray-300"
                />
                <span>{col.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
