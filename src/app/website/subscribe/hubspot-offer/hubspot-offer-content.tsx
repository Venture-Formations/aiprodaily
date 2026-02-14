'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { Container } from '@/components/salient/Container'
import { SubscribeProgressBar } from '@/components/SubscribeProgressBar'

const OFFER_ID = 'offer_recommendation_cfb40ae9d10d'
const ACTION_REDIRECT_BASE = 'https://dash.sparkloop.app/offer_recommendations/offer_recommendation_cfb40ae9d10d/action_click_redirect'

interface HubspotOfferContentProps {
  logoUrl: string
  newsletterName: string
}

export function HubspotOfferContent({ logoUrl, newsletterName }: HubspotOfferContentProps) {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const impressionTracked = useRef(false)

  // Store email in sessionStorage
  useEffect(() => {
    if (email && email !== '{{email}}' && email.includes('@')) {
      sessionStorage.setItem('subscribe_email', email)
    }
  }, [email])

  // Track impression on mount
  useEffect(() => {
    if (impressionTracked.current) return
    impressionTracked.current = true

    fetch('/api/sparkloop/offer-track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'impression',
        email: email || undefined,
        offer_id: OFFER_ID,
      }),
    }).catch(() => {})
  }, [email])

  function handleClaim() {
    // Track claim event
    fetch('/api/sparkloop/offer-track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'claim',
        email: email || undefined,
        offer_id: OFFER_ID,
      }),
    }).catch(() => {})

    // Generate a session UUID so SparkLoop uses it as the submission ID
    // in the HubSpot redirect URL (plain UUID format that HubSpot expects).
    // Without this, action_click_redirect falls back to the internal
    // offer_submission_* format which HubSpot can't use for conversion tracking.
    const sessionUuid = crypto.randomUUID()
    const trackingUrl = `${ACTION_REDIRECT_BASE}?session_uuid=${sessionUuid}`

    // Open SparkLoop tracking URL in new tab
    window.open(trackingUrl, '_blank')

    // Redirect current page to offers
    window.location.href = `/subscribe/offers?email=${encodeURIComponent(email)}`
  }

  function handleSkip() {
    window.location.href = `/subscribe/offers?email=${encodeURIComponent(email)}`
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

          <SubscribeProgressBar step={1} />

          {/* Offer Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            {/* Offer Image with Badge */}
            <div className="relative">
              <img
                src="/images/advertisements/ad-1770664681288.jpg"
                alt="100+ ChatGPT Prompts to Revolutionize Your Day"
                className="w-full object-cover"
              />
              <span className="absolute top-3 left-3 bg-teal-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                Free Download
              </span>
            </div>

            {/* Content */}
            <div className="p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-3">
                100+ ChatGPT Prompts to Revolutionize Your Day
              </h2>
              <p className="text-slate-600 text-sm sm:text-base mb-6 leading-relaxed">
                Discover how you can leverage ChatGPT to boost efficiency, streamline tasks,
                and stay ahead in your industry. Supercharge your productivity with
                HubSpot&apos;s comprehensive guide.
              </p>

              {/* Claim Button */}
              <button
                onClick={handleClaim}
                className="w-full bg-[#E91E8C] hover:bg-[#d4187f] text-white font-semibold py-3 px-6 rounded-lg transition-colors text-base"
              >
                Claim Offer
              </button>

              {/* Skip / finalize link */}
              <button
                onClick={handleSkip}
                className="text-slate-400 hover:text-slate-600 text-sm mt-3 transition-colors"
              >
                Finalize your subscription
              </button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
