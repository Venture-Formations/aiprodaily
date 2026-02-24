'use client'

import { useState } from 'react'
import type { ArticleWithPost } from '@/types/database'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export default function SortableArticle({
  article,
  toggleArticle,
  skipArticle,
  saving,
  getScoreColor,
  criteriaConfig,
  maxTopArticles
}: {
  article: ArticleWithPost
  toggleArticle: (id: string, currentState: boolean) => void
  skipArticle: (id: string) => void
  saving: boolean
  getScoreColor: (score: number) => string
  criteriaConfig: Array<{name: string, weight: number}>
  maxTopArticles: number
}) {
  const [criteriaExpanded, setCriteriaExpanded] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: article.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-6 ${isDragging ? 'bg-gray-50' : ''} ${article.is_active ? 'border-l-4 border-blue-500' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-start space-x-3 mb-2">
            <button
              onClick={() => toggleArticle(article.id, article.is_active)}
              disabled={saving}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                article.is_active
                  ? 'bg-brand-primary border-brand-primary text-white'
                  : 'border-gray-300 hover:border-gray-400'
              } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {article.is_active && (
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>

            {/* Drag handle for active articles only */}
            {article.is_active && (
              <div
                {...attributes}
                {...listeners}
                style={{ touchAction: 'none' }}
                className="flex-shrink-0 cursor-move p-2 text-gray-400 hover:text-gray-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="Drag to reorder"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M7 2a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V4a2 2 0 00-2-2H7zM6 6h8v2H6V6zm0 4h8v2H6v-2zm0 4h8v2H6v-2z"/>
                </svg>
              </div>
            )}

            {/* Article image thumbnail */}
            {article.rss_post?.image_url && (
              <div className="flex-shrink-0">
                <img
                  src={article.rss_post.image_url}
                  alt=""
                  className="w-16 h-16 object-cover rounded-md border border-gray-200"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  {article.is_active && article.rank && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      #{article.rank}
                    </span>
                  )}
                  <h3 className="text-lg font-medium text-gray-900 pr-2">
                    {article.headline}
                  </h3>
                </div>
                {article.rss_post?.post_rating?.[0] && (
                  <div className="flex space-x-1 text-xs flex-shrink-0">
                    <span className={`font-medium ${getScoreColor(article.rss_post.post_rating[0].total_score)}`}>
                      Score: {article.rss_post.post_rating[0].total_score}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="text-gray-700 mb-3">
            {article.content}
          </p>

          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center space-x-4">
              <span>Source: {(() => {
                const author = article.rss_post?.author
                const feedName = article.rss_post?.rss_feed?.name

                // Use author if available and not "St. Cloud Local News"
                if (author && author !== 'St. Cloud Local News') {
                  return author
                }

                // Fall back to feed name if author is not useful
                return feedName || 'Unknown'
              })()}</span>
              <span>{article.word_count} words</span>
              {article.fact_check_score && (
                <span className={getScoreColor(article.fact_check_score)}>
                  Fact-check: {article.fact_check_score}/30
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {article.rss_post?.source_url && (
                <a
                  href={article.rss_post.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-primary hover:text-blue-700"
                >
                  View Original
                </a>
              )}
              <button
                onClick={() => skipArticle(article.id)}
                disabled={saving}
                className="bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded text-xs font-medium disabled:opacity-50"
                title="Skip this article - removes it from the issue"
              >
                Skip Article
              </button>
            </div>
          </div>

          {article.rss_post?.post_rating?.[0] && criteriaConfig.length > 0 && (
            <div className="mt-3 border-t border-gray-200 pt-3">
              <button
                onClick={() => setCriteriaExpanded(!criteriaExpanded)}
                className="flex items-center justify-between w-full text-left text-xs font-medium text-gray-700 hover:text-gray-900"
              >
                <span>Criteria Scores</span>
                <svg
                  className={`w-4 h-4 transform transition-transform ${criteriaExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {criteriaExpanded && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 text-xs mt-3">
                  {criteriaConfig.map((criterion, index) => {
                    // Use index directly - scores are stored in position order for each section
                    const criterionNum = index + 1
                    const score = article.rss_post.post_rating[0][`criteria_${criterionNum}_score` as keyof typeof article.rss_post.post_rating[0]]
                    // Always use the weight from criteriaConfig (context-appropriate for primary/secondary)
                    const weight = criterion.weight
                    const rawScore = typeof score === 'number' ? score : 0
                    const weightedScore = (rawScore * weight).toFixed(1)

                    return (
                      <div key={criterionNum} className="bg-gray-50 p-2 rounded">
                        <div className="text-gray-600 font-medium mb-1">{criterion.name}</div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Raw Score:</span>
                          <span className="font-semibold text-gray-900">{rawScore}/10</span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-gray-500">Weight:</span>
                          <span className="font-medium text-gray-700">{weight}x</span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5 pt-1 border-t border-gray-200">
                          <span className="text-gray-600 font-medium">Weighted:</span>
                          <span className="font-bold text-blue-600">{weightedScore}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
