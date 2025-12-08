'use client'

import { useState, useMemo } from 'react'
import { ToolCard } from './ToolCard'
import type { DirectoryApp, DirectoryCategory } from '@/lib/directory'

interface ToolsGridProps {
  tools: DirectoryApp[]
  categories: DirectoryCategory[]
}

export function ToolsGrid({ tools, categories }: ToolsGridProps) {
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  const filteredTools = useMemo(() => {
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

    return filtered
  }, [tools, selectedCategories, searchQuery])

  const toggleCategory = (categoryId: string) => {
    const newSelected = new Set(selectedCategories)
    if (newSelected.has(categoryId)) {
      newSelected.delete(categoryId)
    } else {
      newSelected.add(categoryId)
    }
    setSelectedCategories(newSelected)
  }

  const clearFilters = () => {
    setSelectedCategories(new Set())
    setSearchQuery('')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search AI tools..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
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
        Showing {filteredTools.length} of {tools.length} tools
      </p>

      {/* Tools List */}
      {filteredTools.length > 0 ? (
        <div className="flex flex-col gap-4">
          {filteredTools.map((tool) => (
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
    </div>
  )
}
