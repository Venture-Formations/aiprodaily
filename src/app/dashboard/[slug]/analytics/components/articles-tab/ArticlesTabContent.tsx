'use client'

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
