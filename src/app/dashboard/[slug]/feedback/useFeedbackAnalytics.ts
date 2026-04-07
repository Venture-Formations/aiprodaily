import { useState, useEffect } from 'react'
import type { FeedbackModule, FeedbackIssueStats, FeedbackComment, FeedbackVote } from '@/types/database'

export interface FeedbackAnalytics {
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

export function generateStars(count: number): string {
  return '\u2605'.repeat(count)
}

export function formatFeedbackDate(dateString: string) {
  if (!dateString) return 'N/A'
  const [year, month, day] = dateString.split('T')[0].split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function useFeedbackAnalytics(pathname: string | null) {
  const [publicationId, setPublicationId] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<FeedbackAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null)
  const [expandedRating, setExpandedRating] = useState<string | null>(null)
  const [markingRead, setMarkingRead] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/^\/dashboard\/([^\/]+)/)
      if (match && match[1]) {
        const slug = match[1]
        fetch('/api/newsletters')
          .then(res => res.json())
          .then(data => {
            const publication = data.newsletters?.find((n: { slug: string; id: string }) => n.slug === slug)
            if (publication) setPublicationId(publication.id)
          })
          .catch(console.error)
      }
    }
  }, [pathname])

  useEffect(() => {
    if (publicationId) fetchAnalytics()
  }, [publicationId])

  const fetchAnalytics = async () => {
    if (!publicationId) return
    setLoading(true)
    try {
      const response = await fetch(`/api/feedback-modules/analytics?publication_id=${publicationId}`)
      const data = await response.json()
      if (data.success) setAnalytics(data)
    } catch (error) {
      console.error('Error fetching feedback analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleRead = async (commentId: string, isCurrentlyRead: boolean) => {
    setMarkingRead(prev => new Set(prev).add(commentId))
    try {
      if (isCurrentlyRead) {
        await fetch(`/api/feedback-modules/comments/read?comment_id=${commentId}`, { method: 'DELETE' })
      } else {
        await fetch('/api/feedback-modules/comments/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment_id: commentId })
        })
      }
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
    const allIds = analytics?.recent_comments.filter(c => !c.is_read).map(c => c.id) || []
    setMarkingRead(new Set(allIds))
    try {
      await fetch('/api/feedback-modules/comments/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publication_id: publicationId, mark_all: true })
      })
      setAnalytics(prev => {
        if (!prev) return prev
        return {
          ...prev,
          summary: { ...prev.summary, unread_comments: 0 },
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

  return {
    analytics,
    loading,
    expandedIssue,
    setExpandedIssue,
    expandedRating,
    setExpandedRating,
    markingRead,
    unreadCount,
    handleToggleRead,
    handleMarkAllAsRead,
  }
}
