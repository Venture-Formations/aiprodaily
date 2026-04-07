'use client'

import type { AIAppModule } from '@/types/database'
import { CATEGORIES } from './types'

interface FiltersBarProps {
  searchQuery: string
  setSearchQuery: (query: string) => void
  filterCategory: string
  setFilterCategory: (category: string) => void
  filterAffiliate: string
  setFilterAffiliate: (affiliate: string) => void
  filterModule: string
  setFilterModule: (module: string) => void
  modules: AIAppModule[]
  filteredCount: number
  totalCount: number
}

export function FiltersBar({
  searchQuery,
  setSearchQuery,
  filterCategory,
  setFilterCategory,
  filterAffiliate,
  setFilterAffiliate,
  filterModule,
  setFilterModule,
  modules,
  filteredCount,
  totalCount
}: FiltersBarProps) {
  return (
    <div className="mb-4 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or description..."
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Category:</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="all">All Categories</option>
            <option value="uncategorized">No Category</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <label className="text-sm font-medium text-gray-700 ml-3">Affiliate:</label>
          <select
            value={filterAffiliate}
            onChange={(e) => setFilterAffiliate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="all">All</option>
            <option value="affiliates">Affiliates Only</option>
            <option value="non-affiliates">Non-Affiliates</option>
          </select>

          <label className="text-sm font-medium text-gray-700 ml-3">Module:</label>
          <select
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="all">All Modules</option>
            <option value="unassigned">Unassigned (Shared)</option>
            {modules.map(mod => (
              <option key={mod.id} value={mod.id}>{mod.name}</option>
            ))}
          </select>
        </div>
        <span className="text-sm text-gray-600 whitespace-nowrap">
          Showing {filteredCount} of {totalCount} applications
        </span>
      </div>
    </div>
  )
}
