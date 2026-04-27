'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Container } from '@/components/salient/Container'
import { SubscribeProgressBar } from '@/components/SubscribeProgressBar'

interface OffersContentProps {
  logoUrl: string
  newsletterName: string
  afteroffersFormId?: string
}

function generateAfterOffersClickId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const randomPart = Math.random().toString(36).slice(2, 10)
  return `ao_${Date.now()}_${randomPart}`
}

export function OffersContent({ logoUrl, newsletterName, afteroffersFormId }: OffersContentProps) {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const urlClickId = searchParams.get('click_id') || ''
  const [clickId, setClickId] = useState('')
  // Default tall enough that AfterOffers content rarely clips even if the
  // iframe never reports its real height via postMessage. The listener below
  // will shrink/expand this once a real height arrives.
  const [iframeHeight, setIframeHeight] = useState(1800)

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

  // Listen for height messages from the AfterOffers iframe so the page scrolls
  // instead of producing a scrollbar inside the iframe.
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.origin.endsWith('afteroffers.com')) return

      const data = event.data
      let height: number | undefined

      if (typeof data === 'number') {
        height = data
      } else if (typeof data === 'string') {
        const match = data.match(/(\d+(?:\.\d+)?)/)
        if (match) height = Number(match[1])
      } else if (data && typeof data === 'object') {
        const candidate = data.height ?? data.iframeHeight ?? data.contentHeight ?? data.scrollHeight
        if (typeof candidate === 'number') height = candidate
        else if (typeof candidate === 'string' && !Number.isNaN(Number(candidate))) height = Number(candidate)
      }

      if (height && Number.isFinite(height) && height > 0) {
        setIframeHeight(Math.ceil(height))
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Build the AfterOffers URL with email and click_id
  const params = new URLSearchParams()
  if (email) {
    params.set('email', email)
  }
  if (clickId) {
    params.set('click_id', clickId)
  }
  const formId = afteroffersFormId || '994-2MMat6y-1'
  const afterOffersUrl = `https://offers.afteroffers.com/show_offers/${formId}?${params.toString()}`

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
            Thank you for visiting {newsletterName}
          </h1>

          {/* AfterOffers iframe — only render once clickId is ready */}
          {clickId && (
            <div className="rounded-xl overflow-hidden shadow-lg border border-slate-200">
              <iframe
                src={afterOffersUrl}
                width="100%"
                frameBorder="0"
                scrolling="no"
                sandbox="allow-forms allow-top-navigation allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                className="w-full block"
                style={{ height: `${iframeHeight}px` }}
              />
            </div>
          )}

        </div>
      </Container>
    </section>
  )
}
