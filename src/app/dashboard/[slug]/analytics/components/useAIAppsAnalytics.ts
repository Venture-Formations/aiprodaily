'use client'

import { useEffect, useState } from 'react'

interface UseAIAppsAnalyticsParams {
  slug: string
  excludeIps: boolean
}

export function useAIAppsAnalytics({ slug, excludeIps }: UseAIAppsAnalyticsParams) {
  const [loading, setLoading] = useState(true)
  const [apps, setApps] = useState<any[]>([])
  const [affiliateFilter, setAffiliateFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [toolTypeFilter, setToolTypeFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [days, setDays] = useState('7')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  useEffect(() => {
    fetchAIAppAnalytics()
  }, [slug, affiliateFilter, categoryFilter, toolTypeFilter, days, startDate, endDate, excludeIps])

  const fetchAIAppAnalytics = async () => {
    try {
      setLoading(true)
      let url = `/api/ai-apps/analytics?newsletter_slug=${slug}`

      if (affiliateFilter !== 'all') {
        url += `&affiliate=${affiliateFilter}`
      }
      if (categoryFilter !== 'all') {
        url += `&category=${encodeURIComponent(categoryFilter)}`
      }
      if (toolTypeFilter !== 'all') {
        url += `&tool_type=${encodeURIComponent(toolTypeFilter)}`
      }

      if (startDate && endDate) {
        url += `&start_date=${startDate}&end_date=${endDate}`
      } else {
        url += `&days=${days}`
      }

      url += `&exclude_ips=${excludeIps}`

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setApps(data.apps || [])
        setDateRange(data.date_range || { start: '', end: '' })
      }
    } catch (error) {
      console.error('Failed to fetch AI app analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const clearFilters = () => {
    setAffiliateFilter('all')
    setCategoryFilter('all')
    setToolTypeFilter('all')
  }

  return {
    loading,
    apps,
    affiliateFilter,
    setAffiliateFilter,
    categoryFilter,
    setCategoryFilter,
    toolTypeFilter,
    setToolTypeFilter,
    days,
    setDays,
    dateRange,
    clearFilters,
  }
}
