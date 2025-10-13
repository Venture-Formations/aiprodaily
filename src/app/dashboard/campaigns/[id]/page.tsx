'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import DeleteCampaignModal from '@/components/DeleteCampaignModal'
import type { CampaignWithArticles, ArticleWithPost, CampaignEvent, Event, NewsletterSection } from '@/types/database'
import {
  DndContext,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import {
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Section Components
function WordleSection({ campaign }: { campaign: any }) {
  const [wordleData, setWordleData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchWordleData = async () => {
      try {
        const response = await fetch(`/api/test/wordle?campaign_date=${campaign.date}`)
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.wordle) {
            setWordleData(data.wordle)
          }
        }
      } catch (error) {
        console.error('Failed to fetch Wordle data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (campaign?.date) {
      fetchWordleData()
    }
  }, [campaign?.date])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
        <span className="ml-3 text-gray-600">Loading Wordle data...</span>
      </div>
    )
  }

  if (!wordleData) {
    return (
      <div className="text-center py-8 text-gray-500">
        No Wordle data available for yesterday
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="border border-gray-200 rounded-lg bg-white shadow-sm">
        <div className="bg-gray-50 text-center py-2 font-bold text-2xl text-gray-700 uppercase rounded-t-lg">
          {wordleData.word}
        </div>
        <div className="p-4">
          <div className="mb-3">
            <strong>Definition:</strong> {wordleData.definition}
          </div>
          <div>
            <strong>Interesting Fact:</strong> {wordleData.interesting_fact}
          </div>
        </div>
      </div>
    </div>
  )
}

function MinnesotaGetawaysSection({ campaign }: { campaign: any }) {
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const response = await fetch(`/api/test/minnesota-getaways?campaign_id=${campaign.id}`)
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.properties) {
            setProperties(data.properties)
          }
        }
      } catch (error) {
        console.error('Failed to fetch Minnesota Getaways data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (campaign?.id) {
      fetchProperties()
    }
  }, [campaign?.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
        <span className="ml-3 text-gray-600">Loading Minnesota Getaways...</span>
      </div>
    )
  }

  if (properties.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No Minnesota Getaways properties available
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {properties.map((property, index) => (
          <div key={index} className="border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden">
            {property.adjusted_image_url && (
              <img
                src={property.adjusted_image_url}
                alt={property.title}
                className="w-full h-48 object-cover"
              />
            )}
            <div className="p-4">
              <h3 className="font-semibold text-lg mb-2 text-blue-600">
                <a href={property.link || '#'} className="hover:underline">
                  {property.title}
                </a>
              </h3>
              <p className="text-gray-600 text-sm mb-3">{property.city}</p>
              <div className="border-t border-gray-200 pt-2">
                <div className="grid grid-cols-3 gap-2 text-center text-xs text-gray-700">
                  <div>
                    <strong>{property.bedrooms}</strong> BR
                  </div>
                  <div className="border-l border-r border-gray-200">
                    <strong>{property.bathrooms}</strong> BA
                  </div>
                  <div>
                    Sleeps <strong>{property.sleeps}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RoadWorkSection({ campaign }: { campaign: any }) {
  const [roadWorkItems, setRoadWorkItems] = useState<any[]>([])
  const [selectedItems, setSelectedItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    const fetchRoadWorkData = async () => {
      try {
        // Fetch all road work items
        const itemsResponse = await fetch(`/api/campaigns/${campaign.id}/road-work`)
        // Fetch selected items
        const selectionsResponse = await fetch(`/api/campaigns/${campaign.id}/road-work-selections`)

        if (itemsResponse.ok && selectionsResponse.ok) {
          const itemsData = await itemsResponse.json()
          const selectionsData = await selectionsResponse.json()

          if (itemsData.success) {
            setRoadWorkItems(itemsData.roadWorkItems || [])
          }

          if (selectionsData.success) {
            setSelectedItems(selectionsData.selections || [])
          }
        }
      } catch (error) {
        console.error('Failed to fetch road work data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRoadWorkData()
  }, [campaign.id])

  const handleItemToggle = async (itemId: string, isSelected: boolean) => {
    let newSelected: string[]

    if (isSelected) {
      // Add item if under limit (9 items max)
      if (selectedItems.length < 9) {
        newSelected = [...selectedItems.map(s => s.road_work_item_id), itemId]
      } else {
        alert('Maximum 9 road work items can be selected')
        return
      }
    } else {
      // Remove item
      newSelected = selectedItems.map(s => s.road_work_item_id).filter(id => id !== itemId)
    }

    setUpdating(true)
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/road-work-selections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_ids: newSelected })
      })

      if (response.ok) {
        const result = await response.json()
        // Refetch selections to get updated data
        const selectionsResponse = await fetch(`/api/campaigns/${campaign.id}/road-work-selections`)
        if (selectionsResponse.ok) {
          const selectionsData = await selectionsResponse.json()
          setSelectedItems(selectionsData.selections || [])
        }
      }
    } catch (error) {
      console.error('Failed to update road work selection:', error)
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
        <span className="ml-3 text-gray-600">Loading road work data...</span>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Road Work for {campaign.date}
          </h3>
          <div className="text-sm text-gray-500">
            {selectedItems.length}/9 items selected
          </div>
        </div>

        {roadWorkItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No road work items found for this date
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
            {roadWorkItems.map(item => {
              const isSelected = selectedItems.some(s => s.road_work_item_id === item.id)

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start space-x-2 mb-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleItemToggle(item.id, e.target.checked)}
                      disabled={updating}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded flex-shrink-0"
                    />
                    <h4 className="font-semibold text-gray-900 text-sm">{item.road_name}</h4>
                  </div>
                  <div className="ml-6">
                    <p className="text-gray-600 text-xs mb-1">{item.road_range}</p>
                    <p className="text-gray-500 text-xs mb-2">{item.reason}</p>
                    <div className="flex flex-col gap-1 text-xs">
                      <span className="text-orange-600">📍 {item.city_or_township}</span>
                      <span className="text-gray-500">{item.start_date} → {item.expected_reopen}</span>
                    </div>
                    {item.source_url && (
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 underline mt-1 inline-block"
                      >
                        View Source
                      </a>
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
}

function PollSection({ campaign }: { campaign: any }) {
  const [activePoll, setActivePoll] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [responseCount, setResponseCount] = useState(0)

  useEffect(() => {
    const fetchActivePoll = async () => {
      try {
        const response = await fetch('/api/polls/active')
        if (response.ok) {
          const data = await response.json()
          if (data.poll) {
            setActivePoll(data.poll)
            // Fetch response count for this poll
            const responsesResponse = await fetch(`/api/polls/${data.poll.id}/responses`)
            if (responsesResponse.ok) {
              const responsesData = await responsesResponse.json()
              setResponseCount(responsesData.responses?.length || 0)
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch active poll:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchActivePoll()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
        <span className="ml-3 text-gray-600">Loading poll data...</span>
      </div>
    )
  }

  if (!activePoll) {
    return (
      <div className="p-6">
        <div className="text-center py-8 text-gray-500">
          No active poll found. Create and activate a poll in the Poll Management section.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="bg-gray-50 rounded-lg p-6">
        <div className="mb-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-medium text-gray-900">
              {activePoll.title}
            </h3>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Active
            </span>
          </div>
          <p className="text-gray-700 text-base mb-4">{activePoll.question}</p>
        </div>

        <div className="space-y-2 mb-4">
          <h4 className="text-sm font-medium text-gray-700">Options:</h4>
          {activePoll.options && activePoll.options.map((option: string, index: number) => (
            <div key={index} className="flex items-center space-x-3 bg-white p-3 rounded-lg border border-gray-200">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
                {String.fromCharCode(65 + index)}
              </span>
              <span className="text-gray-900">{option}</span>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Total Responses:</span>
            <span className="font-semibold text-gray-900">{responseCount}</span>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            This poll will appear in the newsletter and track subscriber responses.
          </div>
        </div>
      </div>
    </div>
  )
}

function DiningDealsSection({ campaign }: { campaign: any }) {
  const [deals, setDeals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const response = await fetch(`/api/test/dining-deals`)
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.deals) {
            setDeals(data.deals)
          }
        }
      } catch (error) {
        console.error('Failed to fetch Dining Deals data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDeals()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
        <span className="ml-3 text-gray-600">Loading Dining Deals...</span>
      </div>
    )
  }

  if (deals.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No dining deals available for this date
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="space-y-4">
        {deals.map((deal, index) => (
          <div key={index} className="border border-gray-200 rounded-lg bg-white shadow-sm p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg">{deal.business_name}</h3>
                <p className="text-gray-600 mt-1">{deal.deal_description}</p>
                <p className="text-sm text-gray-500 mt-2">{deal.address}</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">{deal.day_of_week}</div>
                {deal.phone && (
                  <div className="text-sm text-gray-500">{deal.phone}</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Newsletter Section Component
function NewsletterSectionComponent({
  section,
  campaign,
  expanded,
  onToggleExpanded,
  weatherData,
  loadingWeather,
  onWeatherExpand,
  availableDiningDeals,
  campaignDiningDeals,
  onDiningDealsExpand,
  onUpdateDiningDeals,
  updatingDiningDeals
}: {
  section: NewsletterSection
  campaign: CampaignWithArticles | null
  expanded: boolean
  onToggleExpanded: () => void
  weatherData?: any
  loadingWeather?: boolean
  onWeatherExpand?: () => void
  availableDiningDeals?: any[]
  campaignDiningDeals?: any[]
  onDiningDealsExpand?: () => void
  onUpdateDiningDeals?: (selectedDealIds: string[], featuredDealId?: string) => void
  updatingDiningDeals?: boolean
}) {
  if (!campaign) return null

  const renderSectionContent = () => {
    switch (section.name) {
      case 'Local Events':
        return (
          <div className="text-center py-8 text-gray-500">
            Event management is handled in the dedicated Local Events section above
          </div>
        )
      case 'Local Weather':
        return (
          <div className="p-6">
            {loadingWeather ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                <span className="ml-3 text-gray-600">Loading weather data...</span>
              </div>
            ) : weatherData ? (
              weatherData.success === false ? (
                <div className="text-center py-8">
                  <div className="text-gray-500 mb-2">
                    {weatherData.message || 'Weather forecast not available'}
                  </div>
                  <div className="text-sm text-gray-400">
                    Weather data will be generated during the next scheduled RSS processing
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {weatherData.cached && (
                    <div className="mb-4 text-center text-sm text-blue-600 bg-blue-50 p-2 rounded">
                      📋 Showing cached weather forecast (generated at {new Date(weatherData.generatedAt).toLocaleString()})
                    </div>
                  )}
                  {weatherData.imageUrl ? (
                    <div className="mb-4">
                      <img
                        src={weatherData.imageUrl}
                        alt="Weather Forecast"
                        className="w-full max-w-md mx-auto rounded-lg border"
                      />
                    </div>
                  ) : (
                    <div className="mb-4 text-center text-sm text-gray-500">
                      Weather image generation is not configured
                    </div>
                  )}

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-3">3-Day Forecast</h4>
                    <div className="grid grid-cols-3 gap-4">
                      {weatherData.weatherData && weatherData.weatherData.map((day: any, index: number) => (
                        <div key={index} className="text-center">
                          <div className="font-semibold text-gray-900">{day.day}</div>
                          <div className="text-sm text-gray-500 mb-2">{day.dateLabel}</div>
                          <div className="text-2xl mb-2">{day.icon === 'sunny' ? '☀️' : day.icon === 'cloudy' ? '☁️' : day.icon === 'rainy' ? '🌧️' : '☀️'}</div>
                          <div className="text-sm">
                            <div className="font-semibold">{day.high}° / {day.low}°</div>
                            <div className="text-gray-500">{day.precipitation}% rain</div>
                            <div className="text-xs text-gray-500 mt-1">{day.condition}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )
            ) : (
              <div className="text-center py-8 text-gray-500">
                Click "View {section.name}" to load forecast data
              </div>
            )}
          </div>
        )
      case 'Yesterday\'s Wordle':
        return <WordleSection campaign={campaign} />
      case 'Minnesota Getaways':
        return <MinnesotaGetawaysSection campaign={campaign} />
      case 'Dining Deals':
        return (
          <div className="p-6">
            {campaign && availableDiningDeals && campaignDiningDeals && onUpdateDiningDeals ? (
              <DiningDealsManager
                campaign={campaign}
                availableDeals={availableDiningDeals}
                campaignDeals={campaignDiningDeals}
                onUpdateDeals={onUpdateDiningDeals}
                updating={updatingDiningDeals || false}
              />
            ) : (
              <div className="text-center py-8 text-gray-500">
                Click "View Dining Deals" to load management interface
              </div>
            )}
          </div>
        )
      case 'The Local Scoop':
        return (
          <div className="text-center py-8 text-gray-500">
            Article management is handled in the dedicated Articles section above
          </div>
        )
      case 'Road Work':
        return <RoadWorkSection campaign={campaign} />
      case 'Poll':
        return <PollSection campaign={campaign} />
      default:
        return (
          <div className="text-center py-8 text-gray-500">
            {section.name} content will be generated automatically in the newsletter preview and sent emails.
            <br />
            <span className="text-sm text-gray-400">
              This section is active and will appear in the correct order based on your settings.
            </span>
          </div>
        )
    }
  }

  return (
    <div className="bg-white shadow rounded-lg mt-6">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">
            {section.name}
          </h2>
          <button
            onClick={() => {
              if (section.name === 'Local Weather' && onWeatherExpand) {
                onWeatherExpand()
                onToggleExpanded()
              } else if (section.name === 'Dining Deals' && onDiningDealsExpand) {
                onDiningDealsExpand()
                onToggleExpanded()
              } else {
                onToggleExpanded()
              }
            }}
            className="flex items-center space-x-2 text-sm text-brand-primary hover:text-blue-700"
          >
            <span>{expanded ? 'Minimize' : `View ${section.name}`}</span>
            <svg
              className={`w-4 h-4 transform transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        <div className="mt-2 text-sm text-gray-600">
          Display Order: {section.display_order} | Status: {section.is_active ? 'Active' : 'Inactive'}
        </div>
      </div>

      {expanded && renderSectionContent()}
    </div>
  )
}

// Events Manager Component
function DiningDealsManager({
  campaign,
  availableDeals,
  campaignDeals,
  onUpdateDeals,
  updating
}: {
  campaign: CampaignWithArticles | null
  availableDeals: any[]
  campaignDeals: any[]
  onUpdateDeals: (selectedDealIds: string[], featuredDealId?: string) => void
  updating: boolean
}) {
  if (!campaign) return null

  const campaignDate = new Date(campaign.date + 'T00:00:00')
  const dayOfWeek = campaignDate.toLocaleDateString('en-US', { weekday: 'long' })
  const dateLabel = campaignDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  })

  // Filter deals for this day of week
  const dealsForDay = availableDeals.filter(deal => deal.day_of_week === dayOfWeek)

  const selectedDeals = campaignDeals // All items in campaignDeals are selected by definition
  const featuredDealId = campaignDeals.find(cd => cd.is_featured_in_campaign)?.deal_id

  const handleDealToggle = (dealId: string, isSelected: boolean) => {
    let newSelected: string[]
    if (isSelected) {
      // Add deal if under limit (8 deals max)
      if (campaignDeals.length < 8) {
        newSelected = [...campaignDeals.map(cd => cd.deal_id), dealId]
      } else {
        return // Don't add if at limit
      }
    } else {
      // Remove deal
      newSelected = campaignDeals.map(cd => cd.deal_id).filter(id => id !== dealId)
    }

    // Clear featured if we're removing the featured deal
    const newFeatured = newSelected.includes(featuredDealId || '') ? featuredDealId : undefined

    onUpdateDeals(newSelected, newFeatured)
  }

  const handleFeaturedToggle = (dealId: string) => {
    const currentSelected = campaignDeals.map(cd => cd.deal_id)
    const newFeatured = featuredDealId === dealId ? undefined : dealId
    onUpdateDeals(currentSelected, newFeatured)
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {dateLabel} Dining Deals
          </h3>
          <div className="text-sm text-gray-500">
            {campaignDeals.length}/8 deals selected
          </div>
        </div>

        {dealsForDay.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-500 mb-2">
              No dining deals available for {dayOfWeek}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {dealsForDay.map(deal => {
              const isSelected = campaignDeals.some(cd => cd.deal_id === deal.id)
              const isFeatured = featuredDealId === deal.id

              return (
                <div
                  key={deal.id}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    isFeatured
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : isSelected
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Deal Header with Checkbox */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleDealToggle(deal.id, e.target.checked)}
                        disabled={updating}
                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">
                          {deal.business_name}
                        </h4>
                        <p className="text-gray-600 text-sm mt-1">
                          {deal.special_description}
                        </p>
                        {deal.special_time && (
                          <p className="text-gray-500 text-xs mt-1">
                            {deal.special_time}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Featured Toggle */}
                    {isSelected && (
                      <button
                        onClick={() => handleFeaturedToggle(deal.id)}
                        disabled={updating}
                        className={`ml-2 px-2 py-1 text-xs font-medium rounded transition-colors ${
                          isFeatured
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                        }`}
                      >
                        {isFeatured ? '★ Featured' : 'Make Featured'}
                      </button>
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
}

function EventsManager({
  campaign,
  availableEvents,
  campaignEvents,
  onUpdateEvents,
  updating
}: {
  campaign: CampaignWithArticles | null
  availableEvents: Event[]
  campaignEvents: CampaignEvent[]
  onUpdateEvents: (eventDate: string, selectedEvents: string[], featuredEvent?: string) => void
  updating: boolean
}) {
  if (!campaign) return null

  // Calculate 3-day range starting from the newsletter date (campaign.date)
  // Day 1: Newsletter date, Day 2: Next day, Day 3: Day after that
  const newsletterDate = new Date(campaign.date + 'T00:00:00') // Parse as local date

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
    return campaignEvents
      .filter(ce => ce.event_date === date && ce.is_selected)
      .sort((a, b) => (a.display_order || 999) - (b.display_order || 999))
  }

  const getFeaturedEventForDate = (date: string) => {
    // Only return manual featured if no database-featured events exist for this date
    const hasDatabaseFeatured = getEventsForDate(date).some(event => event.featured === true)
    if (hasDatabaseFeatured) {
      return null // Disable manual featuring when database-featured exists
    }
    const featured = campaignEvents.find(ce => ce.event_date === date && ce.is_featured)
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
        Select up to 8 events per day. Mark one event as "featured" to highlight it in the newsletter.
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
                      const isFeatured = featuredEventId === event.id // Manually featured in campaign
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

// Regular Article Component (for inactive articles)
function RegularArticle({
  article,
  toggleArticle,
  skipArticle,
  saving,
  getScoreColor
}: {
  article: ArticleWithPost
  toggleArticle: (id: string, currentState: boolean) => void
  skipArticle: (id: string) => void
  saving: boolean
  getScoreColor: (score: number) => string
}) {
  return (
    <div className="border-b border-gray-200 p-4 bg-white hover:bg-gray-50">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 flex flex-col items-center space-y-2">
          {/* Toggle button */}
          <button
            onClick={() => toggleArticle(article.id, article.is_active)}
            disabled={saving}
            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
              article.is_active
                ? 'bg-blue-600 border-blue-600'
                : 'border-gray-300 hover:border-blue-400'
            } ${saving ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'}`}
            title={article.is_active ? 'Remove from newsletter' : 'Add to newsletter'}
          >
            {article.is_active && (
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>

        {/* Article image thumbnail */}
        {article.rss_post?.image_url && (
          <div className="flex-shrink-0">
            <img
              src={article.rss_post.image_url}
              alt={article.headline}
              className="w-16 h-16 object-cover rounded border"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-medium text-gray-900 pr-2">
                {article.headline}
              </h3>
            </div>
            {article.rss_post?.post_rating?.[0] && (
              <div className="flex space-x-1 text-xs flex-shrink-0">
                <span className={`font-medium ${getScoreColor(article.rss_post.post_rating[0].total_score)}`}>
                  Score: {article.rss_post.post_rating[0].total_score}/40
                </span>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{article.content}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">
              Source: {(() => {
                const author = article.rss_post?.author
                const feedName = article.rss_post?.rss_feed?.name

                // Use author if available and not "St. Cloud Local News"
                if (author && author !== 'St. Cloud Local News') {
                  return author
                }

                // Fall back to feed name if author is not useful
                return feedName || 'Unknown'
              })()}
            </span>
            <div className="flex items-center space-x-2">
              {article.word_count && (
                <span className="text-xs text-gray-500">
                  {article.word_count} words
                </span>
              )}
              {article.rss_post?.source_url && (
                <a
                  href={article.rss_post.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-primary hover:text-blue-700 text-xs"
                >
                  View Original
                </a>
              )}
              <button
                onClick={() => skipArticle(article.id)}
                disabled={saving}
                className="bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded text-xs font-medium disabled:opacity-50"
                title="Skip this article - removes it from the campaign"
              >
                Skip Article
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Sortable Article Component (for active articles only)
function SortableArticle({
  article,
  toggleArticle,
  skipArticle,
  saving,
  getScoreColor
}: {
  article: ArticleWithPost
  toggleArticle: (id: string, currentState: boolean) => void
  skipArticle: (id: string) => void
  saving: boolean
  getScoreColor: (score: number) => string
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: article.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-6 ${isDragging ? 'bg-gray-50' : ''} ${article.is_active ? 'border-l-4 border-blue-500' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-start space-x-3 mb-2">
            <button
              onClick={() => toggleArticle(article.id, article.is_active)}
              disabled={saving}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                article.is_active
                  ? 'bg-brand-primary border-brand-primary text-white'
                  : 'border-gray-300 hover:border-gray-400'
              } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {article.is_active && (
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>

            {/* Drag handle for active articles only */}
            {article.is_active && (
              <div
                {...attributes}
                {...listeners}
                className="flex-shrink-0 cursor-move mt-1 p-1 text-gray-400 hover:text-gray-600"
                title="Drag to reorder"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M7 2a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V4a2 2 0 00-2-2H7zM6 6h8v2H6V6zm0 4h8v2H6v-2zm0 4h8v2H6v-2z"/>
                </svg>
              </div>
            )}

            {/* Article image thumbnail */}
            {article.rss_post?.image_url && (
              <div className="flex-shrink-0">
                <img
                  src={article.rss_post.image_url}
                  alt=""
                  className="w-16 h-16 object-cover rounded-md border border-gray-200"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  {article.is_active && article.rank && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      #{article.rank}
                    </span>
                  )}
                  <h3 className="text-lg font-medium text-gray-900 pr-2">
                    {article.headline}
                  </h3>
                </div>
                {article.rss_post?.post_rating?.[0] && (
                  <div className="flex space-x-1 text-xs flex-shrink-0">
                    <span className={`font-medium ${getScoreColor(article.rss_post.post_rating[0].total_score)}`}>
                      Score: {article.rss_post.post_rating[0].total_score}/40
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="text-gray-700 mb-3">
            {article.content}
          </p>

          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center space-x-4">
              <span>Source: {(() => {
                const author = article.rss_post?.author
                const feedName = article.rss_post?.rss_feed?.name

                // Use author if available and not "St. Cloud Local News"
                if (author && author !== 'St. Cloud Local News') {
                  return author
                }

                // Fall back to feed name if author is not useful
                return feedName || 'Unknown'
              })()}</span>
              <span>{article.word_count} words</span>
              {article.fact_check_score && (
                <span className={getScoreColor(article.fact_check_score)}>
                  Fact-check: {article.fact_check_score}/30
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {article.rss_post?.source_url && (
                <a
                  href={article.rss_post.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-primary hover:text-blue-700"
                >
                  View Original
                </a>
              )}
              <button
                onClick={() => skipArticle(article.id)}
                disabled={saving}
                className="bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded text-xs font-medium disabled:opacity-50"
                title="Skip this article - removes it from the campaign"
              >
                Skip Article
              </button>
            </div>
          </div>

          {article.rss_post?.post_rating?.[0] && (
            <div className="mt-3 grid grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-gray-600">Interest:</span>
                <span className="ml-1 font-medium">{article.rss_post.post_rating[0].interest_level}/20</span>
              </div>
              <div>
                <span className="text-gray-600">Relevance:</span>
                <span className="ml-1 font-medium">{article.rss_post.post_rating[0].local_relevance}/10</span>
              </div>
              <div>
                <span className="text-gray-600">Impact:</span>
                <span className="ml-1 font-medium">{article.rss_post.post_rating[0].community_impact}/10</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CampaignDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [campaign, setCampaign] = useState<CampaignWithArticles | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState('')
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [generatingSubject, setGeneratingSubject] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  const [editingSubject, setEditingSubject] = useState(false)
  const [editSubjectValue, setEditSubjectValue] = useState('')
  const [savingSubject, setSavingSubject] = useState(false)

  // Events state
  const [campaignEvents, setCampaignEvents] = useState<CampaignEvent[]>([])
  const [availableEvents, setAvailableEvents] = useState<Event[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [eventsExpanded, setEventsExpanded] = useState(false)
  const [updatingEvents, setUpdatingEvents] = useState(false)
  const [articlesExpanded, setArticlesExpanded] = useState(false)

  // Weather state
  const [weatherExpanded, setWeatherExpanded] = useState(false)
  const [weatherData, setWeatherData] = useState<any>(null)
  const [loadingWeather, setLoadingWeather] = useState(false)
  const [diningDealsExpanded, setDiningDealsExpanded] = useState(false)
  const [availableDiningDeals, setAvailableDiningDeals] = useState<any[]>([])
  const [campaignDiningDeals, setCampaignDiningDeals] = useState<any[]>([])
  const [loadingDiningDeals, setLoadingDiningDeals] = useState(false)
  const [updatingDiningDeals, setUpdatingDiningDeals] = useState(false)

  // Newsletter sections state
  const [newsletterSections, setNewsletterSections] = useState<NewsletterSection[]>([])
  const [loadingSections, setLoadingSections] = useState(false)
  const [sectionExpandedStates, setSectionExpandedStates] = useState<{ [key: string]: boolean }>({})

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    console.log('📄 Campaign page loaded, params:', params.id)
    if (params.id) {
      fetchCampaign(params.id as string)
      fetchCampaignEvents(params.id as string)
      fetchNewsletterSections()
    }
  }, [params.id])

  const fetchCampaign = async (id: string) => {
    try {
      const response = await fetch(`/api/campaigns/${id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch campaign')
      }
      const data = await response.json()
      setCampaign(data.campaign)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const fetchCampaignEvents = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/events`)
      if (response.ok) {
        const data = await response.json()
        setCampaignEvents(data.campaign_events || [])
      }
    } catch (error) {
      console.error('Failed to fetch campaign events:', error)
    }
  }

  const fetchAvailableEvents = async (startDate: string, endDate: string) => {
    setLoadingEvents(true)
    try {
      const response = await fetch(`/api/events?start_date=${startDate}&end_date=${endDate}&active=true`)
      if (response.ok) {
        const data = await response.json()
        setAvailableEvents(data.events || [])
      }
    } catch (error) {
      console.error('Failed to fetch available events:', error)
    } finally {
      setLoadingEvents(false)
    }
  }

  const fetchNewsletterSections = async () => {
    setLoadingSections(true)
    try {
      const response = await fetch('/api/settings/newsletter-sections')
      if (response.ok) {
        const data = await response.json()
        setNewsletterSections(data.sections || [])
      }
    } catch (error) {
      console.error('Failed to fetch newsletter sections:', error)
    } finally {
      setLoadingSections(false)
    }
  }

  const toggleArticle = async (articleId: string, currentState: boolean) => {
    if (!campaign) return

    // Prevent selecting a 6th article - simply return without action
    if (!currentState) { // currentState is false means we're trying to activate
      const activeCount = campaign.articles.filter(article => article.is_active && !article.skipped).length
      if (activeCount >= 5) {
        return // No action taken, no alert - just prevent the selection
      }
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/articles`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          article_updates: [{
            article_id: articleId,
            is_active: !currentState
          }]
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update article')
      }

      // Update local state
      setCampaign(prev => {
        if (!prev) return prev
        return {
          ...prev,
          articles: prev.articles.map(article =>
            article.id === articleId
              ? { ...article, is_active: !currentState }
              : article
          )
        }
      })

    } catch (error) {
      alert('Failed to update article: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const skipArticle = async (articleId: string) => {
    if (!campaign) return

    setSaving(true)
    try {
      const response = await fetch(`/api/articles/${articleId}/skip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to skip article')
      }

      const responseData = await response.json()

      // Update local state to remove the skipped article
      setCampaign(prev => {
        if (!prev) return prev

        const updatedCampaign = {
          ...prev,
          articles: prev.articles.map(article =>
            article.id === articleId
              ? { ...article, skipped: true }
              : article
          )
        }

        // Update subject line if it was auto-regenerated
        if (responseData.subject_line_regenerated && responseData.new_subject_line) {
          console.log(`Subject line auto-updated after skip to: "${responseData.new_subject_line}"`)
          updatedCampaign.subject_line = responseData.new_subject_line
        }

        return updatedCampaign
      })

      // Show success message with subject line info if applicable
      const message = responseData.subject_line_regenerated
        ? `Article skipped successfully! Subject line auto-updated to: "${responseData.new_subject_line}"`
        : 'Article skipped successfully'

      alert(message)

    } catch (error) {
      alert('Failed to skip article: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const previewNewsletter = async () => {
    if (!campaign) return

    setPreviewLoading(true)
    try {
      console.log('Calling preview API for campaign:', campaign.id)
      const response = await fetch(`/api/campaigns/${campaign.id}/preview`)
      console.log('Preview API response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errorMessage = errorData?.error || `HTTP ${response.status}: ${response.statusText}`
        console.error('Preview API error:', errorMessage)
        throw new Error(errorMessage)
      }

      const data = await response.json()
      console.log('Preview data received:', !!data.html, 'HTML length:', data.html?.length)
      setPreviewHtml(data.html)
      setShowPreview(true)
    } catch (error) {
      console.error('Preview error:', error)
      alert('Failed to generate preview: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setPreviewLoading(false)
    }
  }

  const processRSSFeeds = async () => {
    if (!campaign) return

    setProcessing(true)
    setProcessingStatus('Initializing RSS processing...')

    try {
      // Start the processing
      setProcessingStatus('Fetching RSS feeds...')

      // Start processing in the background
      const processPromise = fetch('/api/rss/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaign_id: campaign.id
        })
      })

      // Poll for status updates while processing
      const statusInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/rss/status/${campaign.id}`)
          if (statusResponse.ok) {
            const statusData = await statusResponse.json()

            if (statusData.counts.posts > 0) {
              setProcessingStatus(`Found ${statusData.counts.posts} posts, evaluating with AI...`)
            }

            if (statusData.counts.articles > 0) {
              setProcessingStatus(`Generated ${statusData.counts.articles} articles, finalizing...`)
            }
          }
        } catch (error) {
          // Silent fail for status updates
        }
      }, 2000)

      // Wait for processing to complete
      const response = await processPromise
      clearInterval(statusInterval)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to process RSS feeds')
      }

      setProcessingStatus('Processing complete! Refreshing articles...')

      // Refresh the campaign data to show new articles
      await fetchCampaign(campaign.id)

      setProcessingStatus('Done!')
      setTimeout(() => setProcessingStatus(''), 2000)
    } catch (error) {
      setProcessingStatus('')
      alert('Failed to process RSS feeds: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setProcessing(false)
    }
  }


  const generateSubjectLine = async () => {
    if (!campaign) return

    // Check if there are any active articles
    const activeArticles = campaign.articles.filter(article => article.is_active)
    if (activeArticles.length === 0) {
      alert('Please select at least one article before generating a subject line.')
      return
    }

    setGeneratingSubject(true)
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/generate-subject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate subject line')
      }

      const data = await response.json()

      // Update campaign locally with new subject line
      setCampaign(prev => {
        if (!prev) return prev
        return {
          ...prev,
          subject_line: data.subject_line
        }
      })

      console.log(`Generated subject line: "${data.subject_line}" (${data.character_count} characters)`)

    } catch (error) {
      alert('Failed to generate subject line: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setGeneratingSubject(false)
    }
  }

  const startEditingSubject = () => {
    setEditSubjectValue(campaign?.subject_line || '')
    setEditingSubject(true)
  }

  const cancelEditingSubject = () => {
    setEditingSubject(false)
    setEditSubjectValue('')
  }

  const saveSubjectLine = async () => {
    if (!campaign) return

    setSavingSubject(true)
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/subject-line`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject_line: editSubjectValue.trim()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update subject line')
      }

      const data = await response.json()
      setCampaign(prev => prev ? { ...prev, subject_line: data.subject_line } : null)
      setEditingSubject(false)
      setEditSubjectValue('')

    } catch (error) {
      alert('Failed to save subject line: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setSavingSubject(false)
    }
  }

  const updateEventSelections = async (eventDate: string, selectedEvents: string[], featuredEvent?: string) => {
    if (!campaign) return

    setUpdatingEvents(true)
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/events`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_date: eventDate,
          selected_events: selectedEvents,
          featured_event: featuredEvent
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update events')
      }

      // Refresh campaign events
      await fetchCampaignEvents(campaign.id)

    } catch (error) {
      alert('Failed to update events: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setUpdatingEvents(false)
    }
  }

  // Helper function to get events count by date with color coding
  const getEventCountsByDate = () => {
    if (!campaign) return []

    // Calculate 3-day range starting from the newsletter date (campaign.date)
    // Day 1: Newsletter date, Day 2: Next day, Day 3: Day after that
    const newsletterDate = new Date(campaign.date + 'T00:00:00') // Parse as local date

    const dates = []
    for (let i = 0; i <= 2; i++) {
      const date = new Date(newsletterDate)
      date.setDate(newsletterDate.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]

      // Count selected events for this date
      const eventCount = campaignEvents.filter(ce =>
        ce.event_date === dateStr && ce.is_selected
      ).length

      // Determine color based on count
      let colorClass = 'text-red-600' // 0 events
      if (eventCount === 8) colorClass = 'text-green-600'
      else if (eventCount > 0) colorClass = 'text-yellow-600'

      dates.push({
        date: dateStr,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        monthDay: date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
        count: eventCount,
        colorClass
      })
    }

    return dates
  }

  const handleEventsExpand = () => {
    if (!eventsExpanded && campaign) {
      // Calculate 3-day range starting from the newsletter date (campaign.date)
      // Day 1: Newsletter date, Day 2: Next day, Day 3: Day after that
      const newsletterDate = new Date(campaign.date + 'T00:00:00') // Parse as local date

      const dates = []
      for (let i = 0; i <= 2; i++) {
        const date = new Date(newsletterDate)
        date.setDate(newsletterDate.getDate() + i)
        dates.push(date.toISOString().split('T')[0])
      }

      const startDateStr = dates[0]
      const endDateStr = dates[dates.length - 1]

      console.log('Fetching events with date range:', startDateStr, 'to', endDateStr, 'for newsletter date:', campaign.date)
      fetchAvailableEvents(startDateStr, endDateStr)
    }
    setEventsExpanded(!eventsExpanded)
  }

  const handleWeatherExpand = async () => {
    if (!weatherExpanded && campaign) {
      setLoadingWeather(true)
      try {
        // Fetch cached weather data for the campaign date
        const response = await fetch(`/api/weather/forecast?date=${campaign.date}`)
        const data = await response.json()

        if (data.success) {
          setWeatherData(data)
        } else {
          console.error('Failed to fetch cached weather data:', data.error)
          // If no cached data, show message about weather generation
          setWeatherData({
            success: false,
            error: data.error,
            message: data.message || 'Weather forecast not available'
          })
        }
      } catch (error) {
        console.error('Error fetching weather data:', error)
        setWeatherData({
          success: false,
          error: 'Network error',
          message: 'Failed to load weather forecast'
        })
      } finally {
        setLoadingWeather(false)
      }
    }
    setWeatherExpanded(!weatherExpanded)
  }

  const handleDiningDealsExpand = async () => {
    if (!diningDealsExpanded && campaign) {
      setLoadingDiningDeals(true)
      try {
        // Fetch available dining deals for the campaign date's day of week
        const campaignDate = new Date(campaign.date + 'T00:00:00')
        const dayOfWeek = campaignDate.toLocaleDateString('en-US', { weekday: 'long' })

        console.log('🍽️ Fetching dining deals for', dayOfWeek, 'campaign date:', campaign.date)

        const response = await fetch(`/api/dining-deals/available?day=${dayOfWeek}`)
        let availableDealsData: any = null

        if (response.ok) {
          const data = await response.json()
          console.log('📊 Available dining deals response:', data)
          setAvailableDiningDeals(data.deals || [])
          availableDealsData = data
        } else {
          console.error('❌ Failed to fetch available dining deals:', response.status, response.statusText)
        }

        // Fetch existing campaign dining selections
        const selectionsResponse = await fetch(`/api/campaigns/${campaign.id}/dining-deals`)
        if (selectionsResponse.ok) {
          const selectionsData = await selectionsResponse.json()
          console.log('📋 Campaign dining selections:', selectionsData)
          setCampaignDiningDeals(selectionsData.selections || [])

          // Auto-populate dining deals if none are selected yet
          if ((!selectionsData.selections || selectionsData.selections.length === 0) && availableDealsData?.deals?.length > 0) {
            console.log('🎲 Auto-selecting dining deals with business limits and randomization')

            try {
              // Use proper dining selector with business limits and randomization
              const { selectDiningDealsForCampaign } = await import('@/lib/dining-selector')
              const campaignDate = new Date(campaign.date + 'T00:00:00')
              const result = await selectDiningDealsForCampaign(campaign.id, campaignDate)

              console.log('🎯 Auto-selection result:', result.message)
              console.log('📋 Selected deals:', result.deals.map((deal: any) => `${deal.business_name}: ${deal.special_description}`))

              // Refresh dining deals data to show the new selections
              const updatedResponse = await fetch(`/api/campaigns/${campaign.id}/dining-deals`)
              if (updatedResponse.ok) {
                const updatedData = await updatedResponse.json()
                setCampaignDiningDeals(updatedData.selections || [])
              }
            } catch (error) {
              console.error('❌ Failed to auto-select dining deals:', error)
            }
          }
        } else {
          console.error('❌ Failed to fetch campaign dining selections:', selectionsResponse.status, selectionsResponse.statusText)
        }
      } catch (error) {
        console.error('Error fetching dining deals data:', error)
      } finally {
        setLoadingDiningDeals(false)
      }
    }
    setDiningDealsExpanded(!diningDealsExpanded)
  }

  const updateDiningDealsSelections = async (selectedDealIds: string[], featuredDealId?: string) => {
    if (!campaign) return

    setUpdatingDiningDeals(true)
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/dining-deals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deal_ids: selectedDealIds,
          featured_deal_id: featuredDealId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update dining deals selections')
      }

      // Refresh dining deals data
      const updatedResponse = await fetch(`/api/campaigns/${campaign.id}/dining-deals`)
      if (updatedResponse.ok) {
        const updatedData = await updatedResponse.json()
        setCampaignDiningDeals(updatedData.selections || [])
      }

    } catch (error) {
      console.error('Error updating dining deals:', error)
    } finally {
      setUpdatingDiningDeals(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 32) return 'text-green-600'  // 80% of 40
    if (score >= 26) return 'text-yellow-600' // 65% of 40
    return 'text-red-600'
  }

  const formatStatus = (status: string) => {
    switch (status) {
      case 'draft': return 'Draft'
      case 'in_review': return 'In Review'
      case 'changes_made': return 'Changes Made'
      case 'sent': return 'Sent'
      case 'failed': return 'Failed'
      default: return status
    }
  }

  const updateCampaignStatus = async (action: 'changes_made') => {
    if (!campaign) return

    setUpdatingStatus(true)
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update campaign status')
      }

      const data = await response.json()

      // Update local campaign state
      setCampaign(prev => {
        if (!prev) return prev
        return {
          ...prev,
          status: 'changes_made',
          last_action: action,
          last_action_at: data.campaign.last_action_at,
          last_action_by: data.campaign.last_action_by
        }
      })

      alert(`Campaign marked as "Changes Made" and status updated. Slack notification sent.`)

    } catch (error) {
      alert('Failed to update campaign status: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleDeleteConfirm = () => {
    setDeleteModal(false)
    router.push('/dashboard/campaigns')
  }

  const handleDeleteCancel = () => {
    setDeleteModal(false)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    console.log('🎯 handleDragEnd called with event:', event)
    const { active, over } = event

    if (!over || active.id === over.id || !campaign) {
      console.log('⚠️ Early return from handleDragEnd:', { over: !!over, sameId: active.id === over?.id, campaign: !!campaign })
      return
    }

    console.log('Drag ended:', { activeId: active.id, overId: over.id })

    // Get current active articles sorted by rank
    const activeArticles = campaign.articles
      .filter(article => article.is_active)
      .sort((a, b) => (a.rank || 999) - (b.rank || 999))

    const oldIndex = activeArticles.findIndex(article => article.id === active.id)
    const newIndex = activeArticles.findIndex(article => article.id === over.id)

    console.log('Indexes:', { oldIndex, newIndex, totalActive: activeArticles.length })

    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      // Create new order using arrayMove
      const newOrder = arrayMove(activeArticles, oldIndex, newIndex)

      console.log('New order:', newOrder.map((a, i) => `${i + 1}. ${a.headline} (was rank ${a.rank})`))

      // Update local state immediately for UI responsiveness
      setCampaign(prev => {
        if (!prev) return prev
        const updatedArticles = [...prev.articles]

        // Update ranks for all active articles based on new order
        newOrder.forEach((article, index) => {
          const articleIndex = updatedArticles.findIndex(a => a.id === article.id)
          if (articleIndex !== -1) {
            updatedArticles[articleIndex] = {
              ...updatedArticles[articleIndex],
              rank: index + 1
            }
          }
        })

        return { ...prev, articles: updatedArticles }
      })

      // Send update to server
      try {
        const articleOrders = newOrder.map((article, index) => ({
          articleId: article.id,
          rank: index + 1
        }))

        console.log('Sending rank updates:', articleOrders)

        const response = await fetch(`/api/campaigns/${campaign.id}/articles/reorder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articleOrders })
        })

        if (!response.ok) {
          throw new Error(`Failed to update order: ${response.status}`)
        }

        const responseData = await response.json()
        console.log('Successfully updated article ranks')

        // Check if subject line was auto-regenerated
        if (responseData.subject_line_regenerated && responseData.new_subject_line) {
          console.log(`Subject line auto-updated to: "${responseData.new_subject_line}"`)

          // Update the campaign state with the new subject line
          setCampaign(prev => prev ? {
            ...prev,
            subject_line: responseData.new_subject_line
          } : null)
        }
      } catch (error) {
        console.error('Failed to update article order:', error)
        // Refresh campaign to revert changes
        if (campaign.id) {
          fetchCampaign(campaign.id)
        }
      }
    }
  }

  const formatDate = (dateString: string) => {
    // Parse date as local date to avoid timezone offset issues
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day) // month is 0-indexed
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
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

  if (error || !campaign) {
    return (
      <Layout>
        <div className="text-center py-12">
          <div className="text-red-600 mb-4">
            {error || 'Campaign not found'}
          </div>
          <a href="/dashboard/campaigns" className="text-brand-primary hover:text-blue-700">
            Back to Campaigns
          </a>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        {/* Campaign Header */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Newsletter for {formatDate(campaign.date)}
              </h1>
              <div className="flex items-center space-x-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  campaign.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                  campaign.status === 'in_review' ? 'bg-yellow-100 text-yellow-800' :
                  campaign.status === 'changes_made' ? 'bg-orange-100 text-orange-800' :
                  campaign.status === 'sent' ? 'bg-green-100 text-green-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {formatStatus(campaign.status)}
                </span>
                <span className="text-sm text-gray-500">
                  {campaign.articles.length} articles selected
                </span>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={processRSSFeeds}
                disabled={processing || saving || generatingSubject}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium"
              >
                {processing ? 'Processing...' : 'Process RSS Feeds'}
              </button>
              <button
                onClick={previewNewsletter}
                disabled={saving || generatingSubject || previewLoading}
                className="bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-800 px-4 py-2 rounded text-sm font-medium flex items-center space-x-2"
              >
                {previewLoading && (
                  <svg className="animate-spin h-4 w-4 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <span>{previewLoading ? 'Loading...' : 'Preview Newsletter'}</span>
              </button>
            </div>
          </div>

          {processingStatus && (
            <div className="text-sm text-blue-600 font-medium mt-3 text-center">
              {processingStatus}
            </div>
          )}

          {/* Subject Line Section */}
          <div className="mt-4 p-3 bg-gray-50 rounded">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="text-sm text-gray-600 mb-1">Subject Line:</div>
                {editingSubject ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editSubjectValue}
                      onChange={(e) => setEditSubjectValue(e.target.value)}
                      placeholder="Enter subject line..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        {editSubjectValue.length} characters
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={cancelEditingSubject}
                          disabled={savingSubject}
                          className="px-3 py-1 text-sm text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveSubjectLine}
                          disabled={savingSubject || !editSubjectValue.trim()}
                          className="px-3 py-1 text-sm text-white bg-green-600 border border-green-600 rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          {savingSubject ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {campaign.subject_line ? (
                      <div className="font-medium text-gray-900">{campaign.subject_line}</div>
                    ) : (
                      <div className="text-gray-500 italic">No subject line generated yet</div>
                    )}
                  </>
                )}
              </div>
              {!editingSubject && (
                <div className="ml-4 flex space-x-2">
                  {campaign.subject_line && (
                    <button
                      onClick={startEditingSubject}
                      disabled={generatingSubject || processing || savingSubject}
                      className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white px-3 py-1 rounded text-sm font-medium"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={generateSubjectLine}
                    disabled={generatingSubject || processing || savingSubject}
                    className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-3 py-1 rounded text-sm font-medium"
                  >
                    {generatingSubject ? 'Generating...' : campaign.subject_line ? 'Regenerate' : 'Generate'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Campaign Approval Buttons */}
          <div className="mt-4 flex justify-end space-x-3">
            <button
              onClick={() => updateCampaignStatus('changes_made')}
              disabled={updatingStatus}
              className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center"
            >
              {updatingStatus ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Updating...
                </>
              ) : (
                'Changes Made'
              )}
            </button>
            <button
              onClick={() => setDeleteModal(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium text-sm"
            >
              Delete Campaign
            </button>
          </div>
        </div>

        {/* Articles Section */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">
                The Local Scoop
              </h2>
              <button
                onClick={() => setArticlesExpanded(!articlesExpanded)}
                className="flex items-center space-x-2 text-sm text-brand-primary hover:text-blue-700"
              >
                <span>{articlesExpanded ? 'Minimize' : 'Manage Articles'}</span>
                <svg
                  className={`w-4 h-4 transform transition-transform ${articlesExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-sm text-gray-600">
                Toggle articles on/off for the newsletter. Articles are ranked by AI evaluation.
              </p>
              <div className="text-sm">
                <span className={`font-medium ${campaign.articles.filter(a => a.is_active && !a.skipped).length === 5 ? 'text-green-600' : 'text-yellow-600'}`}>
                  {campaign.articles.filter(a => a.is_active && !a.skipped).length}/5 selected
                </span>
                <span className="text-gray-500 ml-1">for newsletter</span>
              </div>
            </div>
          </div>

          {articlesExpanded && (
            <div className="divide-y divide-gray-200">
              {campaign.articles.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <p className="mb-4">No articles generated yet. Run RSS processing to generate articles.</p>
                <button
                  onClick={processRSSFeeds}
                  disabled={processing}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium"
                >
                  {processing ? 'Processing...' : 'Process RSS Feeds'}
                </button>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={pointerWithin}
                onDragStart={(event) => {
                  console.log('🚀 Drag started:', event.active.id)
                }}
                onDragOver={(event) => {
                  console.log('👆 Drag over:', { active: event.active.id, over: event.over?.id })
                }}
                onDragEnd={handleDragEnd}
              >
                {/* Active articles section - sortable */}
                {(() => {
                  const activeArticles = campaign.articles
                    .filter(article => article.is_active && !article.skipped)
                    .sort((a, b) => (a.rank || 999) - (b.rank || 999))

                  const inactiveArticles = campaign.articles
                    .filter(article => !article.is_active && !article.skipped)
                    .sort((a, b) => (b.rss_post?.post_rating?.[0]?.total_score || 0) - (a.rss_post?.post_rating?.[0]?.total_score || 0))

                  return (
                    <>
                      {activeArticles.length > 0 && (
                        <>
                          <div className="px-6 py-3 bg-blue-50 border-b">
                            <h3 className="text-sm font-medium text-blue-900">
                              Selected Articles (Drag to reorder)
                            </h3>
                          </div>
                          <SortableContext
                            items={activeArticles.map(article => article.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {activeArticles.map((article) => (
                              <SortableArticle
                                key={article.id}
                                article={article}
                                toggleArticle={toggleArticle}
                                skipArticle={skipArticle}
                                saving={saving}
                                getScoreColor={getScoreColor}
                              />
                            ))}
                          </SortableContext>
                        </>
                      )}

                      {inactiveArticles.length > 0 && (
                        <>
                          <div className="px-6 py-3 bg-gray-50 border-b">
                            <h3 className="text-sm font-medium text-gray-700">
                              Available Articles (Click to add)
                            </h3>
                          </div>
                          {inactiveArticles.map((article) => (
                            <RegularArticle
                              key={article.id}
                              article={article}
                              toggleArticle={toggleArticle}
                              skipArticle={skipArticle}
                              saving={saving}
                              getScoreColor={getScoreColor}
                            />
                          ))}
                        </>
                      )}
                    </>
                  )
                })()}
              </DndContext>
            )}
            </div>
          )}
        </div>

        {/* Local Events Section */}
        <div className="bg-white shadow rounded-lg mt-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">
                Local Events
              </h2>
              <button
                onClick={handleEventsExpand}
                className="flex items-center space-x-2 text-sm text-brand-primary hover:text-blue-700"
              >
                <span>{eventsExpanded ? 'Minimize' : 'Manage Events'}</span>
                <svg
                  className={`w-4 h-4 transform transition-transform ${eventsExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {eventsExpanded && (
            <div className="p-6">
              {loadingEvents ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                  <span className="ml-3 text-gray-600">Loading events...</span>
                </div>
              ) : (
                <EventsManager
                  campaign={campaign}
                  availableEvents={availableEvents}
                  campaignEvents={campaignEvents}
                  onUpdateEvents={updateEventSelections}
                  updating={updatingEvents}
                />
              )}
            </div>
          )}

          {!eventsExpanded && campaignEvents.length > 0 && (
            <div className="px-6 pb-4">
              <div className="flex space-x-4">
                {getEventCountsByDate().map((dateInfo) => (
                  <div key={dateInfo.date} className="flex flex-col items-center">
                    <div className="text-xs text-gray-500 mb-1">
                      {dateInfo.dayName} {dateInfo.monthDay}
                    </div>
                    <div className={`text-sm font-semibold ${dateInfo.colorClass}`}>
                      {dateInfo.count}/8
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>


        {/* Dynamic Newsletter Sections */}
        {newsletterSections
          .filter(section => section.is_active && !['The Local Scoop', 'Local Events'].includes(section.name))
          .map(section => (
            <NewsletterSectionComponent
              key={section.id}
              section={section}
              campaign={campaign}
              expanded={sectionExpandedStates[section.id] || false}
              onToggleExpanded={() => {
                setSectionExpandedStates(prev => ({
                  ...prev,
                  [section.id]: !prev[section.id]
                }))
              }}
              weatherData={section.name === 'Local Weather' ? weatherData : null}
              loadingWeather={section.name === 'Local Weather' ? loadingWeather : false}
              onWeatherExpand={section.name === 'Local Weather' ? handleWeatherExpand : undefined}
              availableDiningDeals={section.name === 'Dining Deals' ? availableDiningDeals : undefined}
              campaignDiningDeals={section.name === 'Dining Deals' ? campaignDiningDeals : undefined}
              onDiningDealsExpand={section.name === 'Dining Deals' ? handleDiningDealsExpand : undefined}
              onUpdateDiningDeals={section.name === 'Dining Deals' ? updateDiningDealsSelections : undefined}
              updatingDiningDeals={section.name === 'Dining Deals' ? updatingDiningDeals : false}
            />
          ))}

        {/* Preview Modal */}
        {showPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="text-lg font-medium text-gray-900">
                  Newsletter Preview
                </h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      if (previewHtml) {
                        const blob = new Blob([previewHtml], { type: 'text/html' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `newsletter-${campaign?.date}.html`
                        a.click()
                        URL.revokeObjectURL(url)
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                  >
                    Download HTML
                  </button>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                {previewHtml && (
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full h-full min-h-[600px]"
                    title="Newsletter Preview"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Delete Campaign Modal */}
        {campaign && (
          <DeleteCampaignModal
            campaign={campaign}
            isOpen={deleteModal}
            onClose={handleDeleteCancel}
            onConfirm={handleDeleteConfirm}
          />
        )}
      </div>
    </Layout>
  )
}