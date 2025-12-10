'use client'

import { useState } from "react"

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

export function SubscribeForm() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

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

        // Redirect to personalization form with email parameter
        window.location.href = `/subscribe/info?email=${encodeURIComponent(email)}`
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
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex justify-center">
        <div className="relative w-full max-w-lg">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
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

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {!error && (
        <p className="text-lg font-bold text-slate-600 tracking-wide">
          Free forever. Unsubscribe anytime.
        </p>
      )}
    </div>
  )
}
