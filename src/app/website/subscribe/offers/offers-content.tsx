'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { Container } from '@/components/salient/Container'

interface OffersContentProps {
  logoUrl: string
  newsletterName: string
}

export function OffersContent({ logoUrl, newsletterName }: OffersContentProps) {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''

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

  // Listen for messages from AfterOffers iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Log all messages to see what AfterOffers sends
      if (event.origin.includes('afteroffers')) {
        console.log('[AfterOffers Event]', event.data)
      }
    }

    window.addEventListener('message', handleMessage)

    // Track page visibility changes (user switching tabs, etc.)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('[AfterOffers] User left offers page')
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Track when user is about to leave the page
    const handleBeforeUnload = () => {
      console.log('[AfterOffers] User navigating away from offers page')
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('message', handleMessage)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  // Build the AfterOffers URL with the email
  const afterOffersUrl = `https://offers.afteroffers.com/show_offers/994-2MMat6y-1?email=${encodeURIComponent(email)}`

  return (
    <section className="pt-8 sm:pt-12 pb-6 sm:pb-16">
      <Container>
        <div className="mx-auto max-w-4xl text-center">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img
              src={logoUrl}
              alt={newsletterName}
              className="h-20 sm:h-28 w-auto object-contain"
            />
          </div>

          {/* Headline */}
          <h1 className="font-display text-xl tracking-tight text-slate-900 sm:text-2xl mb-2">
            More Newsletters You&apos;ll Love
            <br />
            <span className="text-slate-900">Curated Just for You</span>
          </h1>

          <p className="text-base text-slate-600 mb-6">
            Check out these recommended resources while we prepare your subscription.
          </p>

          {/* AfterOffers iframe */}
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

        </div>
      </Container>
    </section>
  )
}
