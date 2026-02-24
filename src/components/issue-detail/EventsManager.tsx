'use client'

import type { issueWithArticles, issueEvent, Event } from '@/types/database'

export default function EventsManager({
  issue,
  availableEvents,
  issueEvents,
  onUpdateEvents,
  updating
}: {
  issue: issueWithArticles | null
  availableEvents: Event[]
  issueEvents: issueEvent[]
  onUpdateEvents: (eventDate: string, selectedEvents: string[], featuredEvent?: string) => void
  updating: boolean
}) {
  if (!issue) return null

  // Calculate 3-day range starting from the newsletter date (issue.date)
  // Day 1: Newsletter date, Day 2: Next day, Day 3: Day after that
  const newsletterDate = new Date(issue.date + 'T00:00:00') // Parse as local date

  const dates = []
  for (let i = 0; i <= 2; i++) {
    const date = new Date(newsletterDate)
    date.setDate(newsletterDate.getDate() + i)
    dates.push(date.toISOString().split('T')[0])
  }

  const getEventsForDate = (date: string) => {
    // Create date range in Central Time (UTC-5)
    const dateStart = new Date(date + 'T00:00:00-05:00')
    const dateEnd = new Date(date + 'T23:59:59-05:00')
    return availableEvents.filter(event => {
      const eventStart = new Date(event.start_date)
      const eventEnd = event.end_date ? new Date(event.end_date) : eventStart

      // Event overlaps with this date
      return (eventStart <= dateEnd && eventEnd >= dateStart)
    })
  }

  const getSelectedEventsForDate = (date: string) => {
    return issueEvents
      .filter(ce => ce.event_date === date && ce.is_selected)
      .sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999))
  }

  const getFeaturedEventForDate = (date: string) => {
    // Only return manual featured if no database-featured events exist for this date
    const hasDatabaseFeatured = getEventsForDate(date).some(event => event.featured === true)
    if (hasDatabaseFeatured) {
      return null // Disable manual featuring when database-featured exists
    }
    const featured = issueEvents.find(ce => ce.event_date === date && ce.is_featured)
    return featured?.event_id
  }

  const handleEventToggle = (date: string, eventId: string, isSelected: boolean) => {
    const currentSelected = getSelectedEventsForDate(date).map(ce => ce.event_id)
    const currentFeatured = getFeaturedEventForDate(date)

    let newSelected: string[]
    if (isSelected) {
      // Add event if under limit
      if (currentSelected.length < 8) {
        newSelected = [...currentSelected, eventId]
      } else {
        return // Don't add if at limit
      }
    } else {
      // Remove event
      newSelected = currentSelected.filter(id => id !== eventId)
    }

    // Clear featured if we're removing the featured event
    const newFeatured = newSelected.includes(currentFeatured || '') ? currentFeatured : undefined

    onUpdateEvents(date, newSelected, newFeatured ?? undefined)
  }

  const handleFeaturedToggle = async (date: string, eventId: string) => {
    const currentSelected = getSelectedEventsForDate(date).map(ce => ce.event_id)
    const currentFeatured = getFeaturedEventForDate(date)

    // If unfeaturing, just do it
    if (currentFeatured === eventId) {
      onUpdateEvents(date, currentSelected, undefined)
      return
    }

    // If featuring, check if event has an image
    const event = availableEvents.find(e => e.id === eventId)
    if (event && !event.cropped_image_url) {
      // Show confirmation dialog
      const result = await new Promise<'yes' | 'add-image' | 'cancel'>((resolve) => {
        const dialog = document.createElement('div')
        dialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
        dialog.innerHTML = `
          <div class="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
            <h3 class="text-lg font-semibold text-gray-900 mb-3">Featured Event Without Image</h3>
            <p class="text-gray-600 mb-6">This event doesn't have an image. Featured events with images get better engagement. Would you like to add an image?</p>
            <div class="flex space-x-3">
              <button id="cancel-btn" class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md font-medium">Cancel</button>
              <button id="yes-btn" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium">Yes, Continue</button>
              <button id="add-image-btn" class="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium">Add Image</button>
            </div>
          </div>
        `
        document.body.appendChild(dialog)

        const cleanup = () => document.body.removeChild(dialog)

        dialog.querySelector('#cancel-btn')?.addEventListener('click', () => {
          cleanup()
          resolve('cancel')
        })

        dialog.querySelector('#yes-btn')?.addEventListener('click', () => {
          cleanup()
          resolve('yes')
        })

        dialog.querySelector('#add-image-btn')?.addEventListener('click', () => {
          cleanup()
          resolve('add-image')
        })
      })

      if (result === 'cancel') {
        return
      }

      if (result === 'add-image') {
        // Open event edit page in new tab
        window.open(`/dashboard/databases/events?edit=${eventId}`, '_blank')
        return
      }

      // If 'yes', continue with featuring
    }

    const newFeatured = eventId
    onUpdateEvents(date, currentSelected, newFeatured)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00')
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatEventTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Select up to 8 events per day. Mark one event as &quot;featured&quot; to highlight it in the newsletter.
      </div>

      {/* 3-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {dates.map(date => {
          const dateEvents = getEventsForDate(date)
          const selectedEvents = getSelectedEventsForDate(date)
          const featuredEventId = getFeaturedEventForDate(date)

          return (
            <div key={date} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Date Header */}
              <div className="bg-blue-600 text-white px-4 py-3">
                <h3 className="text-lg font-semibold text-center">
                  {formatDate(date)}
                </h3>
                <div className="text-sm text-blue-100 text-center mt-1">
                  {selectedEvents.length}/8 events selected
                </div>
              </div>

              {/* Events List */}
              <div className="p-4 bg-white min-h-[400px]">
                {dateEvents.length === 0 ? (
                  <div className="text-gray-500 text-sm py-8 text-center">
                    {selectedEvents.length > 0 ? 'Click "Local Events" to see available events for selection' : 'No events available for this date'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dateEvents.map(event => {
                      const isSelected = selectedEvents.some(ce => ce.event_id === event.id)
                      const isDatabaseFeatured = event.featured === true // Featured in events table
                      const isFeatured = featuredEventId === event.id // Manually featured in issue
                      const hasDatabaseFeatured = dateEvents.some(e => e.featured === true)

                      return (
                        <div
                          key={event.id}
                          className={`p-3 rounded-lg border-2 transition-all ${
                            isDatabaseFeatured || isFeatured
                              ? 'border-blue-500 bg-blue-50 shadow-md'
                              : isSelected
                                ? 'border-green-300 bg-green-50'
                                : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {/* Event Header with Checkbox */}
                          <div className="flex items-start justify-between mb-2">
                            <button
                              onClick={() => handleEventToggle(date, event.id, !isSelected)}
                              disabled={updating || (!isSelected && selectedEvents.length >= 8)}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                isSelected
                                  ? 'bg-brand-primary border-brand-primary text-white'
                                  : 'border-gray-300 hover:border-gray-400'
                              } ${updating || (!isSelected && selectedEvents.length >= 8) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              {isSelected && (
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>

                            {/* Database-Featured Badge (read-only, gold) */}
                            {isDatabaseFeatured && (
                              <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300 rounded">
                                ⭐ Featured
                              </span>
                            )}

                            {/* Manual Feature Button (only if no database-featured exists) */}
                            {!isDatabaseFeatured && !hasDatabaseFeatured && isSelected && (
                              <button
                                onClick={() => handleFeaturedToggle(date, event.id)}
                                disabled={updating}
                                className={`px-2 py-1 text-xs rounded border ${
                                  isFeatured
                                    ? 'bg-blue-500 text-white border-blue-500'
                                    : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                                } ${updating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                {isFeatured ? '⭐ Featured' : 'Feature'}
                              </button>
                            )}
                          </div>

                          {/* Event Details and Image */}
                          <div className="flex items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="text-sm font-semibold text-gray-900 leading-tight">
                                  {event.title}
                                </h4>
                                {event.paid_placement && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                    Sponsored
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-600 space-y-1">
                                <div className="font-medium">{formatEventTime(event.start_date)}</div>
                                {event.venue && <div>{event.venue}</div>}
                                {event.address && <div className="text-gray-500">{event.address}</div>}
                              </div>
                            </div>

                            {/* Featured Event Image */}
                            {(isDatabaseFeatured || isFeatured) && event.cropped_image_url && (
                              <div className="ml-3 flex-shrink-0">
                                <img
                                  src={event.cropped_image_url}
                                  alt={event.title}
                                  className="w-24 h-20 object-cover rounded border border-blue-300"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
