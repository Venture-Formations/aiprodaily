'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Container } from '@/components/salient/Container'
import { SubscribeProgressBar } from '@/components/SubscribeProgressBar'

interface OffersContentProps {
  logoUrl: string
  newsletterName: string
}

function generateAfterOffersClickId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const randomPart = Math.random().toString(36).slice(2, 10)
  return `ao_${Date.now()}_${randomPart}`
}

export function OffersContent({ logoUrl, newsletterName }: OffersContentProps) {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const urlClickId = searchParams.get('click_id') || ''
  const [clickId, setClickId] = useState('')

  // Store email in sessionStorage so info page can retrieve it as fallback
  useEffect(() => {
    if (email && email !== '{{email}}' && email.includes('@')) {
      sessionStorage.setItem('subscribe_email', email)
    }

    // Log SparkLoop events from previous page
    const sparkloopEvents = sessionStorage.getItem('sparkloop_events')
    if (sparkloopEvents) {
      console.log('[SparkLoop Events from previous page]:', JSON.parse(sparkloopEvents))
      const subscribed = sessionStorage.getItem('sparkloop_subscribed')
      console.log('[SparkLoop] User subscribed to recommendations:', subscribed === 'true')
    }
  }, [email])

  // Derive click_id from URL, sessionStorage, or generate a new one.
  // Always call setClickId even if sessionStorage fails.
  useEffect(() => {
    let id = urlClickId

    if (!id && typeof window !== 'undefined') {
      try {
        const stored = window.sessionStorage.getItem('afteroffers_click_id')
        if (stored) id = stored
      } catch {
        // sessionStorage unavailable — fall through to generate
      }
    }

    if (!id) {
      id = generateAfterOffersClickId()
    }

    // Persist to sessionStorage (best-effort)
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('afteroffers_click_id', id)
      }
    } catch {
      // Ignore storage errors
    }

    // eslint-disable-next-line no-console
    console.log('[AfterOffers] Using click_id on offers page', id)
    setClickId(id)
  }, [urlClickId])

  // Build the AfterOffers URL with email and click_id
  const params = new URLSearchParams()
  if (email) {
    params.set('email', email)
  }
  if (clickId) {
    params.set('click_id', clickId)
  }
  const afterOffersUrl = `https://offers.afteroffers.com/show_offers/994-2MMat6y-1?${params.toString()}`

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

          <SubscribeProgressBar step={2} />

          {/* Headline */}
          <h1 className="font-display text-xl tracking-tight text-slate-900 sm:text-2xl mb-2">
            Thank you for visiting AI Accounting Daily
          </h1>

          {/* AfterOffers iframe — only render once clickId is ready */}
          {clickId && (
            <div className="rounded-xl overflow-hidden shadow-lg border border-slate-200">
              <iframe
                src={afterOffersUrl}
                height="600"
                width="100%"
                frameBorder="0"
                sandbox="allow-forms allow-top-navigation allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                className="w-full"
              />
            </div>
          )}

        </div>
      </Container>
    </section>
  )
}
