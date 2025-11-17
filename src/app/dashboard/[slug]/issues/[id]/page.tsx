'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import DeleteIssueModal from '@/components/DeleteIssueModal'
import type { issueWithArticles, ArticleWithPost, issueEvent, Event, NewsletterSection } from '@/types/database'
import {
  DndContext,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import {
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Helper function to process ad body and make last sentence a link
function processAdBody(body: string, buttonUrl?: string): string {
  if (!buttonUrl || !body) return body

  // Strip HTML to get plain text
  const plainText = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  // Find all sentence-ending punctuation marks (., !, ?)
  // But exclude periods that are part of domains (.com, .ai, .io, etc.) or abbreviations
  const sentenceEndPattern = /[.!?](?=\s+[A-Z]|$)/g
  const matches = Array.from(plainText.matchAll(sentenceEndPattern))

  if (matches.length > 0) {
    // Get the position of the last sentence-ending punctuation
    const lastMatch = matches[matches.length - 1] as RegExpMatchArray
    const lastPeriodIndex = lastMatch.index!

    // Find the second-to-last sentence-ending punctuation
    let startIndex = 0
    if (matches.length > 1) {
      const secondLastMatch = matches[matches.length - 2] as RegExpMatchArray
      startIndex = secondLastMatch.index! + 1
    }

    // Extract the last complete sentence (from after previous punctuation to end, including the final punctuation)
    const lastSentence = plainText.substring(startIndex, lastPeriodIndex + 1).trim()

    if (lastSentence.length > 5) {
      // Escape special regex characters
      const escapedSentence = lastSentence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

      // Replace in the original HTML
      // Look for the sentence text, accounting for HTML tags that might be in between
      const parts = escapedSentence.split(/\s+/)
      const flexiblePattern = parts.join('\\s*(?:<[^>]*>\\s*)*')
      const sentenceRegex = new RegExp(flexiblePattern, 'i')

      return body.replace(
        sentenceRegex,
        `<a href='${buttonUrl}' target='_blank' rel='noopener noreferrer' style='color: #000; text-decoration: underline; font-weight: bold;'>$&</a>`
      )
    }
  } else {
    // No sentence-ending punctuation found - wrap the entire text
    const trimmedText = plainText.trim()
    if (trimmedText.length > 5) {
      const escapedText = trimmedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const parts = escapedText.split(/\s+/)
      const flexiblePattern = parts.join('\\s*(?:<[^>]*>\\s*)*')
      const textRegex = new RegExp(flexiblePattern, 'i')

      return body.replace(
        textRegex,
        `<a href='${buttonUrl}' target='_blank' rel='noopener noreferrer' style='color: #000; text-decoration: underline; font-weight: bold;'>$&</a>`
      )
    }
  }

  return body
}

// Section Components
function WelcomeSection({ issue, onRegenerate }: { issue: any; onRegenerate?: () => void }) {
  const [regenerating, setRegenerating] = useState(false)

  if (!issue) {
    return (
      <div className="text-center py-8 text-gray-500">
        No issue data available
      </div>
    )
  }

  const hasContent = issue.welcome_intro || issue.welcome_tagline || issue.welcome_summary

  const handleRegenerate = async () => {
    if (!issue?.id) return

    setRegenerating(true)
    try {
      const response = await fetch(`/api/campaigns/${issue.id}/regenerate-welcome`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Failed to regenerate welcome section')
      }

      // Refresh issue data
      if (onRegenerate) {
        onRegenerate()
      }
    } catch (error) {
      console.error('Error regenerating welcome:', error)
      alert('Failed to regenerate welcome section')
    } finally {
      setRegenerating(false)
    }
  }

  if (!hasContent) {
    return (
      <div className="p-6">
        <div className="text-center py-8 text-gray-500">
          Welcome section has not been generated yet.
          <br />
          <span className="text-sm text-gray-400">
            This will be automatically generated during RSS processing.
          </span>
        </div>
        <div className="text-center mt-4">
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium"
          >
            {regenerating ? 'Generating...' : 'Generate Welcome Section'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="border border-gray-200 rounded-lg bg-white shadow-sm p-6 space-y-3">
        {issue.welcome_intro && (
          <div className="text-gray-700">
            {issue.welcome_intro}
          </div>
        )}
        {issue.welcome_tagline && (
          <div className="text-gray-700 font-bold">
            {issue.welcome_tagline}
          </div>
        )}
        {issue.welcome_summary && (
          <div className="text-gray-700">
            {issue.welcome_summary}
          </div>
        )}
      </div>
      <div className="text-center mt-4">
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-800 px-4 py-2 rounded text-sm font-medium"
        >
          {regenerating ? 'Regenerating...' : 'Regenerate Welcome Section'}
        </button>
        <p className="text-xs text-gray-500 mt-2">
          Regenerate to reflect current article selection
        </p>
      </div>
    </div>
  )
}

function PromptIdeasSection({ issue }: { issue: any }) {
  const [prompt, setPrompt] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPrompt = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/campaigns/${issue.id}/prompt`)
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.prompt) {
            setPrompt(data.prompt)
          }
        }
      } catch (error) {
        console.error('Failed to fetch prompt:', error)
      } finally {
        setLoading(false)
      }
    }

    if (issue?.id) {
      fetchPrompt()
    }
  }, [issue?.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
        <span className="ml-3 text-gray-600">Loading prompt...</span>
      </div>
    )
  }

  if (!prompt) {
    return (
      <div className="text-center py-8 text-gray-500">
        No prompt selected for this issue
      </div>
    )
  }

  return (
    <div className="p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-4">{prompt.title}</h3>
      <div
        className="p-6 rounded-lg font-mono text-sm leading-relaxed"
        style={{
          backgroundColor: '#000000',
          color: '#00FF00',
          fontFamily: "'Courier New', Courier, monospace",
          whiteSpace: 'pre-wrap',
          border: '2px solid #333'
        }}
      >
        {prompt.prompt_text}
      </div>
      {prompt.use_case && (
        <div className="mt-4 text-sm text-gray-600">
          <strong>Use Case:</strong> {prompt.use_case}
        </div>
      )}
      {prompt.category && (
        <div className="mt-2 text-sm text-gray-600">
          <strong>Category:</strong> {prompt.category}
        </div>
      )}
    </div>
  )
}

function AIAppsSection({ issue }: { issue: any }) {
  const [aiApps, setAiApps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAIApps = async () => {
      try {
        // AI apps are already loaded with issue data
        if (issue?.issue_ai_app_selections) {
          const sortedApps = [...issue.issue_ai_app_selections]
            .sort((a, b) => a.selection_order - b.selection_order)
          setAiApps(sortedApps)
        }
      } catch (error) {
        console.error('Failed to load AI apps:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAIApps()
  }, [issue])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
        <span className="ml-3 text-gray-600">Loading AI Applications...</span>
      </div>
    )
  }

  if (!aiApps || aiApps.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No AI Applications selected for this issue
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="grid gap-4">
        {aiApps.map((selection) => {
          const app = selection.app
          if (!app) return null

          return (
            <div
              key={selection.id}
              className={`border rounded-lg p-4 ${
                selection.is_featured
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="text-lg font-bold text-gray-900">
                    {app.app_name}
                    {selection.is_featured && (
                      <span className="ml-2 text-sm text-blue-600 font-normal">
                        ⭐ Featured
                      </span>
                    )}
                  </h4>
                  {app.tagline && (
                    <p className="text-sm text-gray-600 italic mt-1">
                      {app.tagline}
                    </p>
                  )}
                  <p className="text-sm text-gray-700 mt-2">
                    {app.description}
                  </p>
                  {app.website_url && (
                    <a
                      href={app.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline mt-2 inline-block"
                    >
                      Learn more →
                    </a>
                  )}
                </div>
                {app.category && (
                  <span className="ml-4 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                    {app.category}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AdvertorialSection({ issue, sectionName }: { issue: any; sectionName: string }) {
  // Get ad from issue data
  const ad = issue?.issue_advertisements?.[0]?.advertisement

  if (!ad) {
    return (
      <div className="text-center py-8 text-gray-500">
        No advertisement selected for this issue.
        <br />
        <span className="text-sm text-gray-400">
          An ad will be automatically selected during RSS processing.
        </span>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-4 text-sm text-gray-600 flex justify-between items-center">
        <div>
          <strong>Selected Ad:</strong> {ad.title}
        </div>
        <div className="text-xs text-gray-400">
          Times used: {ad.times_used || 0} | Display order: {ad.display_order}
        </div>
      </div>

      {/* Styled to match email appearance - single card with header as first element */}
      <div className="max-w-3xl mx-auto">
        <div className="border border-gray-300 rounded-lg bg-white shadow-lg overflow-hidden">
          {/* Header - part of the card with no gap */}
          <div className="bg-blue-600 px-4 py-3">
            <h2 className="text-white text-2xl font-bold m-0">{sectionName}</h2>
          </div>

          {/* Title - inside card, left-justified */}
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-xl font-bold text-left m-0">{ad.title}</h3>
          </div>

          {/* Image - clickable */}
          {ad.image_url && (
            <div className="px-4 text-center">
              {ad.button_url ? (
                <a href={ad.button_url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={ad.image_url}
                    alt={ad.title}
                    className="inline-block max-w-full max-h-[500px] rounded cursor-pointer"
                  />
                </a>
              ) : (
                <img
                  src={ad.image_url}
                  alt={ad.title}
                  className="inline-block max-w-full max-h-[500px] rounded"
                />
              )}
            </div>
          )}

          {/* Body - with last line as link */}
          <div
            className="px-4 pb-4 text-base leading-relaxed [&_a]:text-blue-600 [&_a]:underline [&_b]:font-bold [&_strong]:font-bold"
            dangerouslySetInnerHTML={{ __html: processAdBody(ad.body, ad.button_url) }}
          />
        </div>
      </div>
    </div>
  )
}

function BreakingNewsSection({ issue }: { issue: any }) {
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

function PollSection({ issue }: { issue: any }) {
  const [activePoll, setActivePoll] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [responseCount, setResponseCount] = useState(0)
  const [isHistoricalPoll, setIsHistoricalPoll] = useState(false)

  useEffect(() => {
    const fetchPollData = async () => {
      try {
        // For sent issues, show the poll that was actually included (from poll_snapshot)
        if (issue.status === 'sent' && issue.poll_snapshot) {
          setActivePoll(issue.poll_snapshot)
          setIsHistoricalPoll(true)
          // Fetch response count for this specific poll
          if (issue.poll_id) {
            const responsesResponse = await fetch(`/api/polls/${issue.poll_id}/responses?publication_id=${issue.publication_id}`)
            if (responsesResponse.ok) {
              const responsesData = await responsesResponse.json()
              setResponseCount(responsesData.responses?.length || 0)
            }
          }
        } else {
          // For non-sent issues, show the current active poll
          const response = await fetch(`/api/polls/active?publication_id=${issue.publication_id}`)
          if (response.ok) {
            const data = await response.json()
            if (data.poll) {
              setActivePoll(data.poll)
              setIsHistoricalPoll(false)
              // Fetch response count for this poll
              const responsesResponse = await fetch(`/api/polls/${data.poll.id}/responses?publication_id=${issue.publication_id}`)
              if (responsesResponse.ok) {
                const responsesData = await responsesResponse.json()
                setResponseCount(responsesData.responses?.length || 0)
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch poll data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (issue?.publication_id) {
      fetchPollData()
    } else {
      setLoading(false)
    }
  }, [issue?.publication_id, issue?.status, issue?.poll_snapshot, issue?.poll_id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
        <span className="ml-3 text-gray-600">Loading poll data...</span>
      </div>
    )
  }

  if (!activePoll) {
    return (
      <div className="p-6">
        <div className="text-center py-8 text-gray-500">
          {issue.status === 'sent'
            ? 'No poll was included in this issue.'
            : 'No active poll found. Create and activate a poll in the Poll Management section.'}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="bg-gray-50 rounded-lg p-6">
        <div className="mb-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-medium text-gray-900">
              {activePoll.title}
            </h3>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
              isHistoricalPoll
                ? 'bg-blue-100 text-blue-800'
                : 'bg-green-100 text-green-800'
            }`}>
              {isHistoricalPoll ? 'Sent with Issue' : 'Active'}
            </span>
          </div>
          <p className="text-gray-700 text-base mb-4">{activePoll.question}</p>
        </div>

        <div className="space-y-2 mb-4">
          <h4 className="text-sm font-medium text-gray-700">Options:</h4>
          {activePoll.options && activePoll.options.map((option: string, index: number) => (
            <div key={index} className="flex items-center space-x-3 bg-white p-3 rounded-lg border border-gray-200">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
                {String.fromCharCode(65 + index)}
              </span>
              <span className="text-gray-900">{option}</span>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Total Responses:</span>
            <span className="font-semibold text-gray-900">{responseCount}</span>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {isHistoricalPoll
              ? 'This poll was included when the newsletter was sent.'
              : 'This poll will appear in the newsletter and track subscriber responses.'}
          </div>
        </div>
      </div>
    </div>
  )
}

// Newsletter Section Component
function NewsletterSectionComponent({
  section,
  issue,
  expanded,
  onToggleExpanded
}: {
  section: NewsletterSection
  issue: issueWithArticles | null
  expanded: boolean
  onToggleExpanded: () => void
}) {
  if (!issue) return null

  // Section ID constants (reference IDs from newsletter_sections table)
  // These IDs are stable and won't change even if section names are updated
  const SECTION_IDS = {
    AI_APPLICATIONS: '853f8d0b-bc76-473a-bfc6-421418266222',
    PROMPT_IDEAS: 'a917ac63-6cf0-428b-afe7-60a74fbf160b',
    ADVERTISEMENT: 'c0bc7173-de47-41b2-a260-77f55525ee3d'
  }

  const renderSectionContent = () => {
    // Use section ID for AI Applications (stable across name changes)
    if (section.id === SECTION_IDS.AI_APPLICATIONS) {
      return <AIAppsSection issue={issue} />
    }

    // Use section ID for Prompt Ideas (stable across name changes)
    if (section.id === SECTION_IDS.PROMPT_IDEAS) {
      return <PromptIdeasSection issue={issue} />
    }

    // Use section ID for Advertisement (stable across name changes)
    if (section.id === SECTION_IDS.ADVERTISEMENT) {
      return <AdvertorialSection issue={issue} sectionName={section.name} />
    }

    // Legacy name-based matching for other sections
    switch (section.name) {
      case 'Welcome':
        return <WelcomeSection issue={issue} onRegenerate={() => {
          // Refresh issue data after regenerating
          if (issue?.id) {
            fetch(`/api/campaigns/${issue.id}`)
              .then(res => res.json())
              .then(data => {
                // Update issue state with fresh data
                window.location.reload() // Simple solution - reload the page
              })
          }
        }} />
      case 'Poll':
        return <PollSection issue={issue} />
      case 'Breaking News':
        return <BreakingNewsSection issue={issue} />
      case 'Beyond the Feed':
        return (
          <div className="text-center py-8 text-gray-500">
            Beyond the Feed articles are managed in the Breaking News section
            <br />
            <span className="text-sm text-gray-400">
              Both Breaking News and Beyond the Feed are selected together
            </span>
          </div>
        )
      default:
        return (
          <div className="text-center py-8 text-gray-500">
            {section.name} content will be generated automatically in the newsletter preview and sent emails.
            <br />
            <span className="text-sm text-gray-400">
              This section is active and will appear in the correct order based on your settings.
            </span>
          </div>
        )
    }
  }

  return (
    <div className="bg-white shadow rounded-lg mt-6">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">
            {section.name}
          </h2>
          <button
            onClick={() => {
              onToggleExpanded()
            }}
            className="flex items-center space-x-2 text-sm text-brand-primary hover:text-blue-700"
          >
            <span>{expanded ? 'Minimize' : `View ${section.name}`}</span>
            <svg
              className={`w-4 h-4 transform transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        <div className="mt-2 text-sm text-gray-600">
          Display Order: {section.display_order} | Status: {section.is_active ? 'Active' : 'Inactive'}
        </div>
      </div>

      {expanded && renderSectionContent()}
    </div>
  )
}

// Events Manager Component
function EventsManager({
  issue,
  availableEvents,
  issueEvents,
  onUpdateEvents,
  updating
}: {
  issue: issueWithArticles | null
  availableEvents: Event[]
  issueEvents: issueEvent[]
  onUpdateEvents: (eventDate: string, selectedEvents: string[], featuredEvent?: string) => void
  updating: boolean
}) {
  if (!issue) return null

  // Calculate 3-day range starting from the newsletter date (issue.date)
  // Day 1: Newsletter date, Day 2: Next day, Day 3: Day after that
  const newsletterDate = new Date(issue.date + 'T00:00:00') // Parse as local date

  const dates = []
  for (let i = 0; i <= 2; i++) {
    const date = new Date(newsletterDate)
    date.setDate(newsletterDate.getDate() + i)
    dates.push(date.toISOString().split('T')[0])
  }

  const getEventsForDate = (date: string) => {
    // Create date range in Central Time (UTC-5)
    const dateStart = new Date(date + 'T00:00:00-05:00')
    const dateEnd = new Date(date + 'T23:59:59-05:00')

    return availableEvents.filter(event => {
      const eventStart = new Date(event.start_date)
      const eventEnd = event.end_date ? new Date(event.end_date) : eventStart

      // Event overlaps with this date
      return (eventStart <= dateEnd && eventEnd >= dateStart)
    })
  }

  const getSelectedEventsForDate = (date: string) => {
    return issueEvents
      .filter(ce => ce.event_date === date && ce.is_selected)
      .sort((a, b) => (a.display_order || 999) - (b.display_order || 999))
  }

  const getFeaturedEventForDate = (date: string) => {
    // Only return manual featured if no database-featured events exist for this date
    const hasDatabaseFeatured = getEventsForDate(date).some(event => event.featured === true)
    if (hasDatabaseFeatured) {
      return null // Disable manual featuring when database-featured exists
    }
    const featured = issueEvents.find(ce => ce.event_date === date && ce.is_featured)
    return featured?.event_id
  }

  const handleEventToggle = (date: string, eventId: string, isSelected: boolean) => {
    const currentSelected = getSelectedEventsForDate(date).map(ce => ce.event_id)
    const currentFeatured = getFeaturedEventForDate(date)

    let newSelected: string[]
    if (isSelected) {
      // Add event if under limit
      if (currentSelected.length < 8) {
        newSelected = [...currentSelected, eventId]
      } else {
        return // Don't add if at limit
      }
    } else {
      // Remove event
      newSelected = currentSelected.filter(id => id !== eventId)
    }

    // Clear featured if we're removing the featured event
    const newFeatured = newSelected.includes(currentFeatured || '') ? currentFeatured : undefined

    onUpdateEvents(date, newSelected, newFeatured ?? undefined)
  }

  const handleFeaturedToggle = async (date: string, eventId: string) => {
    const currentSelected = getSelectedEventsForDate(date).map(ce => ce.event_id)
    const currentFeatured = getFeaturedEventForDate(date)

    // If unfeaturing, just do it
    if (currentFeatured === eventId) {
      onUpdateEvents(date, currentSelected, undefined)
      return
    }

    // If featuring, check if event has an image
    const event = availableEvents.find(e => e.id === eventId)
    if (event && !event.cropped_image_url) {
      // Show confirmation dialog
      const result = await new Promise<'yes' | 'add-image' | 'cancel'>((resolve) => {
        const dialog = document.createElement('div')
        dialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
        dialog.innerHTML = `
          <div class="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
            <h3 class="text-lg font-semibold text-gray-900 mb-3">Featured Event Without Image</h3>
            <p class="text-gray-600 mb-6">This event doesn't have an image. Featured events with images get better engagement. Would you like to add an image?</p>
            <div class="flex space-x-3">
              <button id="cancel-btn" class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md font-medium">Cancel</button>
              <button id="yes-btn" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium">Yes, Continue</button>
              <button id="add-image-btn" class="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium">Add Image</button>
            </div>
          </div>
        `
        document.body.appendChild(dialog)

        const cleanup = () => document.body.removeChild(dialog)

        dialog.querySelector('#cancel-btn')?.addEventListener('click', () => {
          cleanup()
          resolve('cancel')
        })

        dialog.querySelector('#yes-btn')?.addEventListener('click', () => {
          cleanup()
          resolve('yes')
        })

        dialog.querySelector('#add-image-btn')?.addEventListener('click', () => {
          cleanup()
          resolve('add-image')
        })
      })

      if (result === 'cancel') {
        return
      }

      if (result === 'add-image') {
        // Open event edit page in new tab
        window.open(`/dashboard/databases/events?edit=${eventId}`, '_blank')
        return
      }

      // If 'yes', continue with featuring
    }

    const newFeatured = eventId
    onUpdateEvents(date, currentSelected, newFeatured)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00')
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatEventTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Select up to 8 events per day. Mark one event as "featured" to highlight it in the newsletter.
      </div>

      {/* 3-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {dates.map(date => {
          const dateEvents = getEventsForDate(date)
          const selectedEvents = getSelectedEventsForDate(date)
          const featuredEventId = getFeaturedEventForDate(date)

          return (
            <div key={date} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Date Header */}
              <div className="bg-blue-600 text-white px-4 py-3">
                <h3 className="text-lg font-semibold text-center">
                  {formatDate(date)}
                </h3>
                <div className="text-sm text-blue-100 text-center mt-1">
                  {selectedEvents.length}/8 events selected
                </div>
              </div>

              {/* Events List */}
              <div className="p-4 bg-white min-h-[400px]">
                {dateEvents.length === 0 ? (
                  <div className="text-gray-500 text-sm py-8 text-center">
                    {selectedEvents.length > 0 ? 'Click "Local Events" to see available events for selection' : 'No events available for this date'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dateEvents.map(event => {
                      const isSelected = selectedEvents.some(ce => ce.event_id === event.id)
                      const isDatabaseFeatured = event.featured === true // Featured in events table
                      const isFeatured = featuredEventId === event.id // Manually featured in issue
                      const hasDatabaseFeatured = dateEvents.some(e => e.featured === true)

                      return (
                        <div
                          key={event.id}
                          className={`p-3 rounded-lg border-2 transition-all ${
                            isDatabaseFeatured || isFeatured
                              ? 'border-blue-500 bg-blue-50 shadow-md'
                              : isSelected
                                ? 'border-green-300 bg-green-50'
                                : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {/* Event Header with Checkbox */}
                          <div className="flex items-start justify-between mb-2">
                            <button
                              onClick={() => handleEventToggle(date, event.id, !isSelected)}
                              disabled={updating || (!isSelected && selectedEvents.length >= 8)}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                isSelected
                                  ? 'bg-brand-primary border-brand-primary text-white'
                                  : 'border-gray-300 hover:border-gray-400'
                              } ${updating || (!isSelected && selectedEvents.length >= 8) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              {isSelected && (
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>

                            {/* Database-Featured Badge (read-only, gold) */}
                            {isDatabaseFeatured && (
                              <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300 rounded">
                                ⭐ Featured
                              </span>
                            )}

                            {/* Manual Feature Button (only if no database-featured exists) */}
                            {!isDatabaseFeatured && !hasDatabaseFeatured && isSelected && (
                              <button
                                onClick={() => handleFeaturedToggle(date, event.id)}
                                disabled={updating}
                                className={`px-2 py-1 text-xs rounded border ${
                                  isFeatured
                                    ? 'bg-blue-500 text-white border-blue-500'
                                    : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                                } ${updating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                {isFeatured ? '⭐ Featured' : 'Feature'}
                              </button>
                            )}
                          </div>

                          {/* Event Details and Image */}
                          <div className="flex items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="text-sm font-semibold text-gray-900 leading-tight">
                                  {event.title}
                                </h4>
                                {event.paid_placement && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                    Sponsored
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-600 space-y-1">
                                <div className="font-medium">{formatEventTime(event.start_date)}</div>
                                {event.venue && <div>{event.venue}</div>}
                                {event.address && <div className="text-gray-500">{event.address}</div>}
                              </div>
                            </div>

                            {/* Featured Event Image */}
                            {(isDatabaseFeatured || isFeatured) && event.cropped_image_url && (
                              <div className="ml-3 flex-shrink-0">
                                <img
                                  src={event.cropped_image_url}
                                  alt={event.title}
                                  className="w-24 h-20 object-cover rounded border border-blue-300"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Regular Article Component (for inactive articles)
function RegularArticle({
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
        </div>
      </div>
    </div>
  )
}

// Sortable Article Component (for active articles only)
function SortableArticle({
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
                className="flex-shrink-0 cursor-move mt-1 p-1 text-gray-400 hover:text-gray-600"
                title="Drag to reorder"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
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
            <div className="mt-3">
              <div className="text-xs font-medium text-gray-700 mb-2">Criteria Scores:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 text-xs">
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function issueDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [issue, setissue] = useState<issueWithArticles | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState('')
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [generatingSubject, setGeneratingSubject] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  const [editingSubject, setEditingSubject] = useState(false)
  const [editSubjectValue, setEditSubjectValue] = useState('')
  const [savingSubject, setSavingSubject] = useState(false)

  // Events state
  const [issueEvents, setissueEvents] = useState<issueEvent[]>([])
  const [availableEvents, setAvailableEvents] = useState<Event[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [eventsExpanded, setEventsExpanded] = useState(false)
  const [updatingEvents, setUpdatingEvents] = useState(false)
  const [articlesExpanded, setArticlesExpanded] = useState(false)
  const [secondaryArticlesExpanded, setSecondaryArticlesExpanded] = useState(false)

  // Newsletter sections state
  const [newsletterSections, setNewsletterSections] = useState<NewsletterSection[]>([])
  const [loadingSections, setLoadingSections] = useState(false)

  // Section IDs for Top and Secondary Articles (to filter from dynamic sections)
  // Use section_type for reliable identification
  const primaryArticlesSection = newsletterSections.find(s =>
    s.section_type === 'primary_articles'
  )
  const secondaryArticlesSection = newsletterSections.find(s =>
    s.section_type === 'secondary_articles'
  )

  // Criteria and article limits state
  const [criteriaConfig, setCriteriaConfig] = useState<Array<{name: string, weight: number}>>([])
  const [secondaryCriteriaConfig, setSecondaryCriteriaConfig] = useState<Array<{name: string, weight: number}>>([])
  const [maxTopArticles, setMaxTopArticles] = useState(3)
  const [maxBottomArticles, setMaxBottomArticles] = useState(3)
  const [maxSecondaryArticles, setMaxSecondaryArticles] = useState(3)
  const [sectionExpandedStates, setSectionExpandedStates] = useState<{ [key: string]: boolean }>({})

  // Drag and drop sensors with activation constraints for better mobile experience
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 250, // 250ms delay before drag starts (better for mobile)
        tolerance: 5, // Allow 5px of movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    console.log('📄 issue page loaded, params:', params.id)
    if (params.id) {
      fetchissue(params.id as string)
      fetchissueEvents(params.id as string)
      fetchNewsletterSections()
      fetchCriteriaConfig()
    }
  }, [params.id])

  // Poll for status updates when issue is processing
  useEffect(() => {
    if (!issue || issue.status !== 'processing') {
      return
    }

    console.log('🔄 issue is processing, starting status polling...')

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/campaigns/${issue.id}`)
        if (response.ok) {
          const data = await response.json()
          const newStatus = data.issue.status

          console.log(`📊 Status poll: ${newStatus}`)

          if (newStatus !== 'processing') {
            console.log('✅ Processing complete! Refreshing issue data...')
            clearInterval(pollInterval)
            // Refresh all issue data
            await fetchissue(issue.id)
            await fetchissueEvents(issue.id)
          }
        }
      } catch (error) {
        console.error('Status poll error:', error)
      }
    }, 3000) // Poll every 3 seconds

    return () => clearInterval(pollInterval)
  }, [issue?.status, issue?.id])

  const fetchissue = async (id: string) => {
    try {
      const response = await fetch(`/api/campaigns/${id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch issue')
      }
      const data = await response.json()
      setissue(data.issue)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const fetchissueEvents = async (issueId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${issueId}/events`)
      if (response.ok) {
        const data = await response.json()
        setissueEvents(data.issue_events || [])
      }
    } catch (error) {
      console.error('Failed to fetch issue events:', error)
    }
  }

  const fetchCriteriaConfig = async () => {
    try {
      const response = await fetch('/api/settings/email')
      if (response.ok) {
        const data = await response.json()

        // Get enabled criteria counts for primary and secondary
        const primaryEnabledCountSetting = data.settings.find((s: any) => s.key === 'primary_criteria_enabled_count')
        const secondaryEnabledCountSetting = data.settings.find((s: any) => s.key === 'secondary_criteria_enabled_count')

        // Fallback to old criteria_enabled_count key if new ones don't exist
        const fallbackEnabledCountSetting = data.settings.find((s: any) => s.key === 'criteria_enabled_count')

        const primaryEnabledCount = primaryEnabledCountSetting?.value ? parseInt(primaryEnabledCountSetting.value) :
                                     (fallbackEnabledCountSetting?.value ? parseInt(fallbackEnabledCountSetting.value) : 3)
        const secondaryEnabledCount = secondaryEnabledCountSetting?.value ? parseInt(secondaryEnabledCountSetting.value) :
                                       (fallbackEnabledCountSetting?.value ? parseInt(fallbackEnabledCountSetting.value) : 3)

        // Build PRIMARY criteria config array
        const primaryCriteria: Array<{name: string, weight: number}> = []
        for (let i = 1; i <= primaryEnabledCount; i++) {
          const nameSetting = data.settings.find((s: any) => s.key === `criteria_${i}_name`)
          const weightSetting = data.settings.find((s: any) => s.key === `criteria_${i}_weight`)

          primaryCriteria.push({
            name: nameSetting?.value || `Criteria ${i}`,
            weight: weightSetting?.value ? parseFloat(weightSetting.value) : 1.0
          })
        }

        // Build SECONDARY criteria config array
        const secondaryCriteria: Array<{name: string, weight: number}> = []
        for (let i = 1; i <= secondaryEnabledCount; i++) {
          const nameSetting = data.settings.find((s: any) => s.key === `secondary_criteria_${i}_name`)
          const weightSetting = data.settings.find((s: any) => s.key === `secondary_criteria_${i}_weight`)

          // Fallback to primary criteria names/weights if secondary not set
          const fallbackNameSetting = data.settings.find((s: any) => s.key === `criteria_${i}_name`)
          const fallbackWeightSetting = data.settings.find((s: any) => s.key === `criteria_${i}_weight`)

          secondaryCriteria.push({
            name: nameSetting?.value || fallbackNameSetting?.value || `Criteria ${i}`,
            weight: weightSetting?.value ? parseFloat(weightSetting.value) :
                    (fallbackWeightSetting?.value ? parseFloat(fallbackWeightSetting.value) : 1.0)
          })
        }

        setCriteriaConfig(primaryCriteria)
        setSecondaryCriteriaConfig(secondaryCriteria)

        // Get max articles settings
        const maxTopSetting = data.settings.find((s: any) => s.key === 'max_top_articles')
        const maxBottomSetting = data.settings.find((s: any) => s.key === 'max_bottom_articles')
        const maxSecondarySetting = data.settings.find((s: any) => s.key === 'max_secondary_articles')

        const parsedMaxTop = maxTopSetting?.value ? parseInt(maxTopSetting.value, 10) : 3
        const parsedMaxBottom = maxBottomSetting?.value ? parseInt(maxBottomSetting.value, 10) : 3
        const parsedMaxSecondary = maxSecondarySetting?.value ? parseInt(maxSecondarySetting.value, 10) : 3

        setMaxTopArticles(isNaN(parsedMaxTop) ? 3 : parsedMaxTop)
        setMaxBottomArticles(isNaN(parsedMaxBottom) ? 3 : parsedMaxBottom)
        setMaxSecondaryArticles(isNaN(parsedMaxSecondary) ? 3 : parsedMaxSecondary)
      }
    } catch (error) {
      console.error('Failed to fetch criteria config:', error)
    }
  }

  const fetchAvailableEvents = async (startDate: string, endDate: string) => {
    setLoadingEvents(true)
    try {
      const response = await fetch(`/api/events?start_date=${startDate}&end_date=${endDate}&active=true`)
      if (response.ok) {
        const data = await response.json()
        setAvailableEvents(data.events || [])
      }
    } catch (error) {
      console.error('Failed to fetch available events:', error)
    } finally {
      setLoadingEvents(false)
    }
  }

  const fetchNewsletterSections = async () => {
    setLoadingSections(true)
    try {
      const response = await fetch('/api/settings/newsletter-sections')
      if (response.ok) {
        const data = await response.json()
        setNewsletterSections(data.sections || [])
      }
    } catch (error) {
      console.error('Failed to fetch newsletter sections:', error)
    } finally {
      setLoadingSections(false)
    }
  }

  const toggleArticle = async (articleId: string, currentState: boolean) => {
    if (!issue) return

    // Prevent selecting a 6th article - simply return without action
    if (!currentState) { // currentState is false means we're trying to activate
      const activeCount = issue.articles.filter(article => article.is_active && !article.skipped).length
      if (activeCount >= 5) {
        return // No action taken, no alert - just prevent the selection
      }
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/campaigns/${issue.id}/articles`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          article_updates: [{
            article_id: articleId,
            is_active: !currentState
          }]
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update article')
      }

      // Update local state
      setissue(prev => {
        if (!prev) return prev
        return {
          ...prev,
          articles: prev.articles.map(article =>
            article.id === articleId
              ? { ...article, is_active: !currentState }
              : article
          )
        }
      })

    } catch (error) {
      alert('Failed to update article: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const skipArticle = async (articleId: string) => {
    if (!issue) return

    setSaving(true)
    try {
      const response = await fetch(`/api/articles/${articleId}/skip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to skip article')
      }

      const responseData = await response.json()

      // Update local state to remove the skipped article
      setissue(prev => {
        if (!prev) return prev

        const updatedissue = {
          ...prev,
          articles: prev.articles.map(article =>
            article.id === articleId
              ? { ...article, skipped: true }
              : article
          )
        }

        // Update subject line if it was auto-regenerated
        if (responseData.subject_line_regenerated && responseData.new_subject_line) {
          console.log(`Subject line auto-updated after skip to: "${responseData.new_subject_line}"`)
          updatedissue.subject_line = responseData.new_subject_line
        }

        return updatedissue
      })

      // Show success message with subject line info if applicable
      const message = responseData.subject_line_regenerated
        ? `Article skipped successfully! Subject line auto-updated to: "${responseData.new_subject_line}"`
        : 'Article skipped successfully'

      alert(message)

    } catch (error) {
      alert('Failed to skip article: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  // Secondary Article Functions
  const toggleSecondaryArticle = async (articleId: string, currentState: boolean) => {
    if (!issue) return

    setSaving(true)
    try {
      const response = await fetch(`/api/secondary-articles/${articleId}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: !currentState })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to toggle secondary article')
      }

      // Update local state
      setissue(prev => {
        if (!prev) return prev
        return {
          ...prev,
          secondary_articles: prev.secondary_articles.map(article =>
            article.id === articleId
              ? { ...article, is_active: !currentState }
              : article
          )
        }
      })

    } catch (error) {
      alert('Failed to toggle secondary article: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const skipSecondaryArticle = async (articleId: string) => {
    if (!issue) return

    setSaving(true)
    try {
      const response = await fetch(`/api/secondary-articles/${articleId}/skip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to skip secondary article')
      }

      // Update local state to remove the skipped article
      setissue(prev => {
        if (!prev) return prev
        return {
          ...prev,
          secondary_articles: prev.secondary_articles.map(article =>
            article.id === articleId
              ? { ...article, skipped: true, is_active: false }
              : article
          )
        }
      })

      alert('Secondary article skipped successfully')

    } catch (error) {
      alert('Failed to skip secondary article: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const handleSecondaryDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id || !issue) {
      return
    }

    console.log('Reordering secondary articles:', { activeId: active.id, overId: over.id })

    // Get non-skipped secondary articles sorted by rank
    const sortedSecondaryArticles = issue.secondary_articles
      .filter(article => !article.skipped)
      .sort((a, b) => {
        const rankA = a.rank ?? 9999
        const rankB = b.rank ?? 9999
        return rankA - rankB
      })

    const oldIndex = sortedSecondaryArticles.findIndex(article => article.id === active.id)
    const newIndex = sortedSecondaryArticles.findIndex(article => article.id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      console.error('Could not find secondary articles in list')
      return
    }

    // Reorder the array
    const reorderedArticles = arrayMove(sortedSecondaryArticles, oldIndex, newIndex)

    // Update ranks: 1, 2, 3...
    const articleOrders = reorderedArticles.map((article, index) => ({
      articleId: article.id,
      rank: index + 1
    }))

    // Optimistically update UI
    setissue(prev => {
      if (!prev) return prev
      return {
        ...prev,
        secondary_articles: prev.secondary_articles.map(article => {
          const order = articleOrders.find(o => o.articleId === article.id)
          return order ? { ...article, rank: order.rank } : article
        })
      }
    })

    // Send to API
    try {
      const response = await fetch(`/api/campaigns/${issue.id}/secondary-articles/reorder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ articleOrders })
      })

      if (!response.ok) {
        throw new Error('Failed to reorder secondary articles')
      }

      console.log('Secondary articles reordered successfully')
    } catch (error) {
      console.error('Failed to reorder secondary articles:', error)
      alert('Failed to reorder secondary articles')
      // Refresh to get correct state
      fetchissue(issue.id)
    }
  }

  const previewNewsletter = async () => {
    if (!issue) return

    setPreviewLoading(true)
    try {
      console.log('Calling preview API for issue:', issue.id)
      const response = await fetch(`/api/campaigns/${issue.id}/preview`)
      console.log('Preview API response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errorMessage = errorData?.error || `HTTP ${response.status}: ${response.statusText}`
        console.error('Preview API error:', errorMessage)
        throw new Error(errorMessage)
      }

      const data = await response.json()
      console.log('Preview data received:', !!data.html, 'HTML length:', data.html?.length)
      setPreviewHtml(data.html)
      setShowPreview(true)
    } catch (error) {
      console.error('Preview error:', error)
      alert('Failed to generate preview: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setPreviewLoading(false)
    }
  }

  const processRSSFeeds = async () => {
    if (!issue) return

    setProcessing(true)
    setProcessingStatus('Starting reprocess workflow...')

    try {
      const response = await fetch(`/api/campaigns/${issue.id}/reprocess`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        let errorMessage = 'Reprocess failed'
        try {
          const data = await response.json()
          errorMessage = data.message || data.error || errorMessage
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      console.log('[Client] Reprocess workflow started:', data)

      setProcessingStatus('Workflow started! Articles will regenerate in background. Refresh page to see progress.')

      // Wait a bit then refresh to show processing status
      setTimeout(async () => {
        await fetchissue(issue.id)
        setProcessingStatus('')
      }, 3000)

    } catch (error) {
      setProcessingStatus('')
      alert('Failed to start reprocess: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setProcessing(false)
    }
  }

  const generateSubjectLine = async () => {
    if (!issue) return

    // Check if there are any active articles
    const activeArticles = issue.articles.filter(article => article.is_active)
    if (activeArticles.length === 0) {
      alert('Please select at least one article before generating a subject line.')
      return
    }

    setGeneratingSubject(true)
    try {
      const response = await fetch(`/api/campaigns/${issue.id}/generate-subject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate subject line')
      }

      const data = await response.json()

      // Update issue locally with new subject line
      setissue(prev => {
        if (!prev) return prev
        return {
          ...prev,
          subject_line: data.subject_line
        }
      })

      console.log(`Generated subject line: "${data.subject_line}" (${data.character_count} characters)`)

    } catch (error) {
      alert('Failed to generate subject line: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setGeneratingSubject(false)
    }
  }

  const startEditingSubject = () => {
    setEditSubjectValue(issue?.subject_line || '')
    setEditingSubject(true)
  }

  const cancelEditingSubject = () => {
    setEditingSubject(false)
    setEditSubjectValue('')
  }

  const saveSubjectLine = async () => {
    if (!issue) return

    setSavingSubject(true)
    try {
      const response = await fetch(`/api/campaigns/${issue.id}/subject-line`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject_line: editSubjectValue.trim()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update subject line')
      }

      const data = await response.json()
      setissue(prev => prev ? { ...prev, subject_line: data.subject_line } : null)
      setEditingSubject(false)
      setEditSubjectValue('')

    } catch (error) {
      alert('Failed to save subject line: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setSavingSubject(false)
    }
  }

  const updateEventSelections = async (eventDate: string, selectedEvents: string[], featuredEvent?: string) => {
    if (!issue) return

    setUpdatingEvents(true)
    try {
      const response = await fetch(`/api/campaigns/${issue.id}/events`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_date: eventDate,
          selected_events: selectedEvents,
          featured_event: featuredEvent
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update events')
      }

      // Refresh issue events
      await fetchissueEvents(issue.id)

    } catch (error) {
      alert('Failed to update events: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setUpdatingEvents(false)
    }
  }

  // Helper function to get events count by date with color coding
  const getEventCountsByDate = () => {
    if (!issue) return []

    // Calculate 3-day range starting from the newsletter date (issue.date)
    // Day 1: Newsletter date, Day 2: Next day, Day 3: Day after that
    const newsletterDate = new Date(issue.date + 'T00:00:00') // Parse as local date

    const dates = []
    for (let i = 0; i <= 2; i++) {
      const date = new Date(newsletterDate)
      date.setDate(newsletterDate.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]

      // Count selected events for this date
      const eventCount = issueEvents.filter(ce =>
        ce.event_date === dateStr && ce.is_selected
      ).length

      // Determine color based on count
      let colorClass = 'text-red-600' // 0 events
      if (eventCount === 8) colorClass = 'text-green-600'
      else if (eventCount > 0) colorClass = 'text-yellow-600'

      dates.push({
        date: dateStr,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        monthDay: date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
        count: eventCount,
        colorClass
      })
    }

    return dates
  }

  const handleEventsExpand = () => {
    if (!eventsExpanded && issue) {
      // Calculate 3-day range starting from the newsletter date (issue.date)
      // Day 1: Newsletter date, Day 2: Next day, Day 3: Day after that
      const newsletterDate = new Date(issue.date + 'T00:00:00') // Parse as local date

      const dates = []
      for (let i = 0; i <= 2; i++) {
        const date = new Date(newsletterDate)
        date.setDate(newsletterDate.getDate() + i)
        dates.push(date.toISOString().split('T')[0])
      }

      const startDateStr = dates[0]
      const endDateStr = dates[dates.length - 1]

      console.log('Fetching events with date range:', startDateStr, 'to', endDateStr, 'for newsletter date:', issue.date)
      fetchAvailableEvents(startDateStr, endDateStr)
    }
    setEventsExpanded(!eventsExpanded)
  }

  const getScoreColor = (score: number) => {
    if (score >= 32) return 'text-green-600'  // 80% of 40
    if (score >= 26) return 'text-yellow-600' // 65% of 40
    return 'text-red-600'
  }

  const formatStatus = (status: string) => {
    switch (status) {
      case 'draft': return 'Draft'
      case 'in_review': return 'In Review'
      case 'changes_made': return 'Changes Made'
      case 'sent': return 'Sent'
      case 'failed': return 'Failed'
      case 'processing': return 'Processing RSS Feeds...'
      default: return status
    }
  }

  const updateIssueStatus = async (action: 'changes_made') => {
    if (!issue) return

    setUpdatingStatus(true)
    try {
      const response = await fetch(`/api/campaigns/${issue.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update issue status')
      }

      const data = await response.json()

      // Update local issue state
      setissue(prev => {
        if (!prev) return prev
        return {
          ...prev,
          status: 'changes_made',
          last_action: action,
          last_action_at: data.issue.last_action_at,
          last_action_by: data.issue.last_action_by
        }
      })

      alert(`issue marked as "Changes Made" and status updated. Slack notification sent.`)

    } catch (error) {
      alert('Failed to update issue status: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleDeleteConfirm = () => {
    setDeleteModal(false)
    router.push('/dashboard/issues')
  }

  const handleDeleteCancel = () => {
    setDeleteModal(false)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    console.log('🎯 handleDragEnd called with event:', event)
    const { active, over } = event

    if (!over || active.id === over.id || !issue) {
      console.log('⚠️ Early return from handleDragEnd:', { over: !!over, sameId: active.id === over?.id, issue: !!issue })
      return
    }

    console.log('Drag ended:', { activeId: active.id, overId: over.id })

    // Get current active articles sorted by rank
    const activeArticles = issue.articles
      .filter(article => article.is_active)
      .sort((a, b) => (a.rank || 999) - (b.rank || 999))

    const oldIndex = activeArticles.findIndex(article => article.id === active.id)
    const newIndex = activeArticles.findIndex(article => article.id === over.id)

    console.log('Indexes:', { oldIndex, newIndex, totalActive: activeArticles.length })

    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      // Create new order using arrayMove
      const newOrder = arrayMove(activeArticles, oldIndex, newIndex)

      console.log('New order:', newOrder.map((a, i) => `${i + 1}. ${a.headline} (was rank ${a.rank})`))

      // Update local state immediately for UI responsiveness
      setissue(prev => {
        if (!prev) return prev
        const updatedArticles = [...prev.articles]

        // Update ranks for all active articles based on new order
        newOrder.forEach((article, index) => {
          const articleIndex = updatedArticles.findIndex(a => a.id === article.id)
          if (articleIndex !== -1) {
            updatedArticles[articleIndex] = {
              ...updatedArticles[articleIndex],
              rank: index + 1
            }
          }
        })

        return { ...prev, articles: updatedArticles }
      })

      // Send update to server
      try {
        const articleOrders = newOrder.map((article, index) => ({
          articleId: article.id,
          rank: index + 1
        }))

        console.log('Sending rank updates:', articleOrders)

        const response = await fetch(`/api/campaigns/${issue.id}/articles/reorder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articleOrders })
        })

        if (!response.ok) {
          throw new Error(`Failed to update order: ${response.status}`)
        }

        const responseData = await response.json()
        console.log('Successfully updated article ranks')

        // Check if subject line was auto-regenerated
        if (responseData.subject_line_regenerated && responseData.new_subject_line) {
          console.log(`Subject line auto-updated to: "${responseData.new_subject_line}"`)

          // Update the issue state with the new subject line
          setissue(prev => prev ? {
            ...prev,
            subject_line: responseData.new_subject_line
          } : null)
        }
      } catch (error) {
        console.error('Failed to update article order:', error)
        // Refresh issue to revert changes
        if (issue.id) {
          fetchissue(issue.id)
        }
      }
    }
  }

  const formatDate = (dateString: string) => {
    // Parse date as local date to avoid timezone offset issues
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day) // month is 0-indexed
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </Layout>
    )
  }

  if (error || !issue) {
    return (
      <Layout>
        <div className="text-center py-12">
          <div className="text-red-600 mb-4">
            {error || 'issue not found'}
          </div>
          <a href="/dashboard/issues" className="text-brand-primary hover:text-blue-700">
            Back to Campaigns
          </a>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        {/* issue Header */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Issue for {formatDate(issue.date)}
              </h1>
              <div className="flex items-center space-x-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  issue.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                  issue.status === 'in_review' ? 'bg-yellow-100 text-yellow-800' :
                  issue.status === 'changes_made' ? 'bg-orange-100 text-orange-800' :
                  issue.status === 'sent' ? 'bg-green-100 text-green-800' :
                  issue.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {issue.status === 'processing' && (
                    <svg className="animate-spin -ml-0.5 mr-1.5 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {formatStatus(issue.status)}
                </span>
                <span className="text-sm text-gray-500">
                  {issue.articles.filter(a => a.is_active && !a.skipped).length}/{maxTopArticles} selected
                </span>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={processRSSFeeds}
                disabled={processing || saving || generatingSubject || issue.status === 'processing'}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium"
              >
                {(processing || issue.status === 'processing') ? 'Processing in background...' : 'Reprocess Articles'}
              </button>
              <button
                onClick={previewNewsletter}
                disabled={saving || generatingSubject || previewLoading}
                className="bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-800 px-4 py-2 rounded text-sm font-medium flex items-center space-x-2"
              >
                {previewLoading && (
                  <svg className="animate-spin h-4 w-4 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <span>{previewLoading ? 'Loading...' : 'Preview Email'}</span>
              </button>
            </div>
          </div>

          {processingStatus && (
            <div className="text-sm text-blue-600 font-medium mt-3 text-center">
              {processingStatus}
            </div>
          )}

          {/* Subject Line Section */}
          <div className="mt-4 p-3 bg-gray-50 rounded">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="text-sm text-gray-600 mb-1">Subject Line:</div>
                {editingSubject ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editSubjectValue}
                      onChange={(e) => setEditSubjectValue(e.target.value)}
                      placeholder="Enter subject line..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        {editSubjectValue.length} characters
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={cancelEditingSubject}
                          disabled={savingSubject}
                          className="px-3 py-1 text-sm text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveSubjectLine}
                          disabled={savingSubject || !editSubjectValue.trim()}
                          className="px-3 py-1 text-sm text-white bg-green-600 border border-green-600 rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          {savingSubject ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {issue.subject_line ? (
                      <div className="font-medium text-gray-900">{issue.subject_line}</div>
                    ) : (
                      <div className="text-gray-500 italic">No subject line generated yet</div>
                    )}
                  </>
                )}
              </div>
              {!editingSubject && (
                <div className="ml-4 flex space-x-2">
                  {issue.subject_line && (
                    <button
                      onClick={startEditingSubject}
                      disabled={generatingSubject || processing || savingSubject}
                      className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white px-3 py-1 rounded text-sm font-medium"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={generateSubjectLine}
                    disabled={generatingSubject || processing || savingSubject}
                    className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-3 py-1 rounded text-sm font-medium"
                  >
                    {generatingSubject ? 'Generating...' : issue.subject_line ? 'Regenerate' : 'Generate'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* issue Approval Buttons */}
          <div className="mt-4 flex justify-end space-x-3">
            <button
              onClick={() => updateIssueStatus('changes_made')}
              disabled={updatingStatus}
              className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center"
            >
              {updatingStatus ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Updating...
                </>
              ) : (
                'Changes Made'
              )}
            </button>
            <button
              onClick={() => setDeleteModal(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium text-sm"
            >
              Delete Issue
            </button>
          </div>
        </div>

        {/* Top Articles Section */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">
                {primaryArticlesSection?.name || 'Top Articles'}
              </h2>
              <button
                onClick={() => setArticlesExpanded(!articlesExpanded)}
                className="flex items-center space-x-2 text-sm text-brand-primary hover:text-blue-700"
              >
                <span>{articlesExpanded ? 'Collapse' : 'Expand'}</span>
                <svg
                  className={`w-4 h-4 transform transition-transform ${articlesExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-sm text-gray-600">
                Check articles to select them for the issue. Drag to reorder selected articles.
              </p>
              <div className="text-sm">
                <span className={`font-medium ${issue.articles.filter(a => a.is_active && !a.skipped).length === maxTopArticles ? 'text-green-600' : 'text-yellow-600'}`}>
                  {issue.articles.filter(a => a.is_active && !a.skipped).length}/{maxTopArticles} selected
                </span>
                <span className="text-gray-500 ml-1">• {issue.articles.filter(a => !a.skipped).length} total articles</span>
              </div>
            </div>
          </div>

          {articlesExpanded && (
            <div className="divide-y divide-gray-200">
              {issue.articles.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <p className="mb-4">No articles generated yet. Run RSS processing to generate articles.</p>
                <div className="flex space-x-2">
                  <button
                    onClick={processRSSFeeds}
                    disabled={processing}
                    className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium"
                  >
                    {processing ? 'Processing...' : 'Reprocess Articles'}
                  </button>
                </div>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={pointerWithin}
                onDragStart={(event) => {
                  console.log('🚀 Drag started:', event.active.id)
                }}
                onDragOver={(event) => {
                  console.log('👆 Drag over:', { active: event.active.id, over: event.over?.id })
                }}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={issue.articles
                    .filter(article => !article.skipped)
                    .sort((a, b) => {
                      // Sort by rank field (lower rank = higher priority)
                      // Articles without rank go to the end
                      const rankA = a.rank ?? 9999
                      const rankB = b.rank ?? 9999
                      return rankA - rankB
                    })
                    .map(article => article.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {issue.articles
                    .filter(article => !article.skipped)
                    .sort((a, b) => {
                      // Sort by rank field (lower rank = higher priority)
                      // Articles without rank go to the end
                      const rankA = a.rank ?? 9999
                      const rankB = b.rank ?? 9999
                      return rankA - rankB
                    })
                    .map((article) => (
                      <SortableArticle
                        key={article.id}
                        article={article}
                        toggleArticle={toggleArticle}
                        skipArticle={skipArticle}
                        saving={saving}
                        getScoreColor={getScoreColor}
                        criteriaConfig={criteriaConfig}
                        maxTopArticles={maxTopArticles}
                      />
                    ))}
                </SortableContext>
              </DndContext>
            )}
            </div>
          )}
        </div>

        {/* Secondary Articles Section */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">
                {secondaryArticlesSection?.name || 'Secondary Articles'}
              </h2>
              <button
                onClick={() => setSecondaryArticlesExpanded(!secondaryArticlesExpanded)}
                className="flex items-center space-x-2 text-sm text-brand-primary hover:text-blue-700"
              >
                <span>{secondaryArticlesExpanded ? 'Collapse' : 'Expand'}</span>
                <svg
                  className={`w-4 h-4 transform transition-transform ${secondaryArticlesExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-sm text-gray-600">
                Secondary section articles appear below the main articles. Drag to reorder.
              </p>
              <div className="text-sm">
                <span className={`font-medium ${issue.secondary_articles?.filter(a => a.is_active && !a.skipped).length === (maxSecondaryArticles || 3) ? 'text-green-600' : 'text-yellow-600'}`}>
                  {issue.secondary_articles?.filter(a => a.is_active && !a.skipped).length || 0}/{maxSecondaryArticles || 3} selected
                </span>
                <span className="text-gray-500 ml-1">• {issue.secondary_articles?.filter(a => !a.skipped).length || 0} total articles</span>
              </div>
            </div>
          </div>

          {secondaryArticlesExpanded && (
            <div className="divide-y divide-gray-200">
              {!issue.secondary_articles || issue.secondary_articles.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <p className="mb-2">No secondary articles generated yet.</p>
                <p className="text-sm">Configure RSS feeds for secondary section in Settings, then run RSS processing.</p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={pointerWithin}
                onDragEnd={handleSecondaryDragEnd}
              >
                <SortableContext
                  items={issue.secondary_articles
                    .filter(article => !article.skipped)
                    .sort((a, b) => {
                      const rankA = a.rank ?? 9999
                      const rankB = b.rank ?? 9999
                      return rankA - rankB
                    })
                    .map(article => article.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {issue.secondary_articles
                    .filter(article => !article.skipped)
                    .sort((a, b) => {
                      const rankA = a.rank ?? 9999
                      const rankB = b.rank ?? 9999
                      return rankA - rankB
                    })
                    .map((article) => (
                      <SortableArticle
                        key={article.id}
                        article={article}
                        toggleArticle={toggleSecondaryArticle}
                        skipArticle={skipSecondaryArticle}
                        saving={saving}
                        getScoreColor={getScoreColor}
                        criteriaConfig={secondaryCriteriaConfig}
                        maxTopArticles={maxSecondaryArticles || 3}
                      />
                    ))}
                </SortableContext>
              </DndContext>
            )}
            </div>
          )}
        </div>

        {/* Dynamic Newsletter Sections */}
        {newsletterSections
          .filter(section => section.is_active && section.id !== primaryArticlesSection?.id && section.id !== secondaryArticlesSection?.id)
          .map(section => (
            <NewsletterSectionComponent
              key={section.id}
              section={section}
              issue={issue}
              expanded={sectionExpandedStates[section.id] || false}
              onToggleExpanded={() => {
                setSectionExpandedStates(prev => ({
                  ...prev,
                  [section.id]: !prev[section.id]
                }))
              }}
            />
          ))}

        {/* Preview Modal */}
        {showPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="text-lg font-medium text-gray-900">
                  Email Preview
                </h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      if (previewHtml) {
                        const blob = new Blob([previewHtml], { type: 'text/html' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `newsletter-${issue?.date}.html`
                        a.click()
                        URL.revokeObjectURL(url)
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                  >
                    Download HTML
                  </button>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                {previewHtml && (
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full h-full min-h-[600px]"
                    title="Email Preview"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Delete issue Modal */}
        {issue && (
          <DeleteIssueModal
            issue={issue}
            isOpen={deleteModal}
            onClose={handleDeleteCancel}
            onConfirm={handleDeleteConfirm}
          />
        )}
      </div>
    </Layout>
  )
}
