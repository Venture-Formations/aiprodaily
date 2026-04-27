'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams } from 'next/navigation'
import type { Recommendation } from '../types'

interface Counts {
  total: number
  active: number
  excluded: number
  paused: number
  archived: number
}

interface GlobalStats {
  uniqueIps: number
  avgOffersSelected: number
}

interface Defaults {
  cr: number
  rcr: number
  minConversionsBudget: number
}

interface DailyStats {
  date: string
  pending: number
  confirmed: number
  rejected: number
  projectedEarnings: number
  confirmedEarnings: number
  newPending: number | null
}

interface TopEarner {
  name: string
  logo: string | null
  referrals: number
  earnings: number
}

export interface ChartStats {
  summary: {
    totalPending: number
    totalConfirmed: number
    totalRejected: number
    totalSubscribes: number
    totalEarnings: number
    projectedFromPending: number
  }
  dailyStats: DailyStats[]
  topEarners: TopEarner[]
  dateRange: {
    from: string
    to: string
  }
}

export interface EstimatedValue {
  popup: number
  page: number
  total: number
}

export interface SparkLoopData {
  publicationId: string | null
  recommendations: Recommendation[]
  counts: Counts
  globalStats: GlobalStats | null
  defaults: Defaults
  loading: boolean
  syncing: boolean
  error: string | null
  chartStats: ChartStats | null
  chartLoading: boolean
  timeframe: '7' | '30' | '90'
  setTimeframe: (t: '7' | '30' | '90') => void
  activeTab: 'overview' | 'detailed' | 'publications' | 'offers'
  setActiveTab: (tab: 'overview' | 'detailed' | 'publications' | 'offers') => void
  popupPreview: Recommendation[]
  recsPagePreview: Recommendation[]
  estimatedValue: EstimatedValue
  fetchRecommendations: () => Promise<void>
  syncFromSparkLoop: () => Promise<void>
}

function filterEligibleRecs(recommendations: Recommendation[]): Recommendation[] {
  return recommendations
    .filter(rec => {
      if (rec.status !== 'active') return false
      if (rec.excluded) return false
      if (rec.paused_reason === 'manual') return false
      if (!rec.cpa || rec.cpa <= 0) return false
      const slRcr = rec.sparkloop_rcr !== null ? Number(rec.sparkloop_rcr) : null
      const hasSLRcr = slRcr !== null && slRcr > 0
      const hasOverrideRcr = rec.override_rcr !== null && rec.override_rcr !== undefined
      if (!hasSLRcr && !hasOverrideRcr && (rec.submissions || 0) >= 50) return false
      return true
    })
    .sort((a, b) => (b.calculated_score || 0) - (a.calculated_score || 0))
}

export function useSparkLoopData(): SparkLoopData {
  const params = useParams()
  const slug = (params?.slug as string | undefined) ?? null

  const [publicationId, setPublicationId] = useState<string | null>(null)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [counts, setCounts] = useState<Counts>({ total: 0, active: 0, excluded: 0, paused: 0, archived: 0 })
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null)
  const [defaults, setDefaults] = useState<Defaults>({ cr: 22, rcr: 25, minConversionsBudget: 10 })
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'detailed' | 'publications' | 'offers'>('overview')
  const [chartStats, setChartStats] = useState<ChartStats | null>(null)
  const [chartLoading, setChartLoading] = useState(true)
  const [timeframe, setTimeframe] = useState<'7' | '30' | '90'>('30')
  const [error, setError] = useState<string | null>(null)

  // Resolve slug -> publication_id once on mount / slug change
  useEffect(() => {
    if (!slug) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/newsletters')
        if (!res.ok) throw new Error('Failed to fetch publications')
        const data = await res.json()
        const found = data.newsletters?.find((n: { slug: string; id: string }) => n.slug === slug)
        if (cancelled) return
        if (found) {
          setPublicationId(found.id)
        } else {
          setError(`Publication not found for slug: ${slug}`)
          setLoading(false)
          setChartLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(`Failed to resolve publication: ${err instanceof Error ? err.message : 'Network error'}`)
          setLoading(false)
          setChartLoading(false)
        }
      }
    })()
    return () => { cancelled = true }
  }, [slug])

  const fetchRecommendations = useCallback(async () => {
    if (!publicationId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/sparkloop/admin?filter=all&publication_id=${publicationId}`)
      const data = await res.json()
      if (data.success) {
        setRecommendations(data.recommendations)
        setCounts(data.counts)
        if (data.globalStats) setGlobalStats(data.globalStats)
        if (data.defaults) setDefaults(data.defaults)
      } else {
        const msg = data.error || data.message || `API returned status ${res.status}`
        setError(`Failed to load recommendations: ${msg}`)
        console.error('SparkLoop admin API error:', data)
      }
    } catch (err) {
      setError(`Failed to fetch recommendations: ${err instanceof Error ? err.message : 'Network error'}`)
      console.error('Failed to fetch recommendations:', err)
    }
    setLoading(false)
  }, [publicationId])

  const fetchChartStats = useCallback(async () => {
    if (!publicationId) return
    setChartLoading(true)
    try {
      const res = await fetch(`/api/sparkloop/stats?days=${timeframe}&publication_id=${publicationId}`)
      const data = await res.json()
      if (data.success) setChartStats(data)
    } catch (err) {
      console.error('Failed to fetch chart stats:', err)
    }
    setChartLoading(false)
  }, [timeframe, publicationId])

  useEffect(() => { fetchRecommendations() }, [fetchRecommendations])
  useEffect(() => { fetchChartStats() }, [fetchChartStats])

  const syncFromSparkLoop = useCallback(async () => {
    if (!publicationId) return
    setSyncing(true)
    try {
      const res = await fetch(`/api/sparkloop/sync?publication_id=${publicationId}`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        alert(`Synced ${data.synced} recommendations (${data.created} new, ${data.updated} updated)`)
        fetchRecommendations()
        fetchChartStats()
      } else {
        alert('Sync failed: ' + data.error)
      }
    } catch (err) {
      console.error('Sync failed:', err)
      alert('Sync failed')
    }
    setSyncing(false)
  }, [publicationId, fetchRecommendations, fetchChartStats])

  const popupPreview = useMemo(() => filterEligibleRecs(recommendations).slice(0, 5), [recommendations])
  const recsPagePreview = useMemo(() => filterEligibleRecs(recommendations).slice(5, 8), [recommendations])

  const estimatedValue = useMemo<EstimatedValue>(() => {
    const popupValue = popupPreview.reduce((sum, rec) => sum + (rec.calculated_score || 0), 0)
    const pageValue = recsPagePreview.reduce((sum, rec) => {
      let pageCr = rec.page_cr !== null ? Number(rec.page_cr) : 0
      if (pageCr <= 0 && rec.page_impressions > 0 && rec.page_submissions > 0) {
        pageCr = (rec.page_submissions / rec.page_impressions) * 100
      }
      if (pageCr <= 0 || !rec.cpa) return sum
      const cpaDollars = rec.cpa / 100
      const rcr = rec.effective_rcr / 100
      const slip = rec.effective_slip / 100
      return sum + (pageCr / 100) * cpaDollars * rcr * (1 - slip)
    }, 0)
    return { popup: popupValue, page: pageValue, total: popupValue + pageValue }
  }, [popupPreview, recsPagePreview])

  return {
    publicationId,
    recommendations, counts, globalStats, defaults,
    loading, syncing, error,
    chartStats, chartLoading, timeframe, setTimeframe,
    activeTab, setActiveTab,
    popupPreview, recsPagePreview, estimatedValue,
    fetchRecommendations, syncFromSparkLoop,
  }
}
