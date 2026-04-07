'use client'

import { useEffect, useState, useCallback } from 'react'
import type { IssueWithMetrics, FeedbackAnalytics, LinkClickAnalytics, Averages } from './types'

export function useIssuesAnalytics(slug: string, excludeIps: boolean) {
  const [issues, setIssues] = useState<IssueWithMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTimeframe, setSelectedTimeframe] = useState('7')
  const [feedbackAnalytics, setFeedbackAnalytics] = useState<FeedbackAnalytics | null>(null)
  const [feedbackLoading, setFeedbackLoading] = useState(true)
  const [linkClickAnalytics, setLinkClickAnalytics] = useState<LinkClickAnalytics | null>(null)
  const [linkClickLoading, setLinkClickLoading] = useState(true)

  const fetchAnalytics = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/campaigns?limit=50&status=sent&newsletter_slug=${slug}&days=${selectedTimeframe}`
      )
      if (!response.ok) throw new Error('Failed to fetch analytics data')
      const data = await response.json()
      setIssues(data.issues)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [slug, selectedTimeframe])

  const fetchFeedbackAnalytics = useCallback(async () => {
    try {
      setFeedbackLoading(true)
      const response = await fetch(`/api/feedback/analytics?newsletter_slug=${slug}&days=${selectedTimeframe}`)
      if (response.ok) {
        const data = await response.json()
        setFeedbackAnalytics(data.analytics)
      }
    } catch (error) {
      console.error('Failed to fetch feedback analytics:', error)
    } finally {
      setFeedbackLoading(false)
    }
  }, [slug, selectedTimeframe])

  const fetchLinkClickAnalytics = useCallback(async () => {
    try {
      setLinkClickLoading(true)
      const response = await fetch(`/api/link-tracking/analytics?newsletter_slug=${slug}&days=${selectedTimeframe}&exclude_ips=${excludeIps}`)
      if (response.ok) {
        const data = await response.json()
        setLinkClickAnalytics(data.analytics)
      }
    } catch (error) {
      console.error('Failed to fetch link click analytics:', error)
    } finally {
      setLinkClickLoading(false)
    }
  }, [slug, selectedTimeframe, excludeIps])

  useEffect(() => {
    fetchAnalytics()
    fetchFeedbackAnalytics()
    fetchLinkClickAnalytics()
  }, [fetchAnalytics, fetchFeedbackAnalytics, fetchLinkClickAnalytics])

  const refreshMetrics = async (issueId: string) => {
    try {
      const response = await fetch(`/api/analytics/${issueId}`, { method: 'POST' })
      const data = await response.json()

      if (response.ok) {
        if (data.metrics?.skipped) {
          alert(`Skipped: ${data.metrics.reason || 'No metrics available yet'}`)
        } else {
          alert('Metrics refreshed successfully!')
          fetchAnalytics()
        }
      } else {
        alert(`Failed to refresh: ${data.message || data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to refresh metrics:', error)
      alert('Failed to refresh metrics. Check console for details.')
    }
  }

  const calculateAverages = useCallback((): Averages | null => {
    const issuesWithMetrics = issues.filter(c => c.email_metrics)
    if (issuesWithMetrics.length === 0) return null

    const totals = issuesWithMetrics.reduce((acc, issue) => {
      const metrics = issue.email_metrics!
      return {
        sent: acc.sent + (metrics.sent_count || 0),
        delivered: acc.delivered + (metrics.delivered_count || 0),
        opened: acc.opened + (metrics.opened_count || 0),
        clicked: acc.clicked + (metrics.clicked_count || 0),
        bounced: acc.bounced + (metrics.bounced_count || 0),
        unsubscribed: acc.unsubscribed + (metrics.unsubscribed_count || 0),
      }
    }, { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 })

    const denominator = totals.delivered > 0 ? totals.delivered : totals.sent

    const uniqueClickersToUse = excludeIps && linkClickAnalytics
      ? linkClickAnalytics.uniqueUsers
      : totals.clicked

    return {
      avgOpenRate: denominator > 0 ? (totals.opened / denominator) * 100 : 0,
      avgClickRate: denominator > 0 ? (uniqueClickersToUse / denominator) * 100 : 0,
      avgBounceRate: totals.sent > 0 ? (totals.bounced / totals.sent) * 100 : 0,
      avgUnsubscribeRate: denominator > 0 ? (totals.unsubscribed / denominator) * 100 : 0,
      totalSent: totals.sent,
      totalDelivered: totals.delivered,
      totalOpened: totals.opened,
      totalClicked: uniqueClickersToUse,
      issueCount: issuesWithMetrics.length,
      usingOwnClickData: excludeIps && !!linkClickAnalytics
    }
  }, [issues, excludeIps, linkClickAnalytics])

  const getIssueClickRate = useCallback((issue: IssueWithMetrics): number | null => {
    const metrics = issue.email_metrics
    if (!metrics) return null

    if (excludeIps && linkClickAnalytics?.uniqueClickersByIssue) {
      const uniqueClickers = linkClickAnalytics.uniqueClickersByIssue[issue.id] || 0
      const denominator = (metrics.delivered_count || 0) > 0
        ? metrics.delivered_count
        : metrics.sent_count
      if (!denominator || denominator === 0) return null
      return uniqueClickers / denominator
    } else {
      return metrics.click_rate ?? null
    }
  }, [excludeIps, linkClickAnalytics])

  const downloadCSV = useCallback(() => {
    if (issues.length === 0) return

    const headers = [
      'Date', 'Subject Line', 'Sent', 'Delivered', 'Opens', 'Open Rate',
      'Unique Clickers', 'Click Rate', 'Bounces', 'Bounce Rate', 'Unsubscribes', 'Click Data Source'
    ]

    const rows = issues.map(issue => {
      const metrics = issue.email_metrics
      const sent = metrics?.sent_count || 0
      const delivered = metrics?.delivered_count || 0
      const opened = metrics?.opened_count || 0
      const bounced = metrics?.bounced_count || 0
      const unsubscribed = metrics?.unsubscribed_count || 0
      const denominator = delivered > 0 ? delivered : sent
      const openRate = denominator > 0 ? ((opened / denominator) * 100).toFixed(2) : '0.00'

      let uniqueClickers: number
      let clickDataSource: string
      if (excludeIps && linkClickAnalytics?.uniqueClickersByIssue) {
        uniqueClickers = linkClickAnalytics.uniqueClickersByIssue[issue.id] || 0
        clickDataSource = 'Internal (IP Filtered)'
      } else {
        uniqueClickers = metrics?.clicked_count || 0
        clickDataSource = 'MailerLite'
      }
      const clickRate = denominator > 0 ? ((uniqueClickers / denominator) * 100).toFixed(2) : '0.00'
      const bounceRate = sent > 0 ? ((bounced / sent) * 100).toFixed(2) : '0.00'

      return [
        issue.date.split('T')[0],
        `"${(issue.subject_line || '').replace(/"/g, '""')}"`,
        sent, delivered, opened, `${openRate}%`,
        uniqueClickers, `${clickRate}%`,
        bounced, `${bounceRate}%`, unsubscribed, clickDataSource
      ]
    })

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `issue-performance-${slug}-${selectedTimeframe}days.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [issues, excludeIps, linkClickAnalytics, slug, selectedTimeframe])

  return {
    issues,
    loading,
    error,
    selectedTimeframe,
    setSelectedTimeframe,
    feedbackAnalytics,
    feedbackLoading,
    linkClickAnalytics,
    linkClickLoading,
    fetchAnalytics,
    refreshMetrics,
    calculateAverages,
    getIssueClickRate,
    downloadCSV,
  }
}
