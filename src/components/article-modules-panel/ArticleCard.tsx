'use client'

import { useState } from 'react'
import type { ArticleWithRssPost, CriteriaConfig } from './types'

interface ArticleCardProps {
  article: ArticleWithRssPost
  criteriaConfig: CriteriaConfig[]
  isSent: boolean
  saving: string | null
  onToggle: (articleId: string, currentState: boolean) => void
  onSkip: (articleId: string) => void
  getScoreColor: (score: number) => string
  dragHandleProps?: any
  showDragHandle?: boolean
}

export function ArticleCard({
  article,
  criteriaConfig,
  isSent,
  saving,
  onToggle,
  onSkip,
  getScoreColor,
  dragHandleProps,
  showDragHandle = false
}: ArticleCardProps) {
  const [criteriaExpanded, setCriteriaExpanded] = useState(false)
  const isSaving = saving === article.id
  const isActive = article.is_active

  const rssPost = article.rss_post
  const postRating = rssPost?.post_ratings?.[0]
  const score = postRating?.total_score

  const source = (() => {
    const author = rssPost?.author
    const feedName = rssPost?.rss_feed?.name
    if (author && author !== 'St. Cloud Local News') return author
    return feedName || 'Unknown'
  })()

  return (
    <div className={`bg-white rounded-lg border ${isActive ? 'border-blue-300 border-l-4 border-l-blue-500' : 'border-gray-200'} p-4`}>
      <div className="flex items-start space-x-3">
        {/* Checkbox */}
        <button
          onClick={() => !isSent && onToggle(article.id, isActive)}
          disabled={isSent || isSaving}
          className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
            isActive
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'border-gray-300 hover:border-blue-400'
          } ${isSent || isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {isActive && (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        {/* Drag Handle */}
        {showDragHandle && !isSent && (
          <div
            {...dragHandleProps}
            className="flex-shrink-0 cursor-move p-1 text-gray-400 hover:text-gray-600"
            title="Drag to reorder"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V4a2 2 0 00-2-2H7zM6 6h8v2H6V6zm0 4h8v2H6v-2zm0 4h8v2H6v-2z"/>
            </svg>
          </div>
        )}

        {/* Rank Badge */}
        {isActive && article.rank && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 flex-shrink-0">
            #{article.rank}
          </span>
        )}

        {/* Image Thumbnail */}
        {rssPost?.image_url && (
          <div className="flex-shrink-0">
            <img
              src={rssPost.image_url}
              alt=""
              className="w-16 h-16 object-cover rounded border border-gray-200"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <h3 className="text-base font-medium text-gray-900 pr-2">{article.headline}</h3>
            {score !== undefined && (
              <span className={`text-sm font-medium flex-shrink-0 ${getScoreColor(score)}`}>
                Score: {score}
              </span>
            )}
          </div>

          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{article.content}</p>

          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            <div className="flex items-center space-x-3">
              <span>Source: {source}</span>
              {article.word_count && <span>{article.word_count} words</span>}
              {article.fact_check_score !== undefined && article.fact_check_score !== null && (
                <span className={getScoreColor(article.fact_check_score * 10)}>
                  Fact-check: {article.fact_check_score}/30
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {rssPost?.source_url && (
                <a
                  href={rssPost.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700"
                >
                  View Original
                </a>
              )}
              {!isSent && (
                <button
                  onClick={() => onSkip(article.id)}
                  disabled={isSaving}
                  className="bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded text-xs font-medium disabled:opacity-50"
                  title="Skip this article"
                >
                  Skip Article
                </button>
              )}
            </div>
          </div>

          {/* Criteria Scores */}
          {postRating && criteriaConfig.length > 0 && (
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
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-3">
                  {criteriaConfig.map((criterion) => {
                    const criterionKey = `criteria_${criterion.criteria_number}_score` as keyof typeof postRating
                    const rawScore = (postRating[criterionKey] as number) || 0
                    const weight = criterion.weight
                    const weightedScore = (rawScore * weight).toFixed(1)

                    return (
                      <div key={criterion.id} className="bg-gray-50 p-2 rounded text-xs">
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
