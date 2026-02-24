'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import EmailsByIPModal from '@/components/EmailsByIPModal'

export default function IPExclusionSettings() {
  const pathname = usePathname()
  const slug = pathname?.split('/')[2] || ''

  const [excludedIps, setExcludedIps] = useState<{
    id: string
    ip_address: string
    is_range: boolean
    cidr_prefix: number | null
    reason: string | null
    added_by: string | null
    created_at: string
  }[]>([])
  const [suggestions, setSuggestions] = useState<{
    ip_address: string
    total_activity: number
    poll_votes: number
    link_clicks: number
    unique_emails: number
    time_span_seconds: number
    reason: string
    suspicion_level: 'high' | 'medium'
    known_scanner: {
      organization: string
      type: string
      description: string
      recommended_cidr: string
    } | null
  }[]>([])
  const [detectedScanners, setDetectedScanners] = useState<{
    organization: string
    type: string
    ip_count: number
    total_activity: number
    recommended_ranges: string[]
  }[]>([])
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

  const fetchData = async () => {
    try {
      setLoading(true)

      // First get publication ID from slug
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

      // Fetch excluded IPs and suggestions in parallel
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

  const showMessage = (msg: string, type: 'success' | 'error') => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(''), 3000)
  }

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
        setCurrentPage(1) // Reset to first page to show the new entry
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
        // Remove from suggestions and add to excluded
        setSuggestions(prev => prev.filter(s => s.ip_address !== ipAddress))
        setExcludedIps(data.ips || [])
        setCurrentPage(1) // Reset to first page to show the new entry
      } else {
        showMessage(data.error || 'Failed to exclude IP', 'error')
      }
    } catch (error) {
      showMessage('Failed to exclude IP', 'error')
    }
  }

  const handleDismissSuggestion = (ipAddress: string) => {
    // Just remove from local state (doesn't persist - will reappear on refresh)
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

      // Get the CSV content and trigger download
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

  const handleExcludeKnownScanner = async (scanner: typeof detectedScanners[0]) => {
    if (!publicationId) return

    // Exclude each recommended range
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
          setCurrentPage(1) // Reset to first page to show the new entry
        }
      } catch (error) {
        console.error(`Failed to exclude ${cidr}:`, error)
      }
    }

    if (successCount > 0) {
      showMessage(`Excluded ${successCount} ${scanner.organization} IP range(s)`, 'success')
      // Remove matching suggestions
      setSuggestions(prev => prev.filter(s => s.known_scanner?.organization !== scanner.organization))
      setDetectedScanners(prev => prev.filter(s => s.organization !== scanner.organization))
    } else {
      showMessage('Failed to exclude ranges', 'error')
    }
  }

  const getSuspicionBadgeColor = (level: 'high' | 'medium') => {
    return level === 'high'
      ? 'bg-red-100 text-red-800'
      : 'bg-yellow-100 text-yellow-800'
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

      {/* Excluded IPs Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">Excluded IP Addresses</h3>
          {excludedIps.length > 0 && (
            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="inline-flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 text-gray-700 px-3 py-1.5 rounded text-sm font-medium"
            >
              {exporting ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Exporting...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export CSV
                </>
              )}
            </button>
          )}
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Activity from these IP addresses will still be recorded, but will be excluded from both poll analytics and link click analytics.
          Use this to filter out spam clickers, bots, or internal testing. You can exclude individual IPs or CIDR ranges.
        </p>

        {/* Add IP Form */}
        <div className="space-y-3 mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddIp()}
              placeholder="Enter IP or CIDR range (e.g., 192.168.1.1 or 192.168.1.0/24)"
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono"
            />
            <button
              onClick={handleAddIp}
              disabled={!newIp.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded text-sm font-medium whitespace-nowrap"
            >
              Add IP
            </button>
          </div>
          <input
            type="text"
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            placeholder="Reason (optional, e.g., 'spam clicker', 'internal testing')"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>

        {/* Excluded IPs List */}
        {excludedIps.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No excluded IP addresses</p>
        ) : (
          <>
            {/* Summary and pagination info */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">
                Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, excludedIps.length)} - {Math.min(currentPage * PAGE_SIZE, excludedIps.length)} of {excludedIps.length} excluded IPs
                {' '}({excludedIps.filter(ip => ip.is_range).length} ranges, {excludedIps.filter(ip => !ip.is_range).length} single IPs)
              </p>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Added</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {excludedIps.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((ip) => (
                    <tr key={ip.id}>
                      <td className="px-4 py-3 text-sm font-mono">
                        {ip.is_range ? `${ip.ip_address}/${ip.cidr_prefix}` : ip.ip_address}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {ip.is_range ? (
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                            Range
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                            Single
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{ip.reason || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(ip.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          onClick={() => setEmailModalIp(ip.is_range ? `${ip.ip_address}/${ip.cidr_prefix}` : ip.ip_address)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          See Emails
                        </button>
                        <button
                          onClick={() => handleRemoveIp(ip.ip_address)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination controls */}
            {excludedIps.length > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={`px-4 py-2 text-sm font-medium rounded-md ${
                    currentPage === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Previous
                </button>
                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.ceil(excludedIps.length / PAGE_SIZE) }, (_, i) => i + 1)
                    .filter(page => {
                      // Show first, last, current, and pages around current
                      const totalPages = Math.ceil(excludedIps.length / PAGE_SIZE)
                      return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1
                    })
                    .map((page, index, arr) => (
                      <span key={page} className="flex items-center">
                        {index > 0 && arr[index - 1] !== page - 1 && (
                          <span className="px-2 text-gray-400">...</span>
                        )}
                        <button
                          onClick={() => setCurrentPage(page)}
                          className={`w-8 h-8 rounded-md text-sm font-medium ${
                            currentPage === page
                              ? 'bg-blue-600 text-white'
                              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      </span>
                    ))}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(excludedIps.length / PAGE_SIZE), p + 1))}
                  disabled={currentPage >= Math.ceil(excludedIps.length / PAGE_SIZE)}
                  className={`px-4 py-2 text-sm font-medium rounded-md ${
                    currentPage >= Math.ceil(excludedIps.length / PAGE_SIZE)
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detected Known Scanners Section */}
      {detectedScanners.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-orange-900 mb-2">
            Detected Email Security Scanners
          </h3>
          <p className="text-sm text-orange-800 mb-4">
            We detected activity from known email security services. These services scan links in emails
            before delivery, creating false clicks. Click &quot;Exclude All Ranges&quot; to block all their IP ranges.
          </p>

          <div className="space-y-3">
            {detectedScanners.map((scanner) => (
              <div
                key={scanner.organization}
                className="bg-white rounded-lg border border-orange-200 p-4 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{scanner.organization}</span>
                    <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                      {scanner.type === 'email_scanner' ? 'Email Scanner' : scanner.type}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {scanner.ip_count} IP{scanner.ip_count !== 1 ? 's' : ''} detected •
                    {' '}{scanner.total_activity} total activities •
                    {' '}{scanner.recommended_ranges.length} range{scanner.recommended_ranges.length !== 1 ? 's' : ''} to exclude
                  </p>
                  <p className="text-xs text-gray-500 mt-1 font-mono">
                    Ranges: {scanner.recommended_ranges.slice(0, 3).join(', ')}
                    {scanner.recommended_ranges.length > 3 && ` +${scanner.recommended_ranges.length - 3} more`}
                  </p>
                </div>
                <button
                  onClick={() => handleExcludeKnownScanner(scanner)}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded text-sm font-medium whitespace-nowrap"
                >
                  Exclude All Ranges
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested IPs Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Suggested IPs to Exclude</h3>
        <p className="text-sm text-gray-600 mb-4">
          These IPs show suspicious patterns like multiple different email addresses interacting within seconds -
          typically indicating email security scanners (Barracuda, Mimecast, etc.) or bots.
        </p>

        {suggestions.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No suspicious IPs detected - your data looks clean!</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Emails</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Suspicion</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {suggestions.map((suggestion) => (
                  <tr key={suggestion.ip_address} className={suggestion.known_scanner ? 'bg-orange-50' : ''}>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-mono">{suggestion.ip_address}</div>
                      {suggestion.known_scanner && (
                        <span className="inline-flex mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                          {suggestion.known_scanner.organization}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600" title={`${suggestion.poll_votes} poll votes, ${suggestion.link_clicks} link clicks`}>
                      {suggestion.total_activity}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{suggestion.unique_emails}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getSuspicionBadgeColor(suggestion.suspicion_level)}`}>
                        {suggestion.suspicion_level}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs" title={suggestion.reason}>
                      {suggestion.reason}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => setEmailModalIp(suggestion.ip_address)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        See Emails
                      </button>
                      <button
                        onClick={() => handleExcludeSuggestion(
                          suggestion.known_scanner?.recommended_cidr || suggestion.ip_address,
                          suggestion.reason
                        )}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                        title={suggestion.known_scanner ? `Exclude range ${suggestion.known_scanner.recommended_cidr}` : 'Exclude this IP'}
                      >
                        {suggestion.known_scanner ? 'Exclude Range' : 'Exclude'}
                      </button>
                      <button
                        onClick={() => handleDismissSuggestion(suggestion.ip_address)}
                        className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                      >
                        Dismiss
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
        <h4 className="font-semibold text-blue-900 mb-2">How IP Exclusion Works:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li><strong>Activity is still recorded:</strong> Excluded IPs can still vote and click links, but their activity won&apos;t be counted in analytics.</li>
          <li><strong>Applies to:</strong> Both poll response analytics and link click analytics.</li>
          <li><strong>CIDR ranges:</strong> Use CIDR notation (e.g., 192.168.1.0/24) to exclude entire IP ranges.</li>
          <li><strong>Useful for:</strong> Filtering out spam clickers, auto-clickers, bots, or internal testing.</li>
          <li><strong>Per-publication:</strong> Each publication has its own exclusion list.</li>
          <li><strong>Auditable:</strong> Click &quot;See Emails&quot; to view all email addresses associated with an IP.</li>
          <li><strong>Suggestions:</strong> IPs with multiple emails interacting within seconds are flagged as likely email security scanners.</li>
        </ul>
      </div>

      {/* Email Modal */}
      {emailModalIp && publicationId && (
        <EmailsByIPModal
          isOpen={!!emailModalIp}
          onClose={() => setEmailModalIp(null)}
          ipAddress={emailModalIp}
          publicationId={publicationId}
        />
      )}
    </div>
  )
}
