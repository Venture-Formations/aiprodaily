'use client'

import { useState, useEffect, useCallback } from 'react'
import type {
  SparkLoopRecommendation,
  SparkLoopModalProps,
  SparkLoopPopupEventType,
} from '@/types/sparkloop'

/**
 * Track an event to the server
 */
async function trackEvent(
  eventType: SparkLoopPopupEventType,
  email: string,
  data?: {
    refCodes?: string[]
    recommendationCount?: number
    selectedCount?: number
    errorMessage?: string
  }
) {
  try {
    await fetch('/api/sparkloop/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: eventType,
        subscriber_email: email,
        ref_codes: data?.refCodes,
        recommendation_count: data?.recommendationCount,
        selected_count: data?.selectedCount,
        error_message: data?.errorMessage,
        timestamp: new Date().toISOString(),
      }),
    })
  } catch (e) {
    // Don't let tracking errors affect UX
    console.warn('[SparkLoop] Tracking failed:', e)
  }
}

/**
 * Individual recommendation card component
 */
function RecommendationCard({
  recommendation,
  isSelected,
  onToggle,
}: {
  recommendation: SparkLoopRecommendation
  isSelected: boolean
  onToggle: (refCode: string) => void
}) {
  return (
    <div
      className="flex items-center gap-4 py-4 px-2 cursor-pointer hover:bg-gray-50 transition-colors"
      onClick={() => onToggle(recommendation.ref_code)}
    >
      {/* Logo */}
      <div className="flex-shrink-0">
        {recommendation.publication_logo ? (
          <img
            src={recommendation.publication_logo}
            alt={recommendation.publication_name}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-500 text-lg font-semibold">
              {recommendation.publication_name.charAt(0)}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-gray-900 text-sm">
          {recommendation.publication_name}
        </h4>
        {recommendation.description && (
          <p className="text-gray-500 text-sm leading-snug mt-0.5">
            {recommendation.description}
          </p>
        )}
      </div>

      {/* Checkbox */}
      <div className="flex-shrink-0">
        <div
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
            isSelected
              ? 'bg-[#E91E8C] border-[#E91E8C]'
              : 'border-gray-300 bg-white'
          }`}
        >
          {isSelected && (
            <svg
              className="w-3.5 h-3.5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * SparkLoop Upscribe Modal
 *
 * Custom-branded modal that replaces SparkLoop's embedded popup.
 * Fetches recommendations via API and submits selections server-side.
 */
export function SparkLoopModal({
  isOpen,
  onClose,
  subscriberEmail,
  onSubscribeComplete,
  publicationName = 'AI Accounting Daily',
}: SparkLoopModalProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recommendations, setRecommendations] = useState<SparkLoopRecommendation[]>([])
  const [selectedRefCodes, setSelectedRefCodes] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch recommendations when modal opens
  useEffect(() => {
    if (!isOpen) return

    const fetchRecommendations = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/sparkloop/recommendations')
        const data = await response.json()

        if (data.recommendations && data.recommendations.length > 0) {
          setRecommendations(data.recommendations)
          // Pre-select top recommendations
          setSelectedRefCodes(new Set(data.preSelectedRefCodes || []))

          // Track popup opened with all shown ref_codes (for impressions)
          await trackEvent('popup_opened', subscriberEmail, {
            refCodes: data.recommendations.map((r: SparkLoopRecommendation) => r.ref_code),
            recommendationCount: data.recommendations.length,
            selectedCount: data.preSelectedRefCodes?.length || 0,
          })
        } else {
          // No recommendations available, close modal and continue
          console.log('[SparkLoop] No recommendations available')
          onClose()
          onSubscribeComplete()
        }
      } catch (err) {
        console.error('[SparkLoop] Failed to fetch recommendations:', err)
        setError('Unable to load recommendations. You can skip this step.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchRecommendations()
  }, [isOpen, subscriberEmail, onClose, onSubscribeComplete])

  // Toggle recommendation selection (no per-click tracking - we track final state at submit)
  const toggleSelection = useCallback((refCode: string) => {
    setSelectedRefCodes((prev) => {
      const next = new Set(prev)
      if (next.has(refCode)) {
        next.delete(refCode)
      } else {
        next.add(refCode)
      }
      return next
    })
  }, [])

  // Handle skip/close
  const handleSkip = useCallback(async () => {
    await trackEvent('popup_skipped', subscriberEmail, {
      recommendationCount: recommendations.length,
      selectedCount: selectedRefCodes.size,
    })
    onClose()
    onSubscribeComplete()
  }, [subscriberEmail, recommendations.length, selectedRefCodes.size, onClose, onSubscribeComplete])

  // Handle subscribe
  const handleSubscribe = useCallback(async () => {
    if (selectedRefCodes.size === 0) {
      handleSkip()
      return
    }

    setIsSubmitting(true)

    try {
      const refCodes = Array.from(selectedRefCodes)

      const response = await fetch('/api/sparkloop/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: subscriberEmail,
          refCodes,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Track which were selected vs not selected at submit time
        const allShownRefCodes = recommendations.map(r => r.ref_code)
        const notSelectedRefCodes = allShownRefCodes.filter(code => !selectedRefCodes.has(code))

        await trackEvent('subscriptions_success', subscriberEmail, {
          refCodes, // selected ones
          selectedCount: refCodes.length,
          recommendationCount: recommendations.length,
        })

        // Also track which ones were NOT selected (shown but skipped)
        if (notSelectedRefCodes.length > 0) {
          await trackEvent('recommendations_not_selected', subscriberEmail, {
            refCodes: notSelectedRefCodes,
            selectedCount: notSelectedRefCodes.length,
          })
        }

        onClose()
        onSubscribeComplete()
      } else {
        throw new Error(data.error || 'Subscription failed')
      }
    } catch (err) {
      console.error('[SparkLoop] Subscribe failed:', err)
      await trackEvent('subscriptions_failed', subscriberEmail, {
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      })
      setError('Failed to subscribe. Please try again or skip.')
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedRefCodes, subscriberEmail, onClose, onSubscribeComplete, handleSkip])

  // Don't render if not open
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleSkip}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[716px] max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
          aria-label="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="px-6 pt-8 pb-4 text-center">
          <h2 className="text-2xl font-bold text-gray-900">You're subscribed!</h2>
          <p className="mt-2 text-gray-500">
            {publicationName} recommends these newsletters:
          </p>
        </div>

        {/* Content */}
        <div className="px-6 overflow-y-auto max-h-[50vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-[#E91E8C]" />
            </div>
          ) : error && recommendations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">{error}</p>
              <button
                onClick={handleSkip}
                className="mt-4 text-[#E91E8C] hover:underline"
              >
                Continue without selecting
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recommendations.map((rec) => (
                <RecommendationCard
                  key={rec.ref_code}
                  recommendation={rec}
                  isSelected={selectedRefCodes.has(rec.ref_code)}
                  onToggle={toggleSelection}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!isLoading && recommendations.length > 0 && (
          <div className="px-6 py-6 space-y-3">
            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}

            <button
              onClick={handleSubscribe}
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-[#E91E8C] text-white font-semibold rounded-full hover:bg-[#d11a7d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Subscribing...
                </span>
              ) : selectedRefCodes.size > 0 ? (
                `Subscribe to ${selectedRefCodes.size} publication${selectedRefCodes.size > 1 ? 's' : ''}`
              ) : (
                'Subscribe to these publications'
              )}
            </button>

            <button
              onClick={handleSkip}
              disabled={isSubmitting}
              className="w-full py-2 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors disabled:opacity-50"
            >
              Maybe later
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
