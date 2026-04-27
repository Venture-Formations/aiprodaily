'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import type { Recommendation } from '../types'

export interface Referral {
  subscriber_email: string
  subscribed_at: string
  status: string
  source: string
}

export interface SourceSummary {
  total: number
  confirmed: number
  rejected: number
  pending: number
  subscribed: number
}

export interface Summary {
  popup: SourceSummary
  page: SourceSummary
}

export function usePublicationsTab(recommendations: Recommendation[], publicationId: string | null) {
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null)
  const [searchText, setSearchText] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [referrals, setReferrals] = useState<Referral[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)

  const [sourceFilter, setSourceFilter] = useState<'all' | 'popup' | 'page'>('all')
  const [sortAsc, setSortAsc] = useState(false)
  const [timezone, setTimezone] = useState<'CST' | 'UTC'>('CST')

  const tz = timezone === 'CST' ? 'America/Chicago' : 'UTC'

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function setQuickRange(days: number) {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }

  useEffect(() => {
    if (selectedRec && startDate && endDate && publicationId) {
      fetchSubmissions()
    }
  }, [selectedRec, startDate, endDate, timezone, publicationId])

  async function fetchSubmissions() {
    if (!selectedRec || !startDate || !endDate || !publicationId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        ref_code: selectedRec.ref_code,
        start: startDate,
        end: endDate,
        tz: timezone,
        publication_id: publicationId,
      })
      const res = await fetch(`/api/sparkloop/admin/submissions?${params}`)
      const data = await res.json()
      if (data.success) {
        setReferrals(data.referrals)
        setSummary(data.summary)
      }
    } catch (error) {
      console.error('Failed to fetch submissions:', error)
    }
    setLoading(false)
  }

  const filteredRecs = useMemo(() => {
    if (!searchText.trim()) return recommendations
    const q = searchText.toLowerCase()
    return recommendations.filter(r => r.publication_name.toLowerCase().includes(q))
  }, [searchText, recommendations])

  const filteredReferrals = useMemo(() => {
    let list = [...referrals]
    if (sourceFilter === 'popup') list = list.filter(r => r.source === 'custom_popup')
    else if (sourceFilter === 'page') list = list.filter(r => r.source === 'recs_page')

    list.sort((a, b) => {
      const cmp = new Date(a.subscribed_at).getTime() - new Date(b.subscribed_at).getTime()
      return sortAsc ? cmp : -cmp
    })
    return list
  }, [referrals, sourceFilter, sortAsc])

  const clearSelection = () => {
    setSelectedRec(null)
    setSearchText('')
    setReferrals([])
    setSummary(null)
  }

  const clearDates = () => {
    setStartDate('')
    setEndDate('')
    setReferrals([])
    setSummary(null)
  }

  const selectRec = (rec: Recommendation) => {
    setSelectedRec(rec)
    setSearchText('')
    setDropdownOpen(false)
  }

  return {
    selectedRec,
    searchText,
    setSearchText,
    dropdownOpen,
    setDropdownOpen,
    dropdownRef,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    summary,
    loading,
    sourceFilter,
    setSourceFilter,
    sortAsc,
    setSortAsc,
    timezone,
    setTimezone,
    tz,
    filteredRecs,
    filteredReferrals,
    setQuickRange,
    clearSelection,
    clearDates,
    selectRec,
  }
}

export function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    confirmed: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    pending: 'bg-yellow-100 text-yellow-700',
    subscribed: 'bg-gray-100 text-gray-600',
  }
  return map[status] || 'bg-gray-100 text-gray-600'
}

export function sourceBadgeClass(source: string): string {
  return source === 'recs_page'
    ? 'bg-blue-100 text-blue-700'
    : 'bg-purple-100 text-purple-700'
}

export function sourceLabel(source: string): string {
  return source === 'recs_page' ? 'Page' : 'Popup'
}
