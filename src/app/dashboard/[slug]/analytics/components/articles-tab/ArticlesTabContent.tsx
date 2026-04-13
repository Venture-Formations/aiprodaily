'use client'

import { useMemo, useState } from 'react'
import type { ArticlesTabProps } from './types'
import { useArticlesTab } from './useArticlesTab'
import FilterBar from './FilterBar'
import PostsTable from './PostsTable'
import Pagination from './Pagination'
import SummaryBar from './SummaryBar'

export default function ArticlesTabContent({ slug }: ArticlesTabProps) {
  const {
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
    posts,
    uniquePositions,
    uniqueFeedTypes,
    companyScoredCounts,
    csvExporting,

    setShowColumnSelector,
    setCurrentPage,
    setCustomFrom,
    setCustomTo,
    setFeedTypeFilter,
    setPositionFilter,
    setSearchTerm,
    setMinScore,
    setMaxScore,

    handleDatePresetChange,
    applyCustomDateRange,
    handleSort,
    toggleColumn,
    toggleRow,
    clearFilters,
    clearSort,
    exportToCSV,
    fetchPosts,
  } = useArticlesTab(slug)

  const [companyThreshold, setCompanyThreshold] = useState(1)

  const uniqueCompaniesAboveThreshold = useMemo(() => {
    const counts = Object.values(companyScoredCounts)
    return counts.filter(c => c >= companyThreshold).length
  }, [companyScoredCounts, companyThreshold])

  const totalUniqueCompanies = Object.keys(companyScoredCounts).length

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

      {totalUniqueCompanies > 0 && (
        <div className="mb-4 flex items-center gap-2 text-sm bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
          <span className="text-gray-700">Unique companies with</span>
          <input
            type="number"
            min={1}
            value={companyThreshold}
            onChange={e => setCompanyThreshold(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm font-medium"
          />
          <span className="text-gray-700">scored {companyThreshold === 1 ? 'post' : 'posts'}:</span>
          <span className="font-bold text-gray-900">{uniqueCompaniesAboveThreshold}</span>
          <span className="text-gray-400 ml-1">/ {totalUniqueCompanies} total</span>
        </div>
      )}

      <FilterBar
        datePreset={datePreset}
        customFrom={customFrom}
        customTo={customTo}
        feedTypeFilter={feedTypeFilter}
        positionFilter={positionFilter}
        searchTerm={searchTerm}
        minScore={minScore}
        maxScore={maxScore}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        columns={columns}
        enabledColumns={enabledColumns}
        showColumnSelector={showColumnSelector}
        filteredPosts={filteredPosts}
        posts={posts}
        csvExporting={csvExporting}
        currentPage={currentPage}
        totalPages={totalPages}
        totalPosts={totalPosts}
        uniqueFeedTypes={uniqueFeedTypes}
        uniquePositions={uniquePositions}
        onDatePresetChange={handleDatePresetChange}
        onApplyCustomDateRange={applyCustomDateRange}
        onCustomFromChange={setCustomFrom}
        onCustomToChange={setCustomTo}
        onFeedTypeFilterChange={setFeedTypeFilter}
        onPositionFilterChange={setPositionFilter}
        onSearchTermChange={setSearchTerm}
        onMinScoreChange={setMinScore}
        onMaxScoreChange={setMaxScore}
        onClearSort={clearSort}
        onClearFilters={clearFilters}
        onToggleColumnSelector={() => setShowColumnSelector(!showColumnSelector)}
        onToggleColumn={toggleColumn}
        onExportCSV={exportToCSV}
      />

      <PostsTable
        filteredPosts={filteredPosts}
        enabledColumns={enabledColumns}
        expandedRow={expandedRow}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        onToggleRow={toggleRow}
      />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalPosts={totalPosts}
        onPageChange={setCurrentPage}
      />

      <SummaryBar filteredPosts={filteredPosts} />
    </div>
  )
}
