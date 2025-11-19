'use client'

import { Button } from "@/components/website/ui/button"
import { Input } from "@/components/website/ui/input"
import { useState, useEffect } from "react"

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

export default function SubscribePage() {
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
          window.fbq('track', 'Lead', {
            content_name: 'Newsletter Subscription',
            content_category: 'Email Signup'
          })
        }

        // Redirect to personalization form with email parameter
        window.location.href = `https://lunar-beneficial-spruce.heyflow.site/ai-accounting-daily-personalization-?email=${encodeURIComponent(email)}`
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
    <main className="min-h-screen bg-white flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full">
        <div className="text-center space-y-8">
          {/* Logo */}
          <div className="flex justify-center">
            <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-transparent bg-gradient-to-br from-purple-500 via-cyan-500 to-teal-500 p-1">
              <div className="w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center">
                <img
                  src="/logo.png"
                  alt="AI Accounting Daily"
                  className="w-[85%] h-[85%] object-contain"
                />
              </div>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
            Master AI Tools, Prompts & News
            <br />
            in Just 3 Mins a Day
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Join 10,000+ accounting professionals staying current<br />
            as AI reshapes bookkeeping, tax, and advisory work.
          </p>

          {/* Email signup form */}
          <div className="max-w-xl mx-auto space-y-4">
            <form onSubmit={handleSubmit} className="flex items-center gap-0 bg-white rounded-full border-2 border-[#1c293d] p-1.5 shadow-lg">
              <Input
                type="email"
                placeholder="Enter Your Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className="flex-1 h-12 px-6 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base placeholder:text-gray-400"
              />
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-12 px-8 bg-[#1c293d] hover:bg-[#1c293d]/90 text-white font-semibold rounded-full text-base disabled:opacity-50"
              >
                {isSubmitting ? 'Subscribing...' : 'Subscribe'}
              </Button>
            </form>

            {error && (
              <p className="text-sm text-red-500 mt-2">{error}</p>
            )}

            {!error && (
              <p className="text-2xl font-bold text-gray-900 tracking-wide">
                FREE FOREVER!
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
