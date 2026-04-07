'use client'

import { useState, useEffect } from 'react'

interface DomainSuggestion {
  domain: string
  failure_count: number
  most_common_error: string
  most_common_status: string
  sample_url?: string
}

export function useBlockedDomains(publicationId: string) {
  const [blockedDomains, setBlockedDomains] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<DomainSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [newDomain, setNewDomain] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  const fetchData = async () => {
    try {
      setLoading(true)

      const [domainsRes, suggestionsRes] = await Promise.all([
        fetch(`/api/settings/blocked-domains?publication_id=${publicationId}`),
        fetch(`/api/settings/blocked-domains/suggestions?publication_id=${publicationId}`)
      ])

      if (domainsRes.ok) {
        const domainsData = await domainsRes.json()
        setBlockedDomains(domainsData.domains || [])
      }

      if (suggestionsRes.ok) {
        const suggestionsData = await suggestionsRes.json()
        setSuggestions(suggestionsData.suggestions || [])
      }
    } catch (error) {
      console.error('Error fetching blocked domains:', error)
      showMessage('Failed to load blocked domains', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [publicationId])

  const showMessage = (msg: string, type: 'success' | 'error') => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(''), 3000)
  }

  const handleAddDomain = async () => {
    if (!newDomain.trim()) return

    try {
      const res = await fetch(`/api/settings/blocked-domains?publication_id=${publicationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain.trim() })
      })

      const data = await res.json()

      if (res.ok) {
        showMessage(data.message, 'success')
        setNewDomain('')
        fetchData()
      } else {
        showMessage(data.error || 'Failed to add domain', 'error')
      }
    } catch (error) {
      showMessage('Failed to add domain', 'error')
    }
  }

  const handleRemoveDomain = async (domain: string) => {
    try {
      const res = await fetch(`/api/settings/blocked-domains?publication_id=${publicationId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
      })

      const data = await res.json()

      if (res.ok) {
        showMessage(data.message, 'success')
        fetchData()
      } else {
        showMessage(data.error || 'Failed to remove domain', 'error')
      }
    } catch (error) {
      showMessage('Failed to remove domain', 'error')
    }
  }

  const handleBlockSuggestion = async (domain: string) => {
    try {
      const res = await fetch(`/api/settings/blocked-domains?publication_id=${publicationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
      })

      const data = await res.json()

      if (res.ok) {
        showMessage(`Domain "${domain}" blocked`, 'success')
        fetchData()
      } else {
        showMessage(data.error || 'Failed to block domain', 'error')
      }
    } catch (error) {
      showMessage('Failed to block domain', 'error')
    }
  }

  const handleIgnoreSuggestion = async (domain: string) => {
    try {
      const res = await fetch(`/api/settings/blocked-domains/suggestions?publication_id=${publicationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
      })

      const data = await res.json()

      if (res.ok) {
        showMessage(`Domain "${domain}" ignored`, 'success')
        fetchData()
      } else {
        showMessage(data.error || 'Failed to ignore domain', 'error')
      }
    } catch (error) {
      showMessage('Failed to ignore domain', 'error')
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'blocked': return 'bg-red-100 text-red-800'
      case 'paywall': return 'bg-orange-100 text-orange-800'
      case 'login_required': return 'bg-yellow-100 text-yellow-800'
      case 'timeout': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return {
    blockedDomains,
    suggestions,
    loading,
    newDomain,
    setNewDomain,
    message,
    messageType,
    handleAddDomain,
    handleRemoveDomain,
    handleBlockSuggestion,
    handleIgnoreSuggestion,
    getStatusBadgeColor
  }
}
