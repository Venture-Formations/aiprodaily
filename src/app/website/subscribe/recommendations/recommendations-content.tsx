'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Container } from '@/components/salient/Container'
import { SubscribeProgressBar } from '@/components/SubscribeProgressBar'
import type {
  SparkLoopRecommendation,
  SparkLoopPopupEventType,
} from '@/types/sparkloop'

interface RecommendationsContentProps {
  logoUrl: string
  newsletterName: string
}

const SOURCE = 'recs_page' as const

/**
 * Track an event to the server with recs_page source
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
        source: SOURCE,
      }),
    })
  } catch (e) {
    console.warn('[SparkLoop RecsPage] Tracking failed:', e)
  }
}

export function RecommendationsContent({ logoUrl, newsletterName }: RecommendationsContentProps) {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Get email from URL param or sessionStorage fallback
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

          // Track page opened with all shown ref_codes (for impressions)
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

  // Toggle recommendation selection
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

  // Navigate to info page
  const goToInfo = useCallback(() => {
    const params = email ? `?email=${encodeURIComponent(email)}` : ''
    router.push(`/subscribe/info${params}`)
  }, [email, router])

  // Handle skip / maybe later
  const handleSkip = useCallback(async () => {
    if (email && email.includes('@')) {
      await trackEvent('popup_skipped', email, {
        recommendationCount: recommendations.length,
        selectedCount: selectedRefCodes.size,
      })
    }
    goToInfo()
  }, [email, recommendations.length, selectedRefCodes.size, goToInfo])

  // Handle subscribe
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
        // Track success
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
        // Brief delay so user sees success, then redirect
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

  // Missing email state
  if (!email || !email.includes('@')) {
    return (
      <section className="pt-8 sm:pt-12 pb-6 sm:pb-16">
        <Container>
          <div className="mx-auto max-w-[600px] text-center">
            {/* Logo */}
            <div className="flex justify-center mb-4">
              <img
                src={logoUrl}
                alt={newsletterName}
                className="h-20 sm:h-28 w-auto object-contain"
              />
            </div>

            <SubscribeProgressBar step={3} />

            <h1 className="font-display text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
              Something went wrong
            </h1>
            <p className="mt-4 text-base text-slate-600">
              We couldn&apos;t find your email address. Please subscribe first.
            </p>
            <a
              href="/subscribe"
              className="mt-6 inline-block rounded-full bg-blue-600 px-8 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              Go to Subscribe
            </a>
          </div>
        </Container>
      </section>
    )
  }

  return (
    <section className="pt-8 sm:pt-12 pb-6 sm:pb-16">
      <Container>
        <div className="mx-auto max-w-[600px] text-center">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <img
              src={logoUrl}
              alt={newsletterName}
              className="h-20 sm:h-28 w-auto object-contain"
            />
          </div>

          <SubscribeProgressBar step={3} />

          {/* Headline */}
          <h1 className="font-display text-xl tracking-tight text-slate-900 sm:text-2xl mb-2">
            Thank you for visiting AI Accounting Daily
          </h1>

          {/* Subheadline */}
          <p className="text-base text-slate-600 mb-6">
            Check out these recommended resources while we prepare your subscription.
          </p>

          {/* Content */}
          <div className="mt-8 sm:mt-10">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-blue-600" />
              </div>
            ) : submitted ? (
              <div className="py-12">
                <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-slate-900">You&apos;re all set!</p>
                <p className="mt-1 text-sm text-slate-500">Redirecting...</p>
              </div>
            ) : recommendations.length === 0 ? (
              <div className="py-12">
                <p className="text-slate-600 mb-6">No additional recommendations available right now.</p>
                <button
                  onClick={goToInfo}
                  className="rounded-full bg-blue-600 px-8 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
                >
                  Continue
                </button>
              </div>
            ) : (
              <>
                {/* Offer Cards */}
                <div className="flex flex-col gap-3 text-left">
                  {recommendations.map((rec) => (
                    <div
                      key={rec.ref_code}
                      onClick={() => toggleSelection(rec.ref_code)}
                      className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all ${
                        selectedRefCodes.has(rec.ref_code)
                          ? 'border-2 border-blue-500 bg-blue-50/30'
                          : 'border border-slate-200 shadow-sm hover:border-slate-300'
                      }`}
                    >
                      {/* Checkbox */}
                      <div className="flex-shrink-0">
                        <div
                          className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                            selectedRefCodes.has(rec.ref_code)
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-2 border-slate-300 bg-white'
                          }`}
                        >
                          {selectedRefCodes.has(rec.ref_code) && (
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>

                      {/* Logo */}
                      <div className="flex-shrink-0">
                        {rec.publication_logo ? (
                          <img
                            src={rec.publication_logo}
                            alt={rec.publication_name}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                            <span className="text-slate-500 text-sm font-semibold">
                              {rec.publication_name.charAt(0)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-900 text-sm">
                          {rec.publication_name}
                        </h4>
                        {rec.description && (
                          <p className="text-sm text-slate-500 leading-snug mt-0.5">
                            {rec.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Error message */}
                {error && (
                  <p className="mt-4 text-sm text-red-500">{error}</p>
                )}

                {/* CTA Button */}
                <button
                  onClick={handleSubscribe}
                  disabled={isSubmitting}
                  className="mt-6 w-full rounded-full bg-blue-600 py-3.5 px-4 text-base font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Subscribing...
                    </span>
                  ) : selectedRefCodes.size > 0 ? (
                    `Subscribe to ${selectedRefCodes.size} publication${selectedRefCodes.size > 1 ? 's' : ''}`
                  ) : (
                    'Continue'
                  )}
                </button>

                {/* Maybe later link */}
                <button
                  onClick={handleSkip}
                  disabled={isSubmitting}
                  className="mt-3 text-sm text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
                >
                  Maybe later
                </button>
              </>
            )}
          </div>
        </div>
      </Container>
    </section>
  )
}
