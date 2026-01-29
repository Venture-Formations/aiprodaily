'use client'

import { useEffect, useState } from 'react'

interface EmailEntry {
  email: string
  source: 'poll' | 'link_click'
  count: number
  first_seen: string
  last_seen: string
}

interface EmailsByIPModalProps {
  isOpen: boolean
  onClose: () => void
  ipAddress: string
  publicationId: string
}

export default function EmailsByIPModal({
  isOpen,
  onClose,
  ipAddress,
  publicationId
}: EmailsByIPModalProps) {
  const [emails, setEmails] = useState<EmailEntry[]>([])
  const [totals, setTotals] = useState<{
    poll_emails: number
    click_emails: number
    total_unique: number
  }>({ poll_emails: 0, click_emails: 0, total_unique: 0 })
  const [filter, setFilter] = useState<'all' | 'polls' | 'clicks'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && ipAddress && publicationId) {
      fetchEmails()
    }
  }, [isOpen, ipAddress, publicationId, filter])

  const fetchEmails = async () => {
    setLoading(true)
    setError(null)

    try {
      const encodedIp = encodeURIComponent(ipAddress)
      const res = await fetch(
        `/api/excluded-ips/${encodedIp}/emails?publication_id=${publicationId}&source=${filter}`
      )

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch emails')
      }

      const data = await res.json()
      setEmails(data.emails || [])
      setTotals(data.totals || { poll_emails: 0, click_emails: 0, total_unique: 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch emails')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const filteredEmails = emails.filter(email => {
    if (filter === 'all') return true
    if (filter === 'polls') return email.source === 'poll'
    if (filter === 'clicks') return email.source === 'link_click'
    return true
  })

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Emails for IP Address
              </h3>
              <p className="text-sm font-mono text-gray-600 mt-1">{ipAddress}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Filter and Stats */}
          <div className="px-6 py-3 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label htmlFor="source-filter" className="text-sm font-medium text-gray-700">
                Source:
              </label>
              <select
                id="source-filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value as 'all' | 'polls' | 'clicks')}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm"
              >
                <option value="all">All ({totals.total_unique} unique)</option>
                <option value="polls">Polls only ({totals.poll_emails})</option>
                <option value="clicks">Link clicks only ({totals.click_emails})</option>
              </select>
            </div>
            <div className="text-sm text-gray-500">
              {filteredEmails.length} email{filteredEmails.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto max-h-[50vh]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-600">
                {error}
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No emails found for this IP address
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Source
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Count
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      First Seen
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Last Seen
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEmails.map((entry, index) => (
                    <tr key={`${entry.email}-${entry.source}-${index}`}>
                      <td className="px-4 py-3 text-sm font-mono text-gray-900">
                        {entry.email}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            entry.source === 'poll'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {entry.source === 'poll' ? 'Poll' : 'Click'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {entry.count}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(entry.first_seen).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(entry.last_seen).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
