'use client'

import { useState, useMemo } from 'react'
import { ToolCard } from './ToolCard'
import type { DirectoryApp, DirectoryCategory } from '@/lib/directory'

interface ToolsGridProps {
  tools: DirectoryApp[]
  categories: DirectoryCategory[]
}

const ITEMS_PER_PAGE = 20

// Seeded random number generator for consistent daily ordering
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// Get today's date as a seed (same seed for entire day)
function getDailySeed(): number {
  const today = new Date()
  return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
}

// Shuffle array with seeded random for consistent daily ordering
function shuffleWithSeed<T>(array: T[], baseSeed: number): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const seed = baseSeed + i
    const j = Math.floor(seededRandom(seed) * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// Sort tools by tier with daily-seeded random ordering within each tier
function sortToolsByTier(tools: DirectoryApp[]): DirectoryApp[] {
  const dailySeed = getDailySeed()

  // Separate tools into tiers
  const featured = tools.filter(t => t.is_featured && !t.is_sponsored)
  const sponsored = tools.filter(t => t.is_sponsored)
  const affiliates = tools.filter(t => t.is_affiliate && !t.is_featured && !t.is_sponsored)
  const general = tools.filter(t => !t.is_featured && !t.is_sponsored && !t.is_affiliate)

  // Shuffle each tier with different seeds for variety
  const shuffledFeatured = shuffleWithSeed(featured, dailySeed + 1000)
  const shuffledSponsored = shuffleWithSeed(sponsored, dailySeed + 2000)
  const shuffledAffiliates = shuffleWithSeed(affiliates, dailySeed + 3000)
  const shuffledGeneral = shuffleWithSeed(general, dailySeed + 4000)

  // Return in priority order: featured, sponsored, affiliates, general
  return [...shuffledFeatured, ...shuffledSponsored, ...shuffledAffiliates, ...shuffledGeneral]
}

export function ToolsGrid({ tools, categories }: ToolsGridProps) {
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const filteredAndSortedTools = useMemo(() => {
    let filtered = tools

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(tool =>
        tool.tool_name.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query)
      )
    }

    // Filter by selected categories
    if (selectedCategories.size > 0) {
      filtered = filtered.filter(tool =>
        tool.categories.some(cat => selectedCategories.has(cat.id))
      )
    }

    // Sort by tier with daily-seeded random ordering
    return sortToolsByTier(filtered)
  }, [tools, selectedCategories, searchQuery])

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedTools.length / ITEMS_PER_PAGE)
  const paginatedTools = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredAndSortedTools.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  }, [filteredAndSortedTools, currentPage])

  // Reset to page 1 when filters change
  const toggleCategory = (categoryId: string) => {
    const newSelected = new Set(selectedCategories)
    if (newSelected.has(categoryId)) {
      newSelected.delete(categoryId)
    } else {
      newSelected.add(categoryId)
    }
    setSelectedCategories(newSelected)
    setCurrentPage(1)
  }

  const clearFilters = () => {
    setSelectedCategories(new Set())
    setSearchQuery('')
    setCurrentPage(1)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setCurrentPage(1)
  }

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible + 2) {
      // Show all pages if few enough
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)

      if (currentPage > 3) {
        pages.push('ellipsis')
      }

      // Show pages around current
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (currentPage < totalPages - 2) {
        pages.push('ellipsis')
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages)
      }
    }

    return pages
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search AI tools..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="w-full px-4 py-3 pl-10 rounded-xl bg-white ring-1 ring-slate-900/10 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow"
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        {categories.map(category => (
          <button
            key={category.id}
            onClick={() => toggleCategory(category.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedCategories.has(category.id)
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {category.name}
          </button>
        ))}
        {(selectedCategories.size > 0 || searchQuery) && (
          <button
            onClick={clearFilters}
            className="px-3 py-1.5 rounded-full text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results Count */}
      <p className="text-sm text-slate-500">
        Showing {paginatedTools.length} of {filteredAndSortedTools.length} tools
        {totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}
      </p>

      {/* Tools List */}
      {paginatedTools.length > 0 ? (
        <div className="flex flex-col gap-4">
          {paginatedTools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-slate-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-1">No tools found</h3>
          <p className="text-slate-500">Try adjusting your search or filter criteria</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-1 pt-4">
          {/* Previous button */}
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Page numbers */}
          {getPageNumbers().map((page, index) => (
            page === 'ellipsis' ? (
              <span key={`ellipsis-${index}`} className="px-3 py-2 text-slate-400">...</span>
            ) : (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentPage === page
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {page}
              </button>
            )
          ))}

          {/* Next button */}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </nav>
      )}
    </div>
  )
}
