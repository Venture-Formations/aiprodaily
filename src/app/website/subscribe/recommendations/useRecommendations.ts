'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type {
  SparkLoopRecommendation,
  SparkLoopPopupEventType,
} from '@/types/sparkloop'

const SOURCE = 'recs_page' as const

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
        source: SOURCE,
      }),
    })
  } catch (e) {
    console.warn('[SparkLoop RecsPage] Tracking failed:', e)
  }
}

export function useRecommendations() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const urlEmail = searchParams.get('email') || ''
  const [email, setEmail] = useState(urlEmail)

  const [recommendations, setRecommendations] = useState<SparkLoopRecommendation[]>([])
  const [selectedRefCodes, setSelectedRefCodes] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  // Resolve email from sessionStorage if not in URL
  useEffect(() => {
    if (!urlEmail || urlEmail === '{{email}}' || !urlEmail.includes('@')) {
      const stored = sessionStorage.getItem('subscribe_email')
      if (stored && stored.includes('@')) {
        setEmail(stored)
      }
    } else {
      sessionStorage.setItem('subscribe_email', urlEmail)
    }
  }, [urlEmail])

  // Fetch recommendations (offset=5 to get positions 6-10)
  useEffect(() => {
    if (!email || !email.includes('@')) return

    const fetchRecs = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/sparkloop/recommendations?offset=5&limit=3')
        const data = await response.json()

        if (data.recommendations && data.recommendations.length > 0) {
          setRecommendations(data.recommendations)
          setSelectedRefCodes(new Set(data.preSelectedRefCodes || []))

          await trackEvent('popup_opened', email, {
            refCodes: data.recommendations.map((r: SparkLoopRecommendation) => r.ref_code),
            recommendationCount: data.recommendations.length,
            selectedCount: data.preSelectedRefCodes?.length || 0,
          })
        }
      } catch (err) {
        console.error('[SparkLoop RecsPage] Failed to fetch recommendations:', err)
        setError('Unable to load recommendations.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchRecs()
  }, [email])

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

  const goToInfo = useCallback(() => {
    const params = email ? `?email=${encodeURIComponent(email)}` : ''
    router.push(`/subscribe/info${params}`)
  }, [email, router])

  const handleSkip = useCallback(async () => {
    if (email && email.includes('@')) {
      await trackEvent('popup_skipped', email, {
        recommendationCount: recommendations.length,
        selectedCount: selectedRefCodes.size,
      })
    }
    goToInfo()
  }, [email, recommendations.length, selectedRefCodes.size, goToInfo])

  const handleSubscribe = useCallback(async () => {
    if (selectedRefCodes.size === 0) {
      handleSkip()
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const refCodes = Array.from(selectedRefCodes)

      const response = await fetch('/api/sparkloop/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          refCodes,
          source: SOURCE,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const allShownRefCodes = recommendations.map(r => r.ref_code)
        const notSelectedRefCodes = allShownRefCodes.filter(code => !selectedRefCodes.has(code))

        await trackEvent('subscriptions_success', email, {
          refCodes,
          selectedCount: refCodes.length,
          recommendationCount: recommendations.length,
        })

        if (notSelectedRefCodes.length > 0) {
          await trackEvent('recommendations_not_selected', email, {
            refCodes: notSelectedRefCodes,
            selectedCount: notSelectedRefCodes.length,
          })
        }

        setSubmitted(true)
        setTimeout(() => goToInfo(), 1200)
      } else {
        throw new Error(data.error || 'Subscription failed')
      }
    } catch (err) {
      console.error('[SparkLoop RecsPage] Subscribe failed:', err)
      await trackEvent('subscriptions_failed', email, {
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      })
      setError('Failed to subscribe. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedRefCodes, email, recommendations, goToInfo, handleSkip])

  return {
    email,
    recommendations,
    selectedRefCodes,
    isLoading,
    isSubmitting,
    error,
    submitted,
    toggleSelection,
    goToInfo,
    handleSkip,
    handleSubscribe,
  }
}
