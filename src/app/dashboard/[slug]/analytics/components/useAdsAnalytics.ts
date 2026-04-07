'use client'

import { useEffect, useState } from 'react'

export function useAdsAnalytics(slug: string, excludeIps: boolean) {
  const [loading, setLoading] = useState(true)
  const [ads, setAds] = useState<any[]>([])
  const [adModules, setAdModules] = useState<string[]>([])
  const [selectedAdId, setSelectedAdId] = useState<string>('all')
  const [selectedAdModule, setSelectedAdModule] = useState<string>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [days, setDays] = useState('30')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  useEffect(() => {
    fetchAdAnalytics()
  }, [slug, selectedAdId, selectedAdModule, days, startDate, endDate, excludeIps])

  const fetchAdAnalytics = async () => {
    try {
      setLoading(true)
      let url = `/api/ads/analytics?newsletter_slug=${slug}`

      if (selectedAdId !== 'all') {
        url += `&ad_id=${selectedAdId}`
      }

      if (selectedAdModule !== 'all') {
        url += `&ad_module=${encodeURIComponent(selectedAdModule)}`
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
        setAds(data.ads || [])
        setAdModules(data.ad_modules || [])
        setDateRange(data.date_range || { start: '', end: '' })
      }
    } catch (error) {
      console.error('Failed to fetch ad analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    ads,
    adModules,
    selectedAdId,
    setSelectedAdId,
    selectedAdModule,
    setSelectedAdModule,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    days,
    setDays,
    dateRange
  }
}
