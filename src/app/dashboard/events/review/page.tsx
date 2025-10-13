'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Layout from '@/components/Layout'

interface EventSubmission {
  id: string
  title: string
  description: string
  start_date: string
  end_date: string
  venue: string
  address: string
  url: string | null
  original_image_url: string | null
  cropped_image_url: string | null
  submitter_name: string
  submitter_email: string
  submitter_phone: string | null
  submission_status: 'pending' | 'approved' | 'rejected'
  paid_placement: boolean
  featured: boolean
  payment_amount: number | null
  payment_status: string | null
  created_at: string
  active: boolean
}

export default function ReviewSubmissionsPage() {
  const { data: session } = useSession()
  const [submissions, setSubmissions] = useState<EventSubmission[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editedEvent, setEditedEvent] = useState<Partial<EventSubmission>>({})
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, all: 0 })

  useEffect(() => {
    loadSubmissions()
  }, [filter])

  const loadSubmissions = async () => {
    try {
      setLoading(true)
      const url = filter === 'all'
        ? '/api/events/submissions'
        : `/api/events/submissions?status=${filter}`

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setSubmissions(data.submissions || [])
        if (data.counts) {
          setCounts(data.counts)
        }
      }
    } catch (error) {
      console.error('Failed to load submissions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id: string) => {
    try {
      const response = await fetch(`/api/events/submissions/${id}/approve`, {
        method: 'POST'
      })

      if (response.ok) {
        loadSubmissions()
      }
    } catch (error) {
      console.error('Failed to approve:', error)
    }
  }

  const handleReject = async (id: string) => {
    const reason = prompt('Enter rejection reason (optional):')
    if (reason === null) return // User cancelled

    try {
      const response = await fetch(`/api/events/submissions/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })

      if (response.ok) {
        const data = await response.json()

        // Build user-friendly message
        let message = 'Event rejected successfully!'

        if (data.refund) {
          if (data.refund.success) {
            message += `\n\n✅ Refund processed: $${data.refund.amount}\nRefund ID: ${data.refund.refund_id}`
          } else {
            message += `\n\n❌ Refund failed: ${data.refund.error}`
          }
        }

        alert(message)
        loadSubmissions()
      }
    } catch (error) {
      console.error('Failed to reject:', error)
      alert('Failed to reject event')
    }
  }

  const startEdit = (submission: EventSubmission) => {
    setEditingId(submission.id)
    setEditedEvent(submission)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditedEvent({})
  }

  const saveEdit = async (id: string) => {
    try {
      const response = await fetch(`/api/events/submissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedEvent)
      })

      if (response.ok) {
        alert('Event updated!')
        setEditingId(null)
        setEditedEvent({})
        loadSubmissions()
      } else {
        alert('Failed to update event')
      }
    } catch (error) {
      console.error('Failed to update:', error)
      alert('Failed to update event')
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    }
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    )
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Review Event Submissions
          </h1>

          {/* Filter Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'pending', name: 'Pending', count: counts.pending },
                { id: 'approved', name: 'Approved', count: counts.approved },
                { id: 'rejected', name: 'Rejected', count: counts.rejected },
                { id: 'all', name: 'All', count: counts.all }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id as typeof filter)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    filter === tab.id
                      ? 'border-brand-primary text-brand-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.name} ({tab.count})
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Loading submissions...</p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <p className="text-gray-600 text-lg">No submissions found</p>
          </div>
        ) : (
          /* Submissions List */
          <div className="space-y-4">
            {submissions.map(submission => (
              <div key={submission.id} className="bg-white shadow rounded-lg p-6">
                {editingId === submission.id ? (
                  /* Edit Mode */
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                      <input
                        type="text"
                        value={editedEvent.title || ''}
                        onChange={(e) => setEditedEvent(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={editedEvent.description || ''}
                        onChange={(e) => setEditedEvent(prev => ({ ...prev, description: e.target.value }))}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
                        <input
                          type="text"
                          value={editedEvent.venue || ''}
                          onChange={(e) => setEditedEvent(prev => ({ ...prev, venue: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                        <input
                          type="text"
                          value={editedEvent.address || ''}
                          onChange={(e) => setEditedEvent(prev => ({ ...prev, address: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date/Time</label>
                        <input
                          type="datetime-local"
                          value={editedEvent.start_date ? new Date(editedEvent.start_date).toISOString().slice(0, 16) : ''}
                          onChange={(e) => setEditedEvent(prev => ({ ...prev, start_date: new Date(e.target.value).toISOString() }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date/Time</label>
                        <input
                          type="datetime-local"
                          value={editedEvent.end_date ? new Date(editedEvent.end_date).toISOString().slice(0, 16) : ''}
                          onChange={(e) => setEditedEvent(prev => ({ ...prev, end_date: new Date(e.target.value).toISOString() }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Event URL</label>
                      <input
                        type="url"
                        value={editedEvent.url || ''}
                        onChange={(e) => setEditedEvent(prev => ({ ...prev, url: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={cancelEdit}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => saveEdit(submission.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div>
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h2 className="text-xl font-semibold text-gray-900">{submission.title}</h2>
                          {getStatusBadge(submission.submission_status)}
                          {submission.featured && (
                            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-medium">
                              Featured
                            </span>
                          )}
                          {submission.paid_placement && (
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                              Paid
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          Submitted {formatDate(submission.created_at)} by {submission.submitter_name}
                        </p>
                      </div>
                      {submission.cropped_image_url && (
                        <img
                          src={submission.cropped_image_url}
                          alt={submission.title}
                          className="w-32 h-24 object-cover rounded"
                        />
                      )}
                    </div>

                    {/* Event Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Venue</p>
                        <p className="text-sm text-gray-900">{submission.venue}</p>
                        {submission.address && (
                          <p className="text-xs text-gray-500">{submission.address}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">Contact</p>
                        <p className="text-sm text-gray-900">{submission.submitter_email}</p>
                        {submission.submitter_phone && (
                          <p className="text-sm text-gray-900">{submission.submitter_phone}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">Start</p>
                        <p className="text-sm text-gray-900">{formatDate(submission.start_date)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">End</p>
                        <p className="text-sm text-gray-900">{formatDate(submission.end_date)}</p>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-1">Description</p>
                      <p className="text-sm text-gray-900">{submission.description}</p>
                    </div>

                    {/* Event URL */}
                    {submission.url && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-1">Event URL</p>
                        <a
                          href={submission.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {submission.url}
                        </a>
                      </div>
                    )}

                    {/* Payment Info */}
                    {submission.payment_amount && (
                      <div className="bg-gray-50 p-3 rounded mb-4">
                        <p className="text-sm font-medium text-gray-700">Payment: ${submission.payment_amount.toFixed(2)}</p>
                        <p className="text-xs text-gray-600">Status: {submission.payment_status || 'N/A'}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => startEdit(submission)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
                      >
                        Edit
                      </button>
                      {submission.submission_status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(submission.id)}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(submission.id)}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
