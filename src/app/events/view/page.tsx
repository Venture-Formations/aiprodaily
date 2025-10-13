'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

interface Event {
  id: string
  title: string
  description: string
  start_date: string
  end_date: string
  venue: string
  address: string
  url: string | null
  image_url: string | null
  cropped_image_url: string | null
  featured: boolean
  paid_placement: boolean
}

interface Venue {
  name: string
  count: number
}

export default function ViewEventsPage() {
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [allEvents, setAllEvents] = useState<Event[]>([]) // Store all events for filtering
  const [venues, setVenues] = useState<Venue[]>([])
  const [selectedVenue, setSelectedVenue] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [pricing, setPricing] = useState({ paidPlacement: 5, featured: 15 })
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
  const [promotingEvent, setPromotingEvent] = useState<Event | null>(null)
  const [selectedPromotion, setSelectedPromotion] = useState<'paid' | 'featured' | null>(null)
  const [cartItemCount, setCartItemCount] = useState(0)

  useEffect(() => {
    loadEvents()
    loadPricing()
    updateCartCount()
  }, [])

  // Filter events when search query, venue, or date changes
  useEffect(() => {
    filterEvents()
  }, [searchQuery, selectedVenue, selectedDate, allEvents])

  const updateCartCount = () => {
    const cartJson = sessionStorage.getItem('eventCart')
    const cart = cartJson ? JSON.parse(cartJson) : []
    setCartItemCount(cart.length)
  }

  const loadEvents = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/events/public')
      if (response.ok) {
        const data = await response.json()
        setAllEvents(data.events || [])

        // Extract unique venues with counts from ALL events
        const venueMap = new Map<string, number>()
        data.events.forEach((event: Event) => {
          if (event.venue) {
            venueMap.set(event.venue, (venueMap.get(event.venue) || 0) + 1)
          }
        })

        const venueList = Array.from(venueMap.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => a.name.localeCompare(b.name))

        setVenues(venueList)
      }
    } catch (error) {
      console.error('Failed to load events:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterEvents = () => {
    let filtered = [...allEvents]

    // Apply venue filter
    if (selectedVenue !== 'all') {
      filtered = filtered.filter(event => event.venue === selectedVenue)
    }

    // Apply date filter
    if (selectedDate) {
      filtered = filtered.filter(event => {
        // Extract just the date part (YYYY-MM-DD) without timezone conversion
        const eventDate = event.start_date.split('T')[0]
        return eventDate === selectedDate
      })
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(event => {
        const searchableText = `
          ${event.title}
          ${event.description}
          ${event.venue}
          ${event.address}
        `.toLowerCase()
        return searchableText.includes(query)
      })
    }

    setEvents(filtered)
  }

  const loadPricing = async () => {
    try {
      const response = await fetch('/api/settings/public-events')
      if (response.ok) {
        const data = await response.json()
        setPricing({
          paidPlacement: parseFloat(data.paidPlacementPrice),
          featured: parseFloat(data.featuredEventPrice)
        })
      }
    } catch (error) {
      console.error('Failed to load pricing:', error)
    }
  }

  const promoteEvent = (event: Event) => {
    setPromotingEvent(event)
    setSelectedPromotion(null)
  }

  const addPromotionToCart = (goToCheckout: boolean = false) => {
    if (!promotingEvent || !selectedPromotion) return

    // Get existing cart
    const cartJson = sessionStorage.getItem('eventCart')
    const cart = cartJson ? JSON.parse(cartJson) : []

    // Determine if this is an upgrade from paid to featured
    const isUpgrade = promotingEvent.paid_placement && selectedPromotion === 'featured'

    // Parse dates and convert to 12-hour format
    const startDate = new Date(promotingEvent.start_date)
    const endDate = new Date(promotingEvent.end_date)

    const startHour24 = startDate.getHours()
    const endHour24 = endDate.getHours()

    const startHour12 = startHour24 === 0 ? 12 : (startHour24 > 12 ? startHour24 - 12 : startHour24)
    const endHour12 = endHour24 === 0 ? 12 : (endHour24 > 12 ? endHour24 - 12 : endHour24)

    // Create promotion cart item
    const promotionItem = {
      id: `promotion_${Date.now()}`,
      title: promotingEvent.title,
      description: promotingEvent.description,
      start_date: promotingEvent.start_date.split('T')[0],
      start_hour: startHour12.toString(),
      start_minute: startDate.getMinutes().toString().padStart(2, '0'),
      start_ampm: startHour24 >= 12 ? 'PM' : 'AM',
      end_hour: endHour12.toString(),
      end_minute: endDate.getMinutes().toString().padStart(2, '0'),
      end_ampm: endHour24 >= 12 ? 'PM' : 'AM',
      venue_id: '',
      venue_name: promotingEvent.venue,
      venue_street: promotingEvent.address.split(',')[0]?.trim() || '',
      venue_city: '',
      venue_state: '',
      venue_zip: '',
      submitter_first_name: '',
      submitter_last_name: '',
      submitter_email: '',
      submitter_phone: '',
      url: promotingEvent.url || '',
      placement_type: selectedPromotion,
      original_image_url: promotingEvent.cropped_image_url || '',
      cropped_image_url: promotingEvent.cropped_image_url || '',
      existing_event_id: promotingEvent.id,
      is_upgrade: isUpgrade,
      upgrade_price: isUpgrade ? 10 : undefined
    }

    cart.push(promotionItem)
    sessionStorage.setItem('eventCart', JSON.stringify(cart))

    if (goToCheckout) {
      // Redirect to checkout
      router.push('/events/checkout')
    } else {
      // Close modal and show success message
      setPromotingEvent(null)
      setSelectedPromotion(null)
      updateCartCount()
      alert('Promotion added to cart! You can continue browsing or checkout when ready.')
    }
  }

  const stripHtmlTags = (html: string) => {
    // Remove HTML tags and decode HTML entities
    const tmp = document.createElement('DIV')
    tmp.innerHTML = html
    return tmp.textContent || tmp.innerText || ''
  }

  const ensureHttps = (url: string | null) => {
    if (!url) return null
    // If URL already has protocol, return as-is
    if (url.match(/^https?:\/\//i)) return url
    // Otherwise, add https://
    return `https://${url}`
  }

  // Group events by date
  const groupEventsByDate = (events: Event[]) => {
    const groups = new Map<string, Event[]>()

    events.forEach(event => {
      const dateKey = new Date(event.start_date).toDateString()
      if (!groups.has(dateKey)) {
        groups.set(dateKey, [])
      }
      groups.get(dateKey)!.push(event)
    })

    // Sort events within each day: featured first, then paid_placement, then chronological
    groups.forEach((dayEvents, dateKey) => {
      dayEvents.sort((a, b) => {
        // Featured events first
        if (a.featured && !b.featured) return -1
        if (!a.featured && b.featured) return 1

        // Then paid placements (sponsored events)
        if (a.paid_placement && !b.paid_placement) return -1
        if (!a.paid_placement && b.paid_placement) return 1

        // Then chronological order by start time
        return new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      })
    })

    // Sort groups by date
    return Array.from(groups.entries())
      .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime())
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading events...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Logo Header */}
      <div className="bg-blue-600 py-3">
        <div className="max-w-6xl mx-auto px-4">
          <img
            src="https://raw.githubusercontent.com/VFDavid/STCScoop/refs/heads/main/STCSCOOP_Logo_824X148_clear.png"
            alt="St. Cloud Scoop"
            className="h-16 md:h-24 w-auto mx-auto"
          />
        </div>
      </div>

      <div className="py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Local Events</h1>
                <p className="text-gray-600">
                  Browse upcoming events in the St. Cloud area. Promote your event to reach more people!
                </p>
              </div>
            {cartItemCount > 0 && (
              <button
                onClick={() => router.push('/events/checkout')}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md font-medium flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Cart ({cartItemCount})
              </button>
            )}
          </div>
          <button
            onClick={() => router.push('/events/submit')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium"
          >
            Submit Your Event
          </button>
        </div>

        {/* Search and Filters */}
        <div className="bg-white shadow rounded-lg p-4 mb-6">
          <div className="space-y-4">
            {/* Search Bar */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Events
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title, description, venue, or address..."
                  className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <svg
                  className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Venue and Date Filters on Same Line */}
            <div className="flex flex-col md:flex-row gap-4">
              {/* Venue Filter */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Venue
                </label>
                <select
                  value={selectedVenue}
                  onChange={(e) => setSelectedVenue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Venues ({allEvents.length})</option>
                  {venues.map(venue => (
                    <option key={venue.name} value={venue.name}>
                      {venue.name} ({venue.count})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Filter */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {selectedDate && (
                    <button
                      onClick={() => setSelectedDate('')}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                      title="Clear date filter"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Results Count */}
            {(searchQuery || selectedVenue !== 'all' || selectedDate) && (
              <div className="text-sm text-gray-600">
                Showing {events.length} of {allEvents.length} events
                {searchQuery && ` matching "${searchQuery}"`}
                {selectedDate && ` on ${new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
              </div>
            )}
          </div>
        </div>

        {/* Events List - Grouped by Date */}
        {events.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <p className="text-gray-600 text-lg mb-4">No events found</p>
            <button
              onClick={() => router.push('/events/submit')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium"
            >
              Be the First to Submit
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {groupEventsByDate(events).map(([date, dateEvents]) => (
              <div key={date} className="bg-white shadow rounded-lg overflow-hidden">
                {/* Date Header */}
                <div className="bg-blue-600 text-white px-4 py-3">
                  <h2 className="text-lg font-semibold">
                    {new Date(date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </h2>
                  <p className="text-sm text-blue-100">{dateEvents.length} event{dateEvents.length > 1 ? 's' : ''}</p>
                </div>

                {/* Events for this date */}
                <div className="divide-y divide-gray-200">
                  {dateEvents.map(event => {
                    const isExpanded = expandedEventId === event.id
                    const cleanDescription = stripHtmlTags(event.description)

                    return (
                      <div key={event.id} className="hover:bg-gray-50 transition-colors">
                        {/* Compact View */}
                        <div
                          className="p-4 cursor-pointer"
                          onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {event.featured && (
                                  <span className="bg-yellow-400 text-yellow-900 px-2 py-0.5 text-xs font-medium rounded">
                                    ⭐ Featured
                                  </span>
                                )}
                                {event.paid_placement && !event.featured && (
                                  <span className="bg-blue-500 text-white px-2 py-0.5 text-xs font-medium rounded">
                                    Sponsored
                                  </span>
                                )}
                              </div>

                              <h3 className="text-base font-semibold text-gray-900 mb-1">
                                {event.title}
                              </h3>

                              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-2">
                                <span className="flex items-center">
                                  <span className="mr-1">🕒</span>
                                  {formatTime(event.start_date)}
                                </span>
                                <span className="flex items-center">
                                  <span className="mr-1">📍</span>
                                  {event.venue}
                                </span>
                              </div>

                              {!isExpanded && (
                                <p className="text-sm text-gray-600 line-clamp-2">
                                  {cleanDescription}
                                </p>
                              )}
                            </div>

                            {/* Compact Event Image */}
                            {event.cropped_image_url && (
                              <div className="flex-shrink-0">
                                <img
                                  src={event.cropped_image_url}
                                  alt={event.title}
                                  className="w-20 h-20 object-cover rounded"
                                />
                              </div>
                            )}

                            {/* Expand/Collapse Icon */}
                            <div className="flex-shrink-0">
                              <svg
                                className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </div>

                        {/* Expanded View */}
                        {isExpanded && (
                          <div className="px-4 pb-4 border-t border-gray-100">
                            {/* Full Details */}
                            <div className="space-y-3 mb-4">
                              <div className="flex items-start text-sm">
                                <span className="font-medium mr-2 text-gray-700">📅 Date:</span>
                                <div className="text-gray-600">
                                  <div>{formatDate(event.start_date)} at {formatTime(event.start_date)}</div>
                                  <div>to {formatDate(event.end_date)} at {formatTime(event.end_date)}</div>
                                </div>
                              </div>

                              <div className="flex items-start text-sm">
                                <span className="font-medium mr-2 text-gray-700">📍 Location:</span>
                                <div className="text-gray-600">
                                  <div className="font-medium">{event.venue}</div>
                                  {event.address && (
                                    <div className="text-gray-500">{event.address}</div>
                                  )}
                                </div>
                              </div>

                              <div className="text-sm">
                                <span className="font-medium text-gray-700 block mb-2">📝 Description:</span>
                                <p className="text-gray-600 whitespace-pre-wrap">
                                  {cleanDescription}
                                </p>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                              <a
                                href={`/events/${event.id}`}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Learn More →
                              </a>
                              {!event.featured && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    promoteEvent(event)
                                  }}
                                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                                >
                                  {event.paid_placement ? 'Promote to Featured Event' : 'Promote This Event'}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Promotion Info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-blue-900 mb-3">Do You Have an Event Coming Up?</h3>
          <p className="text-sm text-gray-700 mb-6">
            Each newsletter features 8 events for today, tomorrow, and the following day. *If submitted at least 4 days in advance, your event can appear in up to 3 newsletters leading up to the event date. Free events may be randomly selected if space allows, while promoted events are guaranteed placement. Featured events get top visibility with details and an image.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Free Listing */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">Free Listing – $0</h4>
              <p className="text-sm text-gray-600 mb-2">Promotion includes:</p>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Event added to the public events page</li>
                <li>• Eligible to appear in the newsletter (random selection if space is available)</li>
                <li>• No guarantee of email placement</li>
              </ul>
            </div>

            {/* Guaranteed Placement */}
            <div className="bg-white rounded-lg p-4 border-2 border-blue-500">
              <h4 className="font-semibold text-gray-900 mb-2">Guaranteed Placement (3 days*) – ${pricing.paidPlacement}</h4>
              <p className="text-sm text-gray-600 mb-2">Promotion includes:</p>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Guaranteed spot in the newsletter's daily list of 8 events</li>
                <li>• Standard placement without description or image</li>
                <li>• Event also listed on the public events page</li>
              </ul>
            </div>

            {/* Featured Event */}
            <div className="bg-yellow-50 rounded-lg p-4 border-2 border-yellow-500">
              <h4 className="font-semibold text-gray-900 mb-2">Featured Event (3 days*) – ${pricing.featured}</h4>
              <p className="text-sm text-gray-600 mb-2">Promotion includes:</p>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Guaranteed top placement in the newsletter</li>
                <li>• Event description and image (if provided) included</li>
                <li>• Maximum visibility and engagement</li>
              </ul>
            </div>
          </div>
          <button
            onClick={() => router.push('/events/submit')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium"
          >
            Submit Your Event
          </button>
        </div>
      </div>
      </div>

      {/* Promotion Modal */}
      {promotingEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Promote Event</h2>
                <button
                  onClick={() => setPromotingEvent(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-6">
                <h3 className="font-semibold text-lg text-gray-900 mb-2">{promotingEvent.title}</h3>
                <p className="text-sm text-gray-600">
                  {formatDate(promotingEvent.start_date)} at {formatTime(promotingEvent.start_date)}
                </p>
                <p className="text-sm text-gray-600">{promotingEvent.venue}</p>
              </div>

              <div className="space-y-4 mb-6">
                <h4 className="font-medium text-gray-900">
                  {promotingEvent.paid_placement ? 'Upgrade to Featured:' : 'Select Promotion Type:'}
                </h4>

                {/* Show upgrade info if already sponsored */}
                {promotingEvent.paid_placement && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-blue-800">
                      This event is already sponsored. Upgrade to Featured Event for just $10 more to get premium placement!
                    </p>
                  </div>
                )}

                {/* Paid Placement Option - Only show for non-sponsored events */}
                {!promotingEvent.paid_placement && (
                  <div
                    onClick={() => setSelectedPromotion('paid')}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedPromotion === 'paid'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <input
                            type="radio"
                            checked={selectedPromotion === 'paid'}
                            onChange={() => setSelectedPromotion('paid')}
                            className="mr-2"
                          />
                          <h5 className="font-semibold text-gray-900">Guaranteed Placement (3 days*) – ${pricing.paidPlacement}</h5>
                        </div>
                        <p className="text-xs text-gray-600 mb-2 ml-6">Promotion includes:</p>
                        <ul className="text-sm text-gray-700 space-y-1 ml-6">
                          <li>• Guaranteed spot in the newsletter's daily list of 8 events</li>
                          <li>• Standard placement without description or image</li>
                          <li>• Event also listed on the public events page</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Featured Event Option */}
                <div
                  onClick={() => setSelectedPromotion('featured')}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedPromotion === 'featured'
                      ? 'border-yellow-500 bg-yellow-50'
                      : 'border-gray-200 hover:border-yellow-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <input
                          type="radio"
                          checked={selectedPromotion === 'featured'}
                          onChange={() => setSelectedPromotion('featured')}
                          className="mr-2"
                        />
                        <h5 className="font-semibold text-gray-900">
                          Featured Event (3 days*) – ${promotingEvent.paid_placement ? '10' : pricing.featured}
                          {promotingEvent.paid_placement && (
                            <span className="ml-2 text-sm text-green-600 font-normal">
                              (Upgrade price)
                            </span>
                          )}
                        </h5>
                      </div>
                      <p className="text-xs text-gray-600 mb-2 ml-6">Promotion includes:</p>
                      <ul className="text-sm text-gray-700 space-y-1 ml-6">
                        <li>• Guaranteed top placement in the newsletter</li>
                        <li>• Event description and image (if provided) included</li>
                        <li>• Maximum visibility and engagement</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Newsletter Information */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-4">
                  <p className="text-xs text-gray-600">
                    Each newsletter features 8 events for today, tomorrow, and the following day. *If submitted at least 4 days in advance, your event can appear in up to 3 newsletters leading up to the event date. Free events may be randomly selected if space allows, while promoted events are guaranteed placement. Featured events get top visibility with details and an image.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex gap-3">
                  <button
                    onClick={() => addPromotionToCart(false)}
                    disabled={!selectedPromotion}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add to Cart & Keep Browsing
                  </button>
                  <button
                    onClick={() => addPromotionToCart(true)}
                    disabled={!selectedPromotion}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add to Cart & Checkout
                  </button>
                </div>
                <button
                  onClick={() => setPromotingEvent(null)}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-md font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
