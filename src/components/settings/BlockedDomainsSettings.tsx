'use client'

import { useState, useEffect } from 'react'

export default function BlockedDomainsSettings() {
  const [blockedDomains, setBlockedDomains] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<{
    domain: string
    failure_count: number
    most_common_error: string
    most_common_status: string
    sample_url?: string
  }[]>([])
  const [loading, setLoading] = useState(true)
  const [newDomain, setNewDomain] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch blocked domains and suggestions in parallel
      const [domainsRes, suggestionsRes] = await Promise.all([
        fetch('/api/settings/blocked-domains'),
        fetch('/api/settings/blocked-domains/suggestions')
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
  }, [])

  const showMessage = (msg: string, type: 'success' | 'error') => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(''), 3000)
  }

  const handleAddDomain = async () => {
    if (!newDomain.trim()) return

    try {
      const res = await fetch('/api/settings/blocked-domains', {
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
      const res = await fetch('/api/settings/blocked-domains', {
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
      const res = await fetch('/api/settings/blocked-domains', {
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
      const res = await fetch('/api/settings/blocked-domains/suggestions', {
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

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-6"></div>
          <div className="space-y-3">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-md ${
          messageType === 'success'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message}
        </div>
      )}

      {/* Blocked Domains Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Blocked Domains</h3>
        <p className="text-sm text-gray-600 mb-4">
          Posts from these domains will be completely skipped during RSS ingestion.
        </p>

        {/* Add Domain Form */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddDomain()}
            placeholder="Enter domain (e.g., example.com)"
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <button
            onClick={handleAddDomain}
            disabled={!newDomain.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded text-sm font-medium"
          >
            Add Domain
          </button>
        </div>

        {/* Blocked Domains List */}
        {blockedDomains.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No blocked domains</p>
        ) : (
          <div className="border rounded-lg divide-y">
            {blockedDomains.map((domain) => (
              <div key={domain} className="flex items-center justify-between px-4 py-3">
                <span className="font-mono text-sm">{domain}</span>
                <button
                  onClick={() => handleRemoveDomain(domain)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Suggested Domains Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Suggested Domains to Block</h3>
        <p className="text-sm text-gray-600 mb-4">
          These domains have had extraction failures. Review and decide whether to block them.
        </p>

        {suggestions.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No suggestions - all domains are extracting successfully!</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Domain</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Failures</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sample URL</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {suggestions.map((suggestion) => (
                  <tr key={suggestion.domain}>
                    <td className="px-4 py-3 text-sm font-mono">{suggestion.domain}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{suggestion.failure_count}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(suggestion.most_common_status)}`}>
                        {suggestion.most_common_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate" title={suggestion.most_common_error}>
                      {suggestion.most_common_error}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {suggestion.sample_url ? (
                        <a
                          href={suggestion.sample_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline truncate block max-w-[200px]"
                          title={suggestion.sample_url}
                        >
                          View Article →
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => handleBlockSuggestion(suggestion.domain)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Block
                      </button>
                      <button
                        onClick={() => handleIgnoreSuggestion(suggestion.domain)}
                        className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                      >
                        Ignore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">How Domain Blocking Works:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li><strong>Blocked domains:</strong> Posts from these domains are completely skipped during RSS ingestion - they won&apos;t appear in your newsletter.</li>
          <li><strong>Suggested domains:</strong> Domains that have had extraction failures (HTTP 403, paywall, login required, etc.) are shown as suggestions.</li>
          <li><strong>Block vs Ignore:</strong> &quot;Block&quot; adds the domain to your blocked list. &quot;Ignore&quot; dismisses the suggestion without blocking.</li>
          <li><strong>Domain matching:</strong> Blocking &quot;example.com&quot; also blocks &quot;www.example.com&quot; and &quot;news.example.com&quot;.</li>
        </ul>
      </div>
    </div>
  )
}
