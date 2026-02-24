'use client'

import { useState, useEffect } from 'react'

export default function BreakingNewsSection({ issue }: { issue: any }) {
  const [articles, setArticles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBreaking, setSelectedBreaking] = useState<string[]>([])
  const [selectedBeyondFeed, setSelectedBeyondFeed] = useState<string[]>([])
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    const fetchBreakingNews = async () => {
      try {
        // Fetch scored RSS posts for this issue
        const response = await fetch(`/api/campaigns/${issue.id}/breaking-news`)
        if (response.ok) {
          const data = await response.json()
          setArticles(data.articles || [])
          setSelectedBreaking(data.selectedBreaking || [])
          setSelectedBeyondFeed(data.selectedBeyondFeed || [])
        }
      } catch (error) {
        console.error('Failed to fetch breaking news:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBreakingNews()
  }, [issue.id])

  const handleBreakingToggle = async (articleId: string, isSelected: boolean) => {
    let newSelected: string[]

    if (isSelected) {
      if (selectedBreaking.length < 3) {
        newSelected = [...selectedBreaking, articleId]
      } else {
        alert('Maximum 3 articles for Breaking News section')
        return
      }
    } else {
      newSelected = selectedBreaking.filter(id => id !== articleId)
    }

    setUpdating(true)
    try {
      const response = await fetch(`/api/campaigns/${issue.id}/breaking-news`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          breaking: newSelected,
          beyond_feed: selectedBeyondFeed
        })
      })

      if (response.ok) {
        setSelectedBreaking(newSelected)
      }
    } catch (error) {
      console.error('Failed to update breaking news:', error)
    } finally {
      setUpdating(false)
    }
  }

  const handleBeyondFeedToggle = async (articleId: string, isSelected: boolean) => {
    let newSelected: string[]

    if (isSelected) {
      if (selectedBeyondFeed.length < 3) {
        newSelected = [...selectedBeyondFeed, articleId]
      } else {
        alert('Maximum 3 articles for Beyond the Feed section')
        return
      }
    } else {
      newSelected = selectedBeyondFeed.filter(id => id !== articleId)
    }

    setUpdating(true)
    try {
      const response = await fetch(`/api/campaigns/${issue.id}/breaking-news`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          breaking: selectedBreaking,
          beyond_feed: newSelected
        })
      })

      if (response.ok) {
        setSelectedBeyondFeed(newSelected)
      }
    } catch (error) {
      console.error('Failed to update beyond feed:', error)
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
        <span className="ml-3 text-gray-600">Loading Breaking News articles...</span>
      </div>
    )
  }

  const breakingArticles = articles.filter(a => a.breaking_news_category === 'breaking')
  const beyondFeedArticles = articles.filter(a => a.breaking_news_category === 'beyond_feed')

  return (
    <div className="p-6 space-y-6">
      {/* Breaking News Section */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="bg-red-50 px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-red-900">Breaking News (Top 3)</h3>
            <span className="text-sm text-red-700">{selectedBreaking.length}/3 selected</span>
          </div>
        </div>

        {breakingArticles.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No articles scored high enough for Breaking News (score ≥ 70)
            <div className="text-sm text-gray-400 mt-2">
              Run Breaking News RSS processing to fetch and score articles
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {breakingArticles.map(article => {
              const isSelected = selectedBreaking.includes(article.id)

              return (
                <div
                  key={article.id}
                  className={`p-4 transition-colors ${
                    isSelected ? 'bg-red-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleBreakingToggle(article.id, e.target.checked)}
                      disabled={updating}
                      className="mt-1 h-5 w-5 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">
                          {article.ai_title || article.title}
                        </h4>
                        <div className="flex items-center space-x-2 ml-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            article.breaking_news_score >= 85
                              ? 'bg-red-100 text-red-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}>
                            Score: {article.breaking_news_score}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {article.ai_summary || article.description}
                      </p>
                      <a
                        href={article.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        View source →
                      </a>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Beyond the Feed Section */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="bg-blue-50 px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-blue-900">Beyond the Feed (Next 3)</h3>
            <span className="text-sm text-blue-700">{selectedBeyondFeed.length}/3 selected</span>
          </div>
        </div>

        {beyondFeedArticles.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No articles scored in the Beyond Feed range (score 40-69)
            <div className="text-sm text-gray-400 mt-2">
              Run Breaking News RSS processing to fetch and score articles
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {beyondFeedArticles.map(article => {
              const isSelected = selectedBeyondFeed.includes(article.id)

              return (
                <div
                  key={article.id}
                  className={`p-4 transition-colors ${
                    isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleBeyondFeedToggle(article.id, e.target.checked)}
                      disabled={updating}
                      className="mt-1 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">
                          {article.ai_title || article.title}
                        </h4>
                        <div className="flex items-center space-x-2 ml-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            article.breaking_news_score >= 55
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            Score: {article.breaking_news_score}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {article.ai_summary || article.description}
                      </p>
                      <a
                        href={article.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        View source →
                      </a>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
