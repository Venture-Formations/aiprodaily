'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import Layout from '@/components/Layout'
import Link from 'next/link'
import { Event } from '@/types/database'
import CsvUploadSummary from '@/components/CsvUploadSummary'
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

type SortField = 'title' | 'start_date' | 'venue' | 'featured' | 'created_at'
type SortDirection = 'asc' | 'desc'

interface EventsFilter {
  search: string
  placement: 'all' | 'featured' | 'paid' | 'featured_or_paid' | 'not_featured_or_paid'
  dateFilter: 'all' | 'upcoming' | 'past' | 'specific'
  specificDate?: string
}

interface ColumnConfig {
  key: keyof Event
  label: string
  visible: boolean
  sortable: boolean
}

export default function EventsDatabasePage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [sortField, setSortField] = useState<SortField>('start_date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [filter, setFilter] = useState<EventsFilter>({
    search: '',
    placement: 'all',
    dateFilter: 'upcoming',
    specificDate: ''
  })
  const [showAddForm, setShowAddForm] = useState(false)
  const [showCsvUpload, setShowCsvUpload] = useState(false)
  const [csvUploadResult, setCsvUploadResult] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [editingEvent, setEditingEvent] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<Event>>({})
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [columns, setColumns] = useState<ColumnConfig[]>([
    { key: 'title', label: 'Title', visible: true, sortable: true },
    { key: 'start_date', label: 'Start Date', visible: true, sortable: true },
    { key: 'end_date', label: 'End Date', visible: false, sortable: true },
    { key: 'venue', label: 'Venue', visible: true, sortable: true },
    { key: 'address', label: 'Address', visible: false, sortable: false },
    { key: 'featured', label: 'Featured', visible: true, sortable: true },
    { key: 'paid_placement', label: 'Paid', visible: true, sortable: true },
    { key: 'url', label: 'URL', visible: false, sortable: false },
    { key: 'created_at', label: 'Created', visible: false, sortable: true }
  ])

  useEffect(() => {
    fetchEvents()
    fetchPendingCount()
  }, [])

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/events')
      if (response.ok) {
        const data = await response.json()
        setEvents(data.events || [])
      }
    } catch (error) {
      console.error('Failed to fetch events:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingCount = async () => {
    try {
      const response = await fetch('/api/events/submissions?status=pending')
      if (response.ok) {
        const data = await response.json()
        // Use the count from counts object if available, otherwise count submissions array
        setPendingCount(data.counts?.pending || data.submissions?.length || 0)
      }
    } catch (error) {
      console.error('Failed to fetch pending count:', error)
    }
  }

  const handleEdit = (event: Event) => {
    setEditingEvent(event.id)
    setEditData({
      title: event.title,
      venue: event.venue,
      address: event.address,
      start_date: event.start_date,
      featured: event.featured,
      paid_placement: event.paid_placement
    })
  }

  const handleCancelEdit = () => {
    setEditingEvent(null)
    setEditData({})
  }

  const handleSaveEdit = async (eventId: string) => {
    setUpdating(true)
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editData)
      })

      if (response.ok) {
        // Update the event in local state
        setEvents(events.map(event =>
          event.id === eventId ? { ...event, ...editData } : event
        ))
        setEditingEvent(null)
        setEditData({})
      } else {
        const errorData = await response.json()
        alert(`Failed to update event: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      alert(`Failed to update event: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setUpdating(false)
    }
  }

  const handleDelete = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      return
    }

    setDeleting(eventId)
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Remove the event from local state
        setEvents(events.filter(event => event.id !== eventId))
      } else {
        const errorData = await response.json()
        alert(`Failed to delete event: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      alert(`Failed to delete event: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setDeleting(null)
    }
  }

  const filteredAndSortedEvents = useMemo(() => {
    let filtered = events.filter(event => {
      const matchesSearch = event.title.toLowerCase().includes(filter.search.toLowerCase()) ||
                           (event.venue && event.venue.toLowerCase().includes(filter.search.toLowerCase()))

      let matchesPlacement = true
      if (filter.placement === 'featured') {
        matchesPlacement = event.featured && !event.paid_placement
      } else if (filter.placement === 'paid') {
        matchesPlacement = event.paid_placement
      } else if (filter.placement === 'featured_or_paid') {
        matchesPlacement = event.featured || event.paid_placement
      } else if (filter.placement === 'not_featured_or_paid') {
        matchesPlacement = !event.featured && !event.paid_placement
      }

      let matchesDate = true
      if (filter.dateFilter === 'upcoming') {
        matchesDate = new Date(event.start_date) >= new Date()
      } else if (filter.dateFilter === 'past') {
        matchesDate = new Date(event.start_date) < new Date()
      } else if (filter.dateFilter === 'specific' && filter.specificDate) {
        const eventDate = new Date(event.start_date).toISOString().split('T')[0]
        matchesDate = eventDate === filter.specificDate
      }

      return matchesSearch && matchesPlacement && matchesDate
    })

    filtered.sort((a, b) => {
      let aValue: any = a[sortField]
      let bValue: any = b[sortField]

      if (sortField === 'start_date' || sortField === 'created_at') {
        aValue = new Date(aValue as string).getTime()
        bValue = new Date(bValue as string).getTime()
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = (bValue as string).toLowerCase()
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [events, filter, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const toggleColumn = (key: keyof Event) => {
    setColumns(prev => prev.map(col =>
      col.key === key ? { ...col, visible: !col.visible } : col
    ))
  }

  const formatDate = (dateString: string) => {
    // Parse as local datetime (no timezone conversion)
    const date = new Date(dateString + 'T00:00:00')
    const [datePart, timePart] = dateString.split('T')

    if (timePart) {
      // Has time component - format both date and time
      const localDate = new Date(dateString)
      const formattedDate = localDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
      const formattedTime = localDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
      return { datePart: formattedDate, timePart: formattedTime }
    } else {
      // Date only
      const formattedDate = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
      return { datePart: formattedDate, timePart: '' }
    }
  }

  const visibleColumns = columns.filter(col => col.visible)

  const handleAddEvent = async (eventData: any) => {
    setSubmitting(true)
    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventData)
      })

      if (response.ok) {
        setShowAddForm(false)
        fetchEvents() // Refresh the events list
      } else {
        const error = await response.json()
        console.error('Failed to add event:', error)
        alert('Failed to add event: ' + (error.message || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error adding event:', error)
      alert('Failed to add event')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="flex justify-between items-center mb-6">
          <div>
            <nav className="flex" aria-label="Breadcrumb">
              <ol className="flex items-center space-x-2">
                <li>
                  <Link href="/dashboard/databases" className="text-gray-500 hover:text-gray-700">
                    Databases
                  </Link>
                </li>
                <li>
                  <span className="text-gray-500">/</span>
                </li>
                <li>
                  <span className="text-gray-900 font-medium">Local Events</span>
                </li>
              </ol>
            </nav>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">
              Local Events Database
            </h1>
            <p className="text-gray-600">
              {events.length} total events • {filteredAndSortedEvents.length} shown
            </p>
          </div>
          <div className="flex space-x-3">
            <Link
              href="/dashboard/events/review"
              className="relative bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center"
            >
              Review Submissions
              {pendingCount > 0 && (
                <span className="ml-2 bg-white text-orange-600 text-xs font-bold px-2 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </Link>
            <button
              onClick={() => setShowCsvUpload(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Upload CSV
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-brand-primary text-white px-4 py-2 rounded-lg hover:bg-brand-primary/90 font-medium"
            >
              Add Event
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                value={filter.search}
                onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
                placeholder="Search title or venue..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Placement
              </label>
              <select
                value={filter.placement}
                onChange={(e) => setFilter(prev => ({ ...prev, placement: e.target.value as any }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="all">All Events</option>
                <option value="featured">Featured Only</option>
                <option value="paid">Paid Placement Only</option>
                <option value="featured_or_paid">Featured/Paid</option>
                <option value="not_featured_or_paid">Not Featured/Paid</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <select
                value={filter.dateFilter}
                onChange={(e) => setFilter(prev => ({ ...prev, dateFilter: e.target.value as any, specificDate: e.target.value === 'specific' ? prev.specificDate : '' }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="all">All Dates</option>
                <option value="upcoming">Upcoming</option>
                <option value="past">Past</option>
                <option value="specific">Specific Date</option>
              </select>
              {filter.dateFilter === 'specific' && (
                <input
                  type="date"
                  value={filter.specificDate || ''}
                  onChange={(e) => setFilter(prev => ({ ...prev, specificDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mt-2"
                />
              )}
            </div>
          </div>
        </div>


        {/* Events Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {visibleColumns.map(col => (
                    <th
                      key={col.key}
                      className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                        col.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                      }`}
                      style={{
                        width: col.key === 'title' ? '30%' :
                               col.key === 'start_date' ? '18%' :
                               col.key === 'venue' ? '25%' :
                               col.key === 'featured' ? '6%' :
                               col.key === 'paid_placement' ? '6%' : 'auto'
                      }}
                      onClick={() => col.sortable && handleSort(col.key as SortField)}
                    >
                      <div className="flex items-center">
                        {col.label}
                        {col.sortable && sortField === col.key && (
                          <span className="ml-1">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '15%' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedEvents.map(event => {
                  const isEditing = editingEvent === event.id

                  return (
                    <tr key={event.id} className={`hover:bg-gray-50 ${isEditing ? 'bg-blue-50' : ''}`}>
                      {visibleColumns.map(col => (
                        <td key={col.key} className="px-4 py-3 text-sm text-gray-900">
                          {isEditing && (col.key === 'title' || col.key === 'venue' || col.key === 'address') ? (
                            <input
                              type="text"
                              value={(editData[col.key] as string) || ''}
                              onChange={(e) => setEditData({ ...editData, [col.key]: e.target.value })}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                            />
                          ) : isEditing && col.key === 'start_date' ? (
                            <div className="flex gap-1">
                              <input
                                type="date"
                                value={editData.start_date ? new Date(editData.start_date).toISOString().split('T')[0] : ''}
                                onChange={(e) => {
                                  const datePart = e.target.value
                                  const currentDate = editData.start_date ? new Date(editData.start_date) : new Date()
                                  const h = currentDate.getUTCHours().toString().padStart(2, '0')
                                  const m = currentDate.getUTCMinutes().toString().padStart(2, '0')
                                  setEditData({ ...editData, start_date: `${datePart}T${h}:${m}:00.000Z` })
                                }}
                                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                              />
                              <select
                                value={editData.start_date ? (() => {
                                  const d = new Date(editData.start_date)
                                  const hour = d.getUTCHours()
                                  return hour === 0 ? '12' : hour > 12 ? (hour - 12).toString() : hour.toString()
                                })() : ''}
                                onChange={(e) => {
                                  const datePart = editData.start_date ? new Date(editData.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
                                  const currentDate = editData.start_date ? new Date(editData.start_date) : new Date()
                                  const currentMin = currentDate.getUTCMinutes().toString().padStart(2, '0')
                                  const currentHour = currentDate.getUTCHours()
                                  const isAM = currentHour < 12
                                  const hour12 = parseInt(e.target.value)
                                  let hour24 = hour12 === 12 ? 0 : hour12
                                  if (!isAM) hour24 += 12
                                  const h = hour24.toString().padStart(2, '0')
                                  setEditData({ ...editData, start_date: `${datePart}T${h}:${currentMin}:00.000Z` })
                                }}
                                className="px-2 py-1 border border-gray-300 rounded text-sm"
                              >
                                {Array.from({ length: 12 }, (_, i) => (
                                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                                ))}
                              </select>
                              <select
                                value={editData.start_date ? new Date(editData.start_date).getUTCMinutes().toString().padStart(2, '0') : ''}
                                onChange={(e) => {
                                  const datePart = editData.start_date ? new Date(editData.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
                                  const currentDate = editData.start_date ? new Date(editData.start_date) : new Date()
                                  const h = currentDate.getUTCHours().toString().padStart(2, '0')
                                  setEditData({ ...editData, start_date: `${datePart}T${h}:${e.target.value}:00.000Z` })
                                }}
                                className="px-2 py-1 border border-gray-300 rounded text-sm"
                              >
                                <option value="00">00</option>
                                <option value="15">15</option>
                                <option value="30">30</option>
                                <option value="45">45</option>
                              </select>
                              <select
                                value={editData.start_date ? (new Date(editData.start_date).getUTCHours() < 12 ? 'AM' : 'PM') : ''}
                                onChange={(e) => {
                                  const datePart = editData.start_date ? new Date(editData.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
                                  const currentDate = editData.start_date ? new Date(editData.start_date) : new Date()
                                  const currentHour = currentDate.getUTCHours()
                                  const currentMin = currentDate.getUTCMinutes().toString().padStart(2, '0')
                                  let newHour = currentHour
                                  if (e.target.value === 'PM' && currentHour < 12) {
                                    newHour = currentHour + 12
                                  } else if (e.target.value === 'AM' && currentHour >= 12) {
                                    newHour = currentHour - 12
                                  }
                                  const h = newHour.toString().padStart(2, '0')
                                  setEditData({ ...editData, start_date: `${datePart}T${h}:${currentMin}:00.000Z` })
                                }}
                                className="px-2 py-1 border border-gray-300 rounded text-sm"
                              >
                                <option value="AM">AM</option>
                                <option value="PM">PM</option>
                              </select>
                            </div>
                          ) : isEditing && col.key === 'featured' ? (
                            <input
                              type="checkbox"
                              checked={editData.featured || false}
                              onChange={(e) => setEditData({ ...editData, featured: e.target.checked })}
                              className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded"
                            />
                          ) : isEditing && col.key === 'paid_placement' ? (
                            <input
                              type="checkbox"
                              checked={editData.paid_placement || false}
                              onChange={(e) => setEditData({ ...editData, paid_placement: e.target.checked })}
                              className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded"
                            />
                          ) : col.key === 'featured' ? (
                            event.featured ? (
                              <span className="text-green-600 text-lg">✓</span>
                            ) : null
                          ) : col.key === 'paid_placement' ? (
                            event.paid_placement ? (
                              <span className="text-green-600 text-lg">✓</span>
                            ) : null
                          ) : col.key === 'start_date' || col.key === 'end_date' || col.key === 'created_at' ? (
                            event[col.key] ? (
                              <div className="flex flex-col">
                                <span>{formatDate(event[col.key] as string).datePart}</span>
                                <span className="text-xs text-gray-500">{formatDate(event[col.key] as string).timePart}</span>
                              </div>
                            ) : '-'
                          ) : col.key === 'url' ? (
                            event.url ? (
                              <a href={event.url} target="_blank" rel="noopener noreferrer" className="text-brand-primary hover:underline">
                                View
                              </a>
                            ) : '-'
                          ) : col.key === 'title' ? (
                            <span className={!event.active ? 'line-through text-gray-400' : ''}>
                              {event[col.key] || '-'}
                            </span>
                          ) : (
                            event[col.key] || '-'
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                        {isEditing ? (
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => handleSaveEdit(event.id)}
                              disabled={updating}
                              className="text-green-600 hover:text-green-800 disabled:opacity-50"
                            >
                              {updating ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              disabled={updating}
                              className="text-gray-600 hover:text-gray-800 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="relative inline-block text-left">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleEdit(event)}
                                className="text-brand-primary hover:text-brand-primary/80"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(event.id)}
                                disabled={deleting === event.id}
                                className="text-red-600 hover:text-red-800 disabled:opacity-50"
                              >
                                {deleting === event.id ? 'Deleting...' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {filteredAndSortedEvents.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-200 rounded-lg mx-auto mb-4 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3a4 4 0 118 0v4m-4 8h0m0 0v4a4 4 0 01-8 0v-4h8z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No events found
            </h3>
            <p className="text-gray-500">
              Try adjusting your filters or add a new event.
            </p>
          </div>
        )}

        {/* Add Event Modal */}
        {showAddForm && (
          <AddEventModal
            onClose={() => setShowAddForm(false)}
            onSubmit={handleAddEvent}
            submitting={submitting}
          />
        )}

        {/* CSV Upload Modal */}
        {showCsvUpload && !csvUploadResult && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Events CSV</h3>
                <EventsCsvUploadForm
                  onClose={() => setShowCsvUpload(false)}
                  onSuccess={(result) => {
                    setCsvUploadResult(result)
                    fetchEvents()
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* CSV Upload Summary */}
        {csvUploadResult && (
          <CsvUploadSummary
            result={csvUploadResult}
            uploadType="Events"
            onClose={() => {
              setCsvUploadResult(null)
              setShowCsvUpload(false)
            }}
          />
        )}
      </div>
    </Layout>
  )
}

function AddEventModal({
  onClose,
  onSubmit,
  submitting
}: {
  onClose: () => void
  onSubmit: (data: any) => void
  submitting: boolean
}) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    venue: '',
    address: '',
    website: '',
    image_url: '',
    featured: false,
    paid_placement: false
  })

  // Image upload state
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [showImageUpload, setShowImageUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be smaller than 5MB')
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setSelectedImage(reader.result as string)
      // Set initial crop to 5:4 aspect ratio
      setCrop({
        unit: '%',
        width: 80,
        height: 64, // 80 * (4/5) = 64
        x: 10,
        y: 18
      })
    }
    reader.readAsDataURL(file)
  }

  const getCroppedImage = (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!imgRef.current || !completedCrop) {
        reject(new Error('No image to crop'))
        return
      }

      const canvas = document.createElement('canvas')
      const scaleX = imgRef.current.naturalWidth / imgRef.current.width
      const scaleY = imgRef.current.naturalHeight / imgRef.current.height

      // Set canvas to target dimensions (900x720)
      canvas.width = 900
      canvas.height = 720

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('No 2d context'))
        return
      }

      ctx.drawImage(
        imgRef.current,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        900,
        720
      )

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas is empty'))
            return
          }
          resolve(blob)
        },
        'image/jpeg',
        0.95
      )
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // If image was uploaded and cropped, upload it first
    if (selectedImage && completedCrop) {
      setUploading(true)
      try {
        const croppedBlob = await getCroppedImage()
        const uploadFormData = new FormData()
        uploadFormData.append('file', croppedBlob, 'event-image.jpg')

        const uploadResponse = await fetch('/api/events/upload-image', {
          method: 'POST',
          body: uploadFormData
        })

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload image')
        }

        const { cropped_image_url } = await uploadResponse.json()

        // Update formData with the uploaded image URL
        const dataWithImage = {
          ...formData,
          cropped_image_url,
          image_url: cropped_image_url
        }

        onSubmit(dataWithImage)
      } catch (error) {
        console.error('Image upload error:', error)
        alert('Failed to upload image. Please try again.')
      } finally {
        setUploading(false)
      }
    } else {
      onSubmit(formData)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Add New Event</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={submitting}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              disabled={submitting}
            />
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date & Time *
              </label>
              <div className="grid grid-cols-4 gap-2">
                <input
                  type="date"
                  required
                  value={formData.start_date.split('T')[0] || ''}
                  onChange={(e) => {
                    const datePart = e.target.value
                    const timePart = formData.start_date.split('T')[1] || '09:00'
                    setFormData(prev => ({ ...prev, start_date: datePart ? `${datePart}T${timePart}` : '' }))
                  }}
                  className="col-span-1 border border-gray-300 rounded-md px-3 py-2"
                  disabled={submitting}
                />
                <select
                  required
                  value={(() => {
                    const time = formData.start_date.split('T')[1]
                    if (!time) return ''
                    const [h] = time.split(':')
                    const hour = parseInt(h)
                    return hour === 0 ? '12' : hour > 12 ? (hour - 12).toString() : hour.toString()
                  })()}
                  onChange={(e) => {
                    const datePart = formData.start_date.split('T')[0]
                    const currentTime = formData.start_date.split('T')[1] || '09:00'
                    const [, min] = currentTime.split(':')
                    const hour12 = parseInt(e.target.value)
                    const currentHour24 = parseInt(currentTime.split(':')[0])
                    const isAM = currentHour24 < 12
                    let hour24 = hour12 === 12 ? 0 : hour12
                    if (!isAM) hour24 += 12
                    const hourStr = hour24.toString().padStart(2, '0')
                    setFormData(prev => ({ ...prev, start_date: datePart ? `${datePart}T${hourStr}:${min}` : '' }))
                  }}
                  className="border border-gray-300 rounded-md px-3 py-2"
                  disabled={submitting}
                >
                  <option value="">Hr</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
                <select
                  required
                  value={formData.start_date.split('T')[1]?.split(':')[1] || ''}
                  onChange={(e) => {
                    const datePart = formData.start_date.split('T')[0]
                    const currentTime = formData.start_date.split('T')[1] || '09:00'
                    const [h] = currentTime.split(':')
                    setFormData(prev => ({ ...prev, start_date: datePart ? `${datePart}T${h}:${e.target.value}` : '' }))
                  }}
                  className="border border-gray-300 rounded-md px-3 py-2"
                  disabled={submitting}
                >
                  <option value="">Min</option>
                  <option value="00">00</option>
                  <option value="15">15</option>
                  <option value="30">30</option>
                  <option value="45">45</option>
                </select>
                <select
                  required
                  value={(() => {
                    const time = formData.start_date.split('T')[1]
                    if (!time) return ''
                    const [h] = time.split(':')
                    return parseInt(h) < 12 ? 'AM' : 'PM'
                  })()}
                  onChange={(e) => {
                    const datePart = formData.start_date.split('T')[0]
                    const currentTime = formData.start_date.split('T')[1] || '09:00'
                    const [h, min] = currentTime.split(':')
                    const currentHour = parseInt(h)
                    let newHour = currentHour
                    if (e.target.value === 'PM' && currentHour < 12) {
                      newHour = currentHour + 12
                    } else if (e.target.value === 'AM' && currentHour >= 12) {
                      newHour = currentHour - 12
                    }
                    const hourStr = newHour.toString().padStart(2, '0')
                    setFormData(prev => ({ ...prev, start_date: datePart ? `${datePart}T${hourStr}:${min}` : '' }))
                  }}
                  className="border border-gray-300 rounded-md px-3 py-2"
                  disabled={submitting}
                >
                  <option value="">--</option>
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date & Time
              </label>
              <div className="grid grid-cols-4 gap-2">
                <input
                  type="date"
                  value={formData.end_date.split('T')[0] || ''}
                  onChange={(e) => {
                    const datePart = e.target.value
                    const timePart = formData.end_date.split('T')[1] || '17:00'
                    setFormData(prev => ({ ...prev, end_date: datePart ? `${datePart}T${timePart}` : '' }))
                  }}
                  className="col-span-1 border border-gray-300 rounded-md px-3 py-2"
                  disabled={submitting}
                />
                <select
                  value={(() => {
                    const time = formData.end_date.split('T')[1]
                    if (!time) return ''
                    const [h] = time.split(':')
                    const hour = parseInt(h)
                    return hour === 0 ? '12' : hour > 12 ? (hour - 12).toString() : hour.toString()
                  })()}
                  onChange={(e) => {
                    const datePart = formData.end_date.split('T')[0]
                    const currentTime = formData.end_date.split('T')[1] || '17:00'
                    const [, min] = currentTime.split(':')
                    const hour12 = parseInt(e.target.value)
                    const currentHour24 = parseInt(currentTime.split(':')[0])
                    const isAM = currentHour24 < 12
                    let hour24 = hour12 === 12 ? 0 : hour12
                    if (!isAM) hour24 += 12
                    const hourStr = hour24.toString().padStart(2, '0')
                    setFormData(prev => ({ ...prev, end_date: datePart ? `${datePart}T${hourStr}:${min}` : '' }))
                  }}
                  className="border border-gray-300 rounded-md px-3 py-2"
                  disabled={submitting}
                >
                  <option value="">Hr</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
                <select
                  value={formData.end_date.split('T')[1]?.split(':')[1] || ''}
                  onChange={(e) => {
                    const datePart = formData.end_date.split('T')[0]
                    const currentTime = formData.end_date.split('T')[1] || '17:00'
                    const [h] = currentTime.split(':')
                    setFormData(prev => ({ ...prev, end_date: datePart ? `${datePart}T${h}:${e.target.value}` : '' }))
                  }}
                  className="border border-gray-300 rounded-md px-3 py-2"
                  disabled={submitting}
                >
                  <option value="">Min</option>
                  <option value="00">00</option>
                  <option value="15">15</option>
                  <option value="30">30</option>
                  <option value="45">45</option>
                </select>
                <select
                  value={(() => {
                    const time = formData.end_date.split('T')[1]
                    if (!time) return ''
                    const [h] = time.split(':')
                    return parseInt(h) < 12 ? 'AM' : 'PM'
                  })()}
                  onChange={(e) => {
                    const datePart = formData.end_date.split('T')[0]
                    const currentTime = formData.end_date.split('T')[1] || '17:00'
                    const [h, min] = currentTime.split(':')
                    const currentHour = parseInt(h)
                    let newHour = currentHour
                    if (e.target.value === 'PM' && currentHour < 12) {
                      newHour = currentHour + 12
                    } else if (e.target.value === 'AM' && currentHour >= 12) {
                      newHour = currentHour - 12
                    }
                    const hourStr = newHour.toString().padStart(2, '0')
                    setFormData(prev => ({ ...prev, end_date: datePart ? `${datePart}T${hourStr}:${min}` : '' }))
                  }}
                  className="border border-gray-300 rounded-md px-3 py-2"
                  disabled={submitting}
                >
                  <option value="">--</option>
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Venue
            </label>
            <input
              type="text"
              value={formData.venue}
              onChange={(e) => setFormData(prev => ({ ...prev, venue: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Website
            </label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              disabled={submitting}
            />
          </div>

          {!showImageUpload ? (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Image URL
                </label>
                <button
                  type="button"
                  onClick={() => setShowImageUpload(true)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                  disabled={submitting}
                >
                  Upload Image Instead
                </button>
              </div>
              <input
                type="url"
                value={formData.image_url}
                onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                disabled={submitting}
                placeholder="https://example.com/image.jpg"
              />
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Upload Image
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowImageUpload(false)
                    setSelectedImage(null)
                    setCrop(undefined)
                    setCompletedCrop(undefined)
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                  disabled={submitting}
                >
                  Use URL Instead
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-2">Max 5MB, JPG format, will be cropped to 5:4 ratio (900x720px)</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={submitting}
              />

              {/* Image Cropper */}
              {selectedImage && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Crop Image (5:4 ratio)
                  </label>
                  <ReactCrop
                    crop={crop}
                    onChange={(c) => setCrop(c)}
                    onComplete={(c) => setCompletedCrop(c)}
                    aspect={5 / 4}
                  >
                    <img
                      ref={imgRef}
                      src={selectedImage}
                      alt="Crop preview"
                      style={{ maxWidth: '100%' }}
                    />
                  </ReactCrop>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.featured}
                onChange={(e) => setFormData(prev => ({ ...prev, featured: e.target.checked }))}
                className="mr-2"
                disabled={submitting}
              />
              <span className="text-sm font-medium text-gray-700">Featured Event</span>
            </label>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.paid_placement}
                onChange={(e) => setFormData(prev => ({ ...prev, paid_placement: e.target.checked }))}
                className="mr-2"
                disabled={submitting}
              />
              <span className="text-sm font-medium text-gray-700">Paid Placement Event</span>
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 disabled:opacity-50"
              disabled={submitting || uploading}
            >
              {uploading ? 'Uploading Image...' : submitting ? 'Adding...' : 'Add Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Events CSV Upload Form Component
function EventsCsvUploadForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: (result: any) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return

    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/events/upload-csv', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const result = await response.json()
      onSuccess(result.results)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* Download Template Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="text-sm font-medium text-blue-900 mb-1">Need a template?</h4>
            <p className="text-xs text-blue-700">
              Download our CSV template with example data and proper formatting
            </p>
          </div>
          <a
            href="/api/events/template"
            download="events_template.csv"
            className="ml-4 inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200 transition-colors"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Template
          </a>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select CSV File
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            CSV should have columns: external_id, title, description, start_date, end_date, venue, address, url, image_url, featured (checkbox), paid_placement (checkbox)
          </p>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!file || uploading}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload CSV'}
          </button>
        </div>
      </form>
    </div>
  )
}