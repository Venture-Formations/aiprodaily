'use client'

import { useState, useEffect } from 'react'

interface ToolAnalytics {
  totalClicks: number
  clicksByType: {
    category_click: number
    tool_view: number
    external_link: number
  }
  topCategories: Array<{ slug: string; name: string; clicks: number }>
  topToolsByViews: Array<{ id: string; name: string; views: number; external_clicks: number }>
  topToolsByClicks: Array<{ id: string; name: string; views: number; external_clicks: number }>
  dailyClicks: { [date: string]: number }
  clicksByReferrerType: { [type: string]: number }
  dateRange: { start: string; end: string }
}

export function useToolsAnalytics() {
  const [analytics, setAnalytics] = useState<ToolAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(30)

  useEffect(() => {
    fetchAnalytics()
  }, [days])

  async function fetchAnalytics() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/tools/analytics?days=${days}`)
      const data = await res.json()
      if (data.success) {
        setAnalytics(data.analytics)
      } else {
        setError(data.error || 'Failed to fetch analytics')
      }
    } catch (err) {
      setError('Failed to fetch analytics')
      console.error('Analytics fetch error:', err)
    }
    setLoading(false)
  }

  const formatNumber = (num: number) => num.toLocaleString()

  const getConversionRate = () => {
    if (!analytics) return '0%'
    const views = analytics.clicksByType.tool_view || 0
    const clicks = analytics.clicksByType.external_link || 0
    if (views === 0) return '0%'
    return ((clicks / views) * 100).toFixed(1) + '%'
  }

  const getDailyData = () => {
    if (!analytics?.dailyClicks) return []
    return Object.entries(analytics.dailyClicks)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, clicks]) => ({ date, clicks }))
  }

  const getMaxClicks = () => {
    const dailyData = getDailyData()
    if (dailyData.length === 0) return 1
    return Math.max(...dailyData.map(d => d.clicks), 1)
  }

  return {
    analytics, loading, error, days, setDays,
    fetchAnalytics, formatNumber, getConversionRate,
    getDailyData, getMaxClicks,
  }
}
