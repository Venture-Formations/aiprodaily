'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Layout from '@/components/Layout'
import type { FeedbackModule, FeedbackIssueStats, FeedbackComment, FeedbackVote } from '@/types/database'

interface FeedbackAnalytics {
  module: FeedbackModule | null
  summary: {
    total_votes: number
    average_score: number
    total_comments: number
    unread_comments: number
    issues_count: number
  }
  stats: FeedbackIssueStats[]
  recent_comments: Array<FeedbackComment & { vote?: FeedbackVote; is_read: boolean }>
}

function generateStars(count: number): string {
  return '★'.repeat(count)
}

export default function FeedbackDashboardPage() {
  const pathname = usePathname()
  const [publicationId, setPublicationId] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<FeedbackAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null)
  const [markingRead, setMarkingRead] = useState<Set<string>>(new Set())

  // Fetch publication ID from slug
  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/^\/dashboard\/([^\/]+)/)
      if (match && match[1]) {
        const slug = match[1]
        fetch('/api/newsletters')
          .then(res => res.json())
          .then(data => {
            const publication = data.newsletters?.find((n: { slug: string; id: string }) => n.slug === slug)
            if (publication) {
              setPublicationId(publication.id)
            }
          })
          .catch(console.error)
      }
    }
  }, [pathname])

  // Fetch analytics when publication ID is available
  useEffect(() => {
    if (publicationId) {
      fetchAnalytics()
    }
  }, [publicationId])

  const fetchAnalytics = async () => {
    if (!publicationId) return

    setLoading(true)
    try {
      const response = await fetch(`/api/feedback-modules/analytics?publication_id=${publicationId}`)
      const data = await response.json()

      if (data.success) {
        setAnalytics(data)
      }
    } catch (error) {
      console.error('Error fetching feedback analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const handleToggleRead = async (commentId: string, isCurrentlyRead: boolean) => {
    setMarkingRead(prev => new Set(prev).add(commentId))

    try {
      if (isCurrentlyRead) {
        // Mark as unread
        await fetch(`/api/feedback-modules/comments/read?comment_id=${commentId}`, {
          method: 'DELETE'
        })
      } else {
        // Mark as read
        await fetch('/api/feedback-modules/comments/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment_id: commentId })
        })
      }

      // Update local state
      setAnalytics(prev => {
        if (!prev) return prev
        return {
          ...prev,
          summary: {
            ...prev.summary,
            unread_comments: prev.summary.unread_comments + (isCurrentlyRead ? 1 : -1)
          },
          recent_comments: prev.recent_comments.map(c =>
            c.id === commentId ? { ...c, is_read: !isCurrentlyRead } : c
          )
        }
      })
    } catch (error) {
      console.error('Error toggling read status:', error)
    } finally {
      setMarkingRead(prev => {
        const next = new Set(prev)
        next.delete(commentId)
        return next
      })
    }
  }

  const handleMarkAllAsRead = async () => {
    if (!publicationId) return

    // Mark all as being processed
    const allIds = analytics?.recent_comments.filter(c => !c.is_read).map(c => c.id) || []
    setMarkingRead(new Set(allIds))

    try {
      await fetch('/api/feedback-modules/comments/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publication_id: publicationId, mark_all: true })
      })

      // Update local state
      setAnalytics(prev => {
        if (!prev) return prev
        return {
          ...prev,
          summary: {
            ...prev.summary,
            unread_comments: 0
          },
          recent_comments: prev.recent_comments.map(c => ({ ...c, is_read: true }))
        }
      })
    } catch (error) {
      console.error('Error marking all as read:', error)
    } finally {
      setMarkingRead(new Set())
    }
  }

  const unreadCount = analytics?.summary.unread_comments || 0

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Feedback Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            View feedback results and comments from your newsletter subscribers
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
          </div>
        ) : !analytics?.module ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No feedback module</h3>
            <p className="mt-1 text-sm text-gray-500">
              Set up the feedback module in Settings &gt; Sections to start collecting feedback.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm font-medium text-gray-500">Total Votes</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{analytics.summary.total_votes}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm font-medium text-gray-500">Average Score</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  <span className="text-amber-400 mr-1">★</span>
                  {analytics.summary.average_score.toFixed(1)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm font-medium text-gray-500">Total Comments</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{analytics.summary.total_comments}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm font-medium text-gray-500">Issues Tracked</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{analytics.summary.issues_count}</p>
              </div>
            </div>

            {/* Module Status */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Feedback Module Status</h3>
                  <p className="text-sm text-gray-500">
                    {analytics.module.is_active ? 'Active - collecting feedback from subscribers' : 'Inactive - not showing in newsletters'}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  analytics.module.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {analytics.module.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            {/* Per-Issue Breakdown */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Results by Issue</h3>
              </div>

              {analytics.stats.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No feedback data yet. Results will appear here after subscribers vote.
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {analytics.stats.map((stat) => (
                    <div key={stat.issue_id} className="p-6">
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedIssue(expandedIssue === stat.issue_id ? null : stat.issue_id)}
                      >
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-medium text-gray-900">{formatDate(stat.issue_date)}</p>
                            <p className="text-sm text-gray-500">
                              {stat.total_votes} votes • {stat.comments_count} comments
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-medium text-gray-900">
                              <span className="text-amber-400 mr-1">★</span>
                              {stat.average_score.toFixed(1)}
                            </p>
                            <p className="text-sm text-gray-500">avg score</p>
                          </div>
                          <svg
                            className={`w-5 h-5 text-gray-400 transition-transform ${
                              expandedIssue === stat.issue_id ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {expandedIssue === stat.issue_id && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <div className="space-y-3">
                            {stat.vote_breakdown.map((option) => (
                              <div key={option.value} className="flex items-center gap-4">
                                <div className="w-24 flex items-center gap-2">
                                  <span className="text-amber-400">{generateStars(option.value)}</span>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-cyan-600 rounded-full"
                                        style={{ width: `${option.percentage}%` }}
                                      />
                                    </div>
                                    <span className="text-sm text-gray-600 w-16 text-right">
                                      {option.percentage}%
                                    </span>
                                  </div>
                                </div>
                                <div className="w-24 text-right">
                                  <span className="text-sm text-gray-500">{option.count} votes</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Comments */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-medium text-gray-900">Recent Comments</h3>
                  {unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 px-2 flex items-center justify-center">
                      {unreadCount} unread
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    disabled={markingRead.size > 0}
                    className="text-sm text-cyan-600 hover:text-cyan-700 font-medium disabled:opacity-50"
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              {analytics.recent_comments.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No comments yet. Comments will appear here when subscribers leave feedback.
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {analytics.recent_comments.map((comment) => (
                    <div
                      key={comment.id}
                      className={`p-6 ${!comment.is_read ? 'bg-yellow-50' : ''}`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Read Status Checkbox */}
                        <div className="flex-shrink-0 pt-1">
                          <button
                            onClick={() => handleToggleRead(comment.id, comment.is_read)}
                            disabled={markingRead.has(comment.id)}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              comment.is_read
                                ? 'bg-cyan-600 border-cyan-600 text-white'
                                : 'border-gray-300 hover:border-cyan-500'
                            } ${markingRead.has(comment.id) ? 'opacity-50' : ''}`}
                            title={comment.is_read ? 'Mark as unread' : 'Mark as read'}
                          >
                            {comment.is_read && (
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        </div>

                        {/* Comment Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-sm font-medium ${!comment.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                              {comment.subscriber_email}
                            </span>
                            {comment.vote && (
                              <span className="text-amber-400 text-sm">
                                {generateStars(comment.vote.selected_value)}
                              </span>
                            )}
                            {!comment.is_read && (
                              <span className="bg-yellow-400 text-yellow-900 text-xs font-medium px-2 py-0.5 rounded">
                                New
                              </span>
                            )}
                          </div>
                          <p className={`${!comment.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                            {comment.comment_text}
                          </p>
                        </div>

                        {/* Date */}
                        <div className="flex-shrink-0 text-right ml-4">
                          <p className="text-sm text-gray-500">{formatDate(comment.created_at)}</p>
                          {comment.issue_id && (
                            <p className="text-xs text-gray-400">Issue: {comment.issue_id.slice(0, 8)}...</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
