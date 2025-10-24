'use client'

import { Button } from "@/components/website/ui/button"
import { Input } from "@/components/website/ui/input"
import { Sparkles } from "lucide-react"
import { useState } from "react"

export function Hero() {
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
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (response.ok) {
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
    <section className="pt-20 pb-10 px-4 sm:px-6 lg:px-8 bg-[#1c293d]">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center space-y-5">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1c293d] border-2 border-white">
            <Sparkles className="w-4 h-4 text-[#06b6d4]" />
            <span className="text-xs font-medium bg-gradient-to-r from-[#a855f7] via-[#06b6d4] to-[#14b8a6] bg-clip-text text-transparent">
              Join 10,000+ accounting professionals
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight text-balance">
            Stay Ahead of AI Trends
            <br />
            in{" "}
            <span className="bg-gradient-to-r from-[#a855f7] via-[#06b6d4] to-[#14b8a6] bg-clip-text text-transparent">
              Accounting
            </span>{" "}
            and Finance
          </h1>

          {/* Subheadline */}
          <p className="text-base text-white/80 max-w-xl mx-auto leading-relaxed text-pretty">
            Daily insights, tools, and strategies to help accountants and finance professionals leverage AI for better
            outcomes.
          </p>

          {/* Email signup */}
          <div className="max-w-xl mx-auto">
            <form onSubmit={handleSubmit} className="flex items-center gap-0 bg-white rounded-full border-2 border-[#1c293d] p-1.5 shadow-lg">
              <Input
                type="email"
                placeholder="Enter Your Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className="flex-1 h-11 px-5 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm placeholder:text-gray-400"
              />
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-11 px-6 bg-[#1c293d] hover:bg-[#1c293d]/90 text-white font-semibold rounded-full text-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Subscribing...' : 'Subscribe'}
              </Button>
            </form>
            {error && (
              <p className="text-xs text-red-400 mt-2">{error}</p>
            )}
            {!error && (
              <p className="text-xs text-white/60 mt-2">Free forever. Unsubscribe anytime. No spam, ever.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
