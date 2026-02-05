'use client'

import { useState, useEffect } from 'react'
import { Container } from '@/components/salient/Container'

// Declare fbq for TypeScript
declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

// Helper function to get Facebook Pixel cookies
function getFacebookPixelData() {
  if (typeof window === 'undefined') return null

  // Get fbp (Facebook Browser ID) from cookie
  const fbp = document.cookie
    .split('; ')
    .find(row => row.startsWith('_fbp='))
    ?.split('=')[1] || null

  // Get fbc (Facebook Click ID) from cookie or URL parameter
  let fbc = document.cookie
    .split('; ')
    .find(row => row.startsWith('_fbc='))
    ?.split('=')[1] || null

  // If fbc not in cookie, check URL for fbclid parameter
  if (!fbc) {
    const fbclid = new URLSearchParams(window.location.search).get('fbclid')
    if (fbclid) {
      const timestamp = Date.now()
      fbc = `fb.1.${timestamp}.${fbclid}`
    }
  }

  // Get event_source_url (current page URL)
  const eventSourceUrl = window.location.href

  // Generate timestamp (current time in milliseconds)
  const timestamp = Date.now().toString()

  return {
    fbp,
    fbc,
    timestamp,
    event_source_url: eventSourceUrl
  }
}

export function Hero() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Load SparkLoop script on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!document.getElementById('sparkloop-script')) {
      const script = document.createElement('script')
      script.id = 'sparkloop-script'
      script.src = 'https://js.sparkloop.app/embed.js?publication_id=pub_6b958dc16ac6'
      script.async = true
      script.setAttribute('data-sparkloop', '')
      document.body.appendChild(script)
    }
  }, [])

  // Wait for SparkLoop popup to close then redirect
  const waitForSparkLoopPopupClose = (emailToRedirect: string) => {
    let popupDetected = false
    let checkCount = 0
    const maxWaitTime = 180 // 3 minutes max

    const checkInterval = setInterval(() => {
      checkCount++

      // Look for SparkLoop popup elements
      const sparkloopIframe = document.querySelector('iframe[src*="sparkloop"]') ||
                              document.querySelector('iframe[src*="upscribe"]')

      // Look for fixed/absolute positioned overlays
      const overlayElements = document.querySelectorAll('body > div')
      let hasPopupOverlay = false

      overlayElements.forEach((el) => {
        const style = window.getComputedStyle(el)
        const isOverlay = style.position === 'fixed' ||
                         (style.position === 'absolute' && style.zIndex && parseInt(style.zIndex) > 1000)
        if (isOverlay && !el.id?.includes('sparkloop-script')) {
          hasPopupOverlay = true
        }
      })

      const popupExists = sparkloopIframe || hasPopupOverlay

      if (popupExists && !popupDetected) {
        popupDetected = true
        console.log('[SparkLoop] Popup detected!')
      }

      // If popup was detected and is now gone, redirect
      if (popupDetected && !hasPopupOverlay && !sparkloopIframe) {
        setTimeout(() => {
          const stillHasOverlay = Array.from(document.querySelectorAll('body > div')).some((el) => {
            const style = window.getComputedStyle(el)
            return style.position === 'fixed' ||
                   (style.position === 'absolute' && style.zIndex && parseInt(style.zIndex) > 1000)
          })

          if (!stillHasOverlay) {
            console.log('[SparkLoop] Popup closed, redirecting...')
            clearInterval(checkInterval)
            window.location.href = `/subscribe/info?email=${encodeURIComponent(emailToRedirect)}`
          }
        }, 500)
      }

      // If no popup detected after 10 seconds, redirect anyway
      if (!popupDetected && checkCount >= 10) {
        console.log('[SparkLoop] No popup detected after 10s, redirecting...')
        clearInterval(checkInterval)
        window.location.href = `/subscribe/info?email=${encodeURIComponent(emailToRedirect)}`
        return
      }

      // Timeout after max wait time
      if (checkCount >= maxWaitTime) {
        clearInterval(checkInterval)
        window.location.href = `/subscribe/info?email=${encodeURIComponent(emailToRedirect)}`
      }
    }, 1000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      // Get Facebook Pixel data at submit time
      const pixelData = getFacebookPixelData()

      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          facebook_pixel: pixelData
        })
      })

      const data = await response.json()

      if (response.ok) {
        // Track Lead event in Facebook Pixel
        if (window.fbq) {
          window.fbq('track', 'Lead')
        }

        // SparkLoop will detect the form submission and show popup
        // Wait for popup to close before redirecting
        waitForSparkLoopPopupClose(email)
      } else {
        setError(data.error || 'Subscription failed. Please try again.')
        setIsSubmitting(false)
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <section className="relative overflow-hidden">
      {/* Decorative gradient blur blotch */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-gradient-to-r from-blue-100 via-slate-50 to-blue-100 rounded-full blur-3xl opacity-60 -z-10"></div>

      <Container className="relative pt-10 pb-10 text-center lg:pt-16">
        {/* Social proof badge */}
        <div className="inline-flex items-center px-5 py-2.5 bg-slate-900 rounded-full mb-8 shadow-sm">
          <span className="text-sm font-semibold text-white">Join 10,000+ accounting professionals</span>
        </div>

        <h1 className="mx-auto max-w-4xl font-display text-4xl font-medium tracking-tight text-slate-900 sm:text-6xl">
          Stay Ahead of{' '}
          <span className="relative whitespace-nowrap">
            <svg
              aria-hidden="true"
              viewBox="0 0 418 42"
              className="absolute top-2/3 left-0 h-[0.58em] w-full fill-cyan-300/70"
              preserveAspectRatio="none"
            >
              <path d="M203.371.916c-26.013-2.078-76.686 1.963-124.73 9.946L67.3 12.749C35.421 18.062 18.2 21.766 6.004 25.934 1.244 27.561.828 27.778.874 28.61c.07 1.214.828 1.121 9.595-1.176 9.072-2.377 17.15-3.92 39.246-7.496C123.565 7.986 157.869 4.492 195.942 5.046c7.461.108 19.25 1.696 19.17 2.582-.107 1.183-7.874 4.31-25.75 10.366-21.992 7.45-35.43 12.534-36.701 13.884-2.173 2.308-.202 4.407 4.442 4.734 2.654.187 3.263.157 15.593-.78 35.401-2.686 57.944-3.488 88.365-3.143 46.327.526 75.721 2.23 130.788 7.584 19.787 1.924 20.814 1.98 24.557 1.332l.066-.011c1.201-.203 1.53-1.825.399-2.335-2.911-1.31-4.893-1.604-22.048-3.261-57.509-5.556-87.871-7.36-132.059-7.842-23.239-.254-33.617-.116-50.627.674-11.629.54-42.371 2.494-46.696 2.967-2.359.259 8.133-3.625 26.504-9.81 23.239-7.825 27.934-10.149 28.304-14.005.417-4.348-3.529-6-16.878-7.066Z" />
            </svg>
            <span className="relative bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">AI Trends</span>
          </span>{' '}
          in Accounting and Finance
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg tracking-tight text-slate-700">
          Daily insights, tools, and strategies to help accountants and finance
          professionals leverage AI for better outcomes.
        </p>

        {/* Subscribe Bar - Email input with button inside */}
        <form onSubmit={handleSubmit} className="mt-8 flex justify-center">
          <div className="relative w-full max-w-lg">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full rounded-full border-0 bg-white px-5 py-4 pr-36 text-slate-900 shadow-lg ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
            >
              {isSubmitting ? 'Loading...' : 'Subscribe'}
            </button>
          </div>
        </form>

        {/* Error message or Trust text */}
        {error ? (
          <p className="mt-4 text-sm text-red-500">{error}</p>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            Free forever. Unsubscribe anytime. No spam, ever.
          </p>
        )}
      </Container>
    </section>
  )
}
