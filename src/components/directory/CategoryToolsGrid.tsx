'use client'

import { useState, useMemo } from 'react'
import { ToolCard } from './ToolCard'
import type { DirectoryApp } from '@/lib/directory'

interface CategoryToolsGridProps {
  tools: DirectoryApp[]
}

const ITEMS_PER_PAGE = 10
const MAX_SPONSORED_ON_FIRST_PAGE = 8

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

// Sort tools for category page with special first page logic
// Page 1: Featured (slot 1), Sponsored randomly in slots 2-9 (max 8), then affiliates/general
// Other pages: Continue with affiliates then general in random order
function sortToolsForCategoryPage(tools: DirectoryApp[], currentPage: number): {
  sortedTools: DirectoryApp[]
  totalTools: number
} {
  const dailySeed = getDailySeed()

  // Separate tools into tiers
  const featured = tools.filter(t => t.is_featured && !t.is_sponsored)
  const sponsored = tools.filter(t => t.is_sponsored)
  const affiliates = tools.filter(t => t.is_affiliate && !t.is_featured && !t.is_sponsored)
  const general = tools.filter(t => !t.is_featured && !t.is_sponsored && !t.is_affiliate)

  // Shuffle each tier
  const shuffledFeatured = shuffleWithSeed(featured, dailySeed + 1000)
  const shuffledSponsored = shuffleWithSeed(sponsored, dailySeed + 2000)
  const shuffledAffiliates = shuffleWithSeed(affiliates, dailySeed + 3000)
  const shuffledGeneral = shuffleWithSeed(general, dailySeed + 4000)

  // Cap sponsored at 8 for first page placement
  const sponsoredForFirstPage = shuffledSponsored.slice(0, MAX_SPONSORED_ON_FIRST_PAGE)

  // Build the first page layout:
  // - Slot 1: Featured (if any) or first affiliate/general
  // - Slots 2-9: Sponsored tools randomly placed among affiliates/general
  // - Slot 10: Fill with remaining

  // Get tools that aren't featured or sponsored (for filling gaps)
  const fillerTools = [...shuffledAffiliates, ...shuffledGeneral]

  if (currentPage === 1) {
    const firstPageTools: DirectoryApp[] = []

    // Slot 1: Featured tool (max 1 on first page per clarification)
    if (shuffledFeatured.length > 0) {
      firstPageTools.push(shuffledFeatured[0])
    } else if (fillerTools.length > 0) {
      firstPageTools.push(fillerTools[0])
    }

    // Slots 2-9: Mix sponsored randomly with filler tools
    // We need to fill 8 slots (2-9) with sponsored tools placed randomly
    const slotsToFill = ITEMS_PER_PAGE - firstPageTools.length
    const remainingSponsored = [...sponsoredForFirstPage]
    const remainingFiller = fillerTools.filter(t => !firstPageTools.includes(t))

    // Create pool of tools for slots 2-9+
    const slotPool: DirectoryApp[] = []

    // Add sponsored tools
    slotPool.push(...remainingSponsored)

    // Fill remaining slots with filler tools
    const fillerNeeded = Math.max(0, slotsToFill - remainingSponsored.length)
    slotPool.push(...remainingFiller.slice(0, fillerNeeded))

    // Shuffle the pool to randomize sponsored placement within slots 2-9
    const shuffledPool = shuffleWithSeed(slotPool, dailySeed + 5000)
    firstPageTools.push(...shuffledPool)

    return {
      sortedTools: firstPageTools.slice(0, ITEMS_PER_PAGE),
      totalTools: tools.length
    }
  } else {
    // For pages after page 1:
    // Skip: featured (1), sponsored (up to 8), and filler used on page 1
    const firstPageFeaturedCount = Math.min(1, shuffledFeatured.length)
    const firstPageSponsoredCount = Math.min(MAX_SPONSORED_ON_FIRST_PAGE, sponsoredForFirstPage.length)
    const firstPageFillerCount = ITEMS_PER_PAGE - firstPageFeaturedCount - firstPageSponsoredCount

    // Remaining tools for subsequent pages
    const remainingFeatured = shuffledFeatured.slice(1) // Skip first featured
    const remainingFiller = fillerTools.slice(firstPageFillerCount)

    // Combine remaining: any extra featured, then affiliates, then general
    const remainingTools = [...remainingFeatured, ...remainingFiller]

    // Calculate pagination offset for page 2+
    const startIndex = (currentPage - 2) * ITEMS_PER_PAGE
    const pageTools = remainingTools.slice(startIndex, startIndex + ITEMS_PER_PAGE)

    return {
      sortedTools: pageTools,
      totalTools: tools.length
    }
  }
}

// Calculate total pages considering the special first page layout
function calculateTotalPages(tools: DirectoryApp[]): number {
  if (tools.length === 0) return 0
  if (tools.length <= ITEMS_PER_PAGE) return 1

  // First page holds ITEMS_PER_PAGE tools
  const remainingAfterFirstPage = tools.length - ITEMS_PER_PAGE
  const additionalPages = Math.ceil(remainingAfterFirstPage / ITEMS_PER_PAGE)

  return 1 + additionalPages
}

export function CategoryToolsGrid({ tools }: CategoryToolsGridProps) {
  const [currentPage, setCurrentPage] = useState(1)

  const totalPages = useMemo(() => calculateTotalPages(tools), [tools])

  const paginatedTools = useMemo(() => {
    const { sortedTools } = sortToolsForCategoryPage(tools, currentPage)
    return sortedTools
  }, [tools, currentPage])

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      pages.push(1)

      if (currentPage > 3) {
        pages.push('ellipsis')
      }

      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (currentPage < totalPages - 2) {
        pages.push('ellipsis')
      }

      if (totalPages > 1) {
        pages.push(totalPages)
      }
    }

    return pages
  }

  if (paginatedTools.length === 0) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Tools List */}
      <div className="flex flex-col gap-4">
        {paginatedTools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>

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

      {/* Page info */}
      {totalPages > 1 && (
        <p className="text-sm text-slate-500 text-center">
          Page {currentPage} of {totalPages}
        </p>
      )}
    </div>
  )
}
