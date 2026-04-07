'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import type { ExcludedIp, IpSuggestion, DetectedScanner } from './types'

export function useIPExclusion() {
  const pathname = usePathname()
  const slug = pathname?.split('/')[2] || ''

  const [excludedIps, setExcludedIps] = useState<ExcludedIp[]>([])
  const [suggestions, setSuggestions] = useState<IpSuggestion[]>([])
  const [detectedScanners, setDetectedScanners] = useState<DetectedScanner[]>([])
  const [publicationId, setPublicationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [newIp, setNewIp] = useState('')
  const [newReason, setNewReason] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [emailModalIp, setEmailModalIp] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const PAGE_SIZE = 50

  const showMessage = (msg: string, type: 'success' | 'error') => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(''), 3000)
  }

  const fetchData = async () => {
    try {
      setLoading(true)

      const pubRes = await fetch(`/api/newsletters?slug=${slug}`)
      if (!pubRes.ok) {
        showMessage('Failed to load publication', 'error')
        return
      }
      const pubData = await pubRes.json()
      const pubId = pubData.newsletters?.[0]?.id

      if (!pubId) {
        showMessage('Publication not found', 'error')
        return
      }

      setPublicationId(pubId)

      const [ipsRes, suggestionsRes] = await Promise.all([
        fetch(`/api/excluded-ips?publication_id=${pubId}`),
        fetch(`/api/excluded-ips/suggestions?publication_id=${pubId}`)
      ])

      if (ipsRes.ok) {
        const ipsData = await ipsRes.json()
        setExcludedIps(ipsData.ips || [])
      }

      if (suggestionsRes.ok) {
        const suggestionsData = await suggestionsRes.json()
        setSuggestions(suggestionsData.suggestions || [])
        setDetectedScanners(suggestionsData.detected_scanners || [])
      }
    } catch (error) {
      console.error('Error fetching IP exclusion settings:', error)
      showMessage('Failed to load IP exclusion settings', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (slug) {
      fetchData()
    }
  }, [slug])

  const handleAddIp = async () => {
    if (!newIp.trim() || !publicationId) return

    try {
      const res = await fetch('/api/excluded-ips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publication_id: publicationId,
          ip_address: newIp.trim(),
          reason: newReason.trim() || null
        })
      })

      const data = await res.json()

      if (res.ok) {
        showMessage(data.message || 'IP excluded successfully', 'success')
        setNewIp('')
        setNewReason('')
        setExcludedIps(data.ips || [])
        setCurrentPage(1)
      } else {
        showMessage(data.error || 'Failed to exclude IP', 'error')
      }
    } catch (error) {
      showMessage('Failed to exclude IP', 'error')
    }
  }

  const handleRemoveIp = async (ipAddress: string) => {
    if (!publicationId) return

    try {
      const res = await fetch('/api/excluded-ips', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publication_id: publicationId,
          ip_address: ipAddress
        })
      })

      const data = await res.json()

      if (res.ok) {
        showMessage(data.message || 'IP removed from exclusion list', 'success')
        setExcludedIps(data.ips || [])
      } else {
        showMessage(data.error || 'Failed to remove IP', 'error')
      }
    } catch (error) {
      showMessage('Failed to remove IP', 'error')
    }
  }

  const handleExcludeSuggestion = async (ipAddress: string, reason: string) => {
    if (!publicationId) return

    try {
      const res = await fetch('/api/excluded-ips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publication_id: publicationId,
          ip_address: ipAddress,
          reason: reason
        })
      })

      const data = await res.json()

      if (res.ok) {
        showMessage(`IP "${ipAddress}" excluded from analytics`, 'success')
        setSuggestions(prev => prev.filter(s => s.ip_address !== ipAddress))
        setExcludedIps(data.ips || [])
        setCurrentPage(1)
      } else {
        showMessage(data.error || 'Failed to exclude IP', 'error')
      }
    } catch (error) {
      showMessage('Failed to exclude IP', 'error')
    }
  }

  const handleDismissSuggestion = (ipAddress: string) => {
    setSuggestions(prev => prev.filter(s => s.ip_address !== ipAddress))
    showMessage(`Suggestion dismissed`, 'success')
  }

  const handleExportCSV = async () => {
    if (!publicationId) return

    try {
      setExporting(true)
      const response = await fetch(`/api/excluded-ips/export?publication_id=${publicationId}`)

      if (!response.ok) {
        const errorData = await response.json()
        showMessage(errorData.error || 'Failed to export', 'error')
        return
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `excluded-ips-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      showMessage('CSV exported successfully', 'success')
    } catch (error) {
      console.error('Export error:', error)
      showMessage('Failed to export CSV', 'error')
    } finally {
      setExporting(false)
    }
  }

  const handleExcludeKnownScanner = async (scanner: DetectedScanner) => {
    if (!publicationId) return

    let successCount = 0
    for (const cidr of scanner.recommended_ranges) {
      try {
        const res = await fetch('/api/excluded-ips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publication_id: publicationId,
            ip_address: cidr,
            reason: `${scanner.organization} email scanner`
          })
        })

        if (res.ok) {
          successCount++
          const data = await res.json()
          setExcludedIps(data.ips || [])
          setCurrentPage(1)
        }
      } catch (error) {
        console.error(`Failed to exclude ${cidr}:`, error)
      }
    }

    if (successCount > 0) {
      showMessage(`Excluded ${successCount} ${scanner.organization} IP range(s)`, 'success')
      setSuggestions(prev => prev.filter(s => s.known_scanner?.organization !== scanner.organization))
      setDetectedScanners(prev => prev.filter(s => s.organization !== scanner.organization))
    } else {
      showMessage('Failed to exclude ranges', 'error')
    }
  }

  return {
    excludedIps,
    suggestions,
    detectedScanners,
    publicationId,
    loading,
    newIp,
    setNewIp,
    newReason,
    setNewReason,
    message,
    messageType,
    emailModalIp,
    setEmailModalIp,
    currentPage,
    setCurrentPage,
    exporting,
    PAGE_SIZE,
    handleAddIp,
    handleRemoveIp,
    handleExcludeSuggestion,
    handleDismissSuggestion,
    handleExportCSV,
    handleExcludeKnownScanner,
  }
}
