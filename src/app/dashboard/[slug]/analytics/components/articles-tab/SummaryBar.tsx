'use client'

import type { ScoredPost } from './types'

interface SummaryBarProps {
  filteredPosts: ScoredPost[]
}

export default function SummaryBar({ filteredPosts }: SummaryBarProps) {
  if (filteredPosts.length === 0) return null

  const avgScore = (
    filteredPosts.reduce((sum, a) => sum + (a.totalScore || 0), 0) / filteredPosts.length
  ).toFixed(1)

  return (
    <div className="mt-2 text-sm text-gray-600">
      <p>
        This Page: {filteredPosts.length} |
        Primary: {filteredPosts.filter(a => a.feedType === 'Primary').length} |
        Secondary: {filteredPosts.filter(a => a.feedType === 'Secondary').length} |
        Used: {filteredPosts.filter(a => a.finalPosition !== null).length} |
        Avg Score: {avgScore}
      </p>
    </div>
  )
}
