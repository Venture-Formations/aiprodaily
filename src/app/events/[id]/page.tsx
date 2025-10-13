'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

interface Event {
  id: string
  title: string
  description: string | null
  event_summary: string | null
  start_date: string
  end_date: string | null
  venue: string | null
  address: string | null
  url: string | null
  website: string | null
  image_url: string | null
  original_image_url: string | null
  cropped_image_url: string | null
  featured: boolean
  paid_placement: boolean
}

export default function EventPage() {
  const params = useParams()
  const router = useRouter()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPromotionModal, setShowPromotionModal] = useState(false)
  const [selectedPromotion, setSelectedPromotion] = useState<'paid' | 'featured' | null>(null)
  const [pricing, setPricing] = useState({ paidPlacement: 5, featured: 15 })

  useEffect(() => {
    if (params.id) {
      fetchEvent(params.id as string)
    }
    loadPricing()
  }, [params.id])

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

  const fetchEvent = async (id: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/events/${id}`)

      if (!response.ok) {
        if (response.status === 404) {
          setError('Event not found')
        } else {
          throw new Error('Failed to fetch event')
        }
        return
      }

      const data = await response.json()
      setEvent(data.event)
    } catch (err) {
      console.error('Error fetching event:', err)
      setError('Failed to load event')
    } finally {
      setLoading(false)
    }
  }

  const addPromotionToCart = (goToCheckout: boolean = false) => {
    if (!event || !selectedPromotion) return

    // Get existing cart
    const cartJson = sessionStorage.getItem('eventCart')
    const cart = cartJson ? JSON.parse(cartJson) : []

    // Determine if this is an upgrade from paid to featured
    const isUpgrade = event.paid_placement && selectedPromotion === 'featured'

    // Parse dates and convert to 12-hour format
    const startDate = new Date(event.start_date)
    const endDate = new Date(event.end_date || event.start_date)

    const startHour24 = startDate.getHours()
    const endHour24 = endDate.getHours()

    const startHour12 = startHour24 === 0 ? 12 : (startHour24 > 12 ? startHour24 - 12 : startHour24)
    const endHour12 = endHour24 === 0 ? 12 : (endHour24 > 12 ? endHour24 - 12 : endHour24)

    // Create promotion cart item
    const promotionItem = {
      id: `promotion_${Date.now()}`,
      title: event.title,
      description: event.description,
      start_date: event.start_date.split('T')[0],
      start_hour: startHour12.toString(),
      start_minute: startDate.getMinutes().toString().padStart(2, '0'),
      start_ampm: startHour24 >= 12 ? 'PM' : 'AM',
      end_hour: endHour12.toString(),
      end_minute: endDate.getMinutes().toString().padStart(2, '0'),
      end_ampm: endHour24 >= 12 ? 'PM' : 'AM',
      venue_id: '',
      venue_name: event.venue,
      venue_street: event.address?.split(',')[0]?.trim() || '',
      venue_city: '',
      venue_state: '',
      venue_zip: '',
      submitter_first_name: '',
      submitter_last_name: '',
      submitter_email: '',
      submitter_phone: '',
      url: event.url || '',
      placement_type: selectedPromotion,
      original_image_url: event.cropped_image_url || '',
      cropped_image_url: event.cropped_image_url || '',
      existing_event_id: event.id,
      is_upgrade: isUpgrade,
      upgrade_price: isUpgrade ? 10 : undefined
    }

    cart.push(promotionItem)
    sessionStorage.setItem('eventCart', JSON.stringify(cart))

    if (goToCheckout) {
      // Redirect to checkout
      router.push('/events/checkout')
    } else {
      // Redirect to events view
      router.push('/events/view')
    }
  }

  const formatDate = (startDate: string, endDate: string | null) => {
    const start = new Date(startDate)
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Chicago'
    }

    if (!endDate || startDate === endDate) {
      return start.toLocaleDateString('en-US', options)
    }

    const end = new Date(endDate)
    const startFormatted = start.toLocaleDateString('en-US', options)
    const endFormatted = end.toLocaleDateString('en-US', options)

    // If same day, just show different times
    if (start.toDateString() === end.toDateString()) {
      return `${startFormatted} - ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })}`
    }

    return `${startFormatted} - ${endFormatted}`
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const stripHtmlTags = (html: string | null) => {
    if (!html) return ''
    const tmp = document.createElement('DIV')
    tmp.innerHTML = html
    return tmp.textContent || tmp.innerText || ''
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {error || 'Event Not Found'}
          </h1>
          <Link
            href="/events/view"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            ← Back to Events
          </Link>
        </div>
      </div>
    )
  }

  const displayImage = event.cropped_image_url || event.image_url || event.original_image_url

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Logo Header */}
      <div className="bg-blue-600 py-3">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/events/view">
            <img
              src="https://raw.githubusercontent.com/VFDavid/STCScoop/refs/heads/main/STCSCOOP_Logo_824X148_clear.png"
              alt="St. Cloud Scoop"
              className="h-16 md:h-24 w-auto mx-auto"
            />
          </Link>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href="/events/view"
            className="text-blue-600 hover:text-blue-800 font-medium flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Events
          </Link>
        </div>
      </div>

      {/* Event Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Event Image */}
          {displayImage && (
            <div className="relative w-full" style={{ paddingBottom: '80%' }}>
              <Image
                src={displayImage}
                alt={event.title}
                fill
                className="object-cover"
                priority
              />
            </div>
          )}

          {/* Event Details */}
          <div className="p-6 sm:p-8">
            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              {event.featured && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                  ⭐ Featured
                </span>
              )}
              {event.paid_placement && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  Sponsored
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              {event.title}
            </h1>

            {/* Date/Time */}
            <div className="flex items-start mb-6 text-gray-700">
              <svg className="w-6 h-6 mr-3 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div>
                <p className="font-medium text-lg">{formatDate(event.start_date, event.end_date)}</p>
              </div>
            </div>

            {/* Venue */}
            {event.venue && (
              <div className="flex items-start mb-6 text-gray-700">
                <svg className="w-6 h-6 mr-3 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <p className="font-medium text-lg">{event.venue}</p>
                  {event.address && <p className="text-gray-600">{event.address}</p>}
                </div>
              </div>
            )}

            {/* Description */}
            {(event.event_summary || event.description) && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-3">About This Event</h2>
                <div className="prose max-w-none text-gray-700">
                  <p>{event.event_summary || stripHtmlTags(event.description)}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-8 flex gap-4">
              {event.website && (
                <a
                  href={event.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Website
                </a>
              )}
              {!event.featured && (
                <button
                  onClick={() => setShowPromotionModal(true)}
                  className="inline-flex items-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                >
                  {event.paid_placement ? 'Upgrade to Featured' : 'Promote This Event'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Submit Your Event CTA */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Have an Event?</h3>
          <p className="text-gray-600 mb-4">Submit your event to be featured in our newsletter!</p>
          <Link
            href="/events/submit"
            className="inline-flex items-center px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Submit Your Event
          </Link>
        </div>
      </div>

      {/* Promotion Modal */}
      {showPromotionModal && event && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Promote Event</h2>
                <button
                  onClick={() => {
                    setShowPromotionModal(false)
                    setSelectedPromotion(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-6">
                <h3 className="font-semibold text-lg text-gray-900 mb-2">{event.title}</h3>
                <p className="text-sm text-gray-600">
                  {formatDateShort(event.start_date)} at {formatTime(event.start_date)}
                </p>
                <p className="text-sm text-gray-600">{event.venue}</p>
              </div>

              <div className="space-y-4 mb-6">
                <h4 className="font-medium text-gray-900">
                  {event.paid_placement ? 'Upgrade to Featured:' : 'Select Promotion Type:'}
                </h4>

                {/* Show upgrade info if already sponsored */}
                {event.paid_placement && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-blue-800">
                      This event is already sponsored. Upgrade to Featured Event for just $10 more to get premium placement!
                    </p>
                  </div>
                )}

                {/* Paid Placement Option - Only show for non-sponsored events */}
                {!event.paid_placement && (
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
                          <h5 className="font-semibold text-gray-900">Guaranteed Placement – ${pricing.paidPlacement}</h5>
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
                          Featured Event – ${event.paid_placement ? '10' : pricing.featured}
                          {event.paid_placement && (
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
                    Each newsletter features 8 events for today, tomorrow, and the following day. If submitted at least 4 days in advance, your event can appear in up to 3 newsletters leading up to the event date. Free events may be randomly selected if space allows, while promoted events are guaranteed placement. Featured events get top visibility with details and an image.
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
                  onClick={() => {
                    setShowPromotionModal(false)
                    setSelectedPromotion(null)
                  }}
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
