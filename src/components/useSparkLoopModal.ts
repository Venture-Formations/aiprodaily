'use client'

import { useState, useEffect, useCallback } from 'react'
import type {
  SparkLoopRecommendation,
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

interface UseSparkLoopModalParams {
  isOpen: boolean
  subscriberEmail: string
  publicationId?: string
  onClose: () => void
  onSubscribeComplete: () => void
}

export function useSparkLoopModal({
  isOpen,
  subscriberEmail,
  publicationId,
  onClose,
  onSubscribeComplete,
}: UseSparkLoopModalParams) {
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
        const recUrl = publicationId
          ? `/api/sparkloop/recommendations?publicationId=${encodeURIComponent(publicationId)}`
          : '/api/sparkloop/recommendations'
        const response = await fetch(recUrl)
        const data = await response.json()

        if (data.recommendations && data.recommendations.length > 0) {
          setRecommendations(data.recommendations)
          setSelectedRefCodes(new Set(data.preSelectedRefCodes || []))

          await trackEvent('popup_opened', subscriberEmail, {
            refCodes: data.recommendations.map((r: SparkLoopRecommendation) => r.ref_code),
            recommendationCount: data.recommendations.length,
            selectedCount: data.preSelectedRefCodes?.length || 0,
          })
        } else {
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

  const handleSkip = useCallback(async () => {
    await trackEvent('popup_skipped', subscriberEmail, {
      recommendationCount: recommendations.length,
      selectedCount: selectedRefCodes.size,
    })
    onClose()
    onSubscribeComplete()
  }, [subscriberEmail, recommendations.length, selectedRefCodes.size, onClose, onSubscribeComplete])

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
          publicationId,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const allShownRefCodes = recommendations.map(r => r.ref_code)
        const notSelectedRefCodes = allShownRefCodes.filter(code => !selectedRefCodes.has(code))

        await trackEvent('subscriptions_success', subscriberEmail, {
          refCodes,
          selectedCount: refCodes.length,
          recommendationCount: recommendations.length,
        })

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

  return {
    isLoading,
    error,
    recommendations,
    selectedRefCodes,
    isSubmitting,
    toggleSelection,
    handleSkip,
    handleSubscribe,
  }
}
