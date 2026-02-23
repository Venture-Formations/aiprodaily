'use client'

import { useState } from 'react'
import type { ArticleWithPost } from '@/types/database'

export default function RegularArticle({
  article,
  toggleArticle,
  skipArticle,
  saving,
  getScoreColor,
  criteriaConfig
}: {
  article: ArticleWithPost
  toggleArticle: (id: string, currentState: boolean) => void
  skipArticle: (id: string) => void
  saving: boolean
  getScoreColor: (score: number) => string
  criteriaConfig: Array<{name: string, weight: number}>
}) {
  const [criteriaExpanded, setCriteriaExpanded] = useState(false)

  return (
    <div className="border-b border-gray-200 p-4 bg-white hover:bg-gray-50">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 flex flex-col items-center space-y-2">
          {/* Toggle button */}
          <button
            onClick={() => toggleArticle(article.id, article.is_active)}
            disabled={saving}
            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
              article.is_active
                ? 'bg-blue-600 border-blue-600'
                : 'border-gray-300 hover:border-blue-400'
            } ${saving ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'}`}
            title={article.is_active ? 'Remove from newsletter' : 'Add to newsletter'}
          >
            {article.is_active && (
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>

        {/* Article image thumbnail */}
        {article.rss_post?.image_url && (
          <div className="flex-shrink-0">
            <img
              src={article.rss_post.image_url}
              alt={article.headline}
              className="w-16 h-16 object-cover rounded border"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
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
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{article.content}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">
              Source: {(() => {
                const author = article.rss_post?.author
                const feedName = article.rss_post?.rss_feed?.name

                // Use author if available and not "St. Cloud Local News"
                if (author && author !== 'St. Cloud Local News') {
                  return author
                }

                // Fall back to feed name if author is not useful
                return feedName || 'Unknown'
              })()}
            </span>
            <div className="flex items-center space-x-2">
              {article.word_count && (
                <span className="text-xs text-gray-500">
                  {article.word_count} words
                </span>
              )}
              {article.rss_post?.source_url && (
                <a
                  href={article.rss_post.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-primary hover:text-blue-700 text-xs"
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
                    const criterionNum = index + 1
                    const score = article.rss_post.post_rating[0][`criteria_${criterionNum}_score` as keyof typeof article.rss_post.post_rating[0]]
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
