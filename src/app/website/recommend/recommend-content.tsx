'use client'

import { useState } from 'react'
import { Container } from '@/components/salient/Container'

interface RecommendContentProps {
  refCode: string
  issueId: string | null
  email: string | null
  publicationName: string
  publicationLogo: string | null
  description: string | null
  logoUrl: string
  newsletterName: string
  primaryColor: string
}

export function RecommendContent({
  refCode,
  issueId,
  email,
  publicationName,
  publicationLogo,
  description,
  logoUrl,
  newsletterName,
  primaryColor,
}: RecommendContentProps) {
  const [status, setStatus] = useState<'idle' | 'subscribing' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Check if email is valid (MailerLite merge var not replaced, or missing)
  const hasValidEmail = email && email !== '{$email}' && !email.includes('{$') && email.includes('@')

  const handleSubscribe = async () => {
    if (!hasValidEmail) return

    setStatus('subscribing')
    setErrorMsg(null)

    try {
      const response = await fetch('/api/sparkloop/recommend-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          ref_code: refCode,
          issue_id: issueId || undefined,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setStatus('success')
      } else if (data.error === 'unavailable') {
        setErrorMsg('This newsletter is no longer available for subscription.')
        setStatus('error')
      } else {
        setErrorMsg('Something went wrong. Please try again.')
        setStatus('error')
      }
    } catch {
      setErrorMsg('Failed to connect. Please check your internet and try again.')
      setStatus('error')
    }
  }

  const initial = publicationName.charAt(0).toUpperCase()

  return (
    <section className="pt-12 sm:pt-20 pb-16">
      <Container>
        <div className="mx-auto max-w-lg text-center">
          {/* Our newsletter logo */}
          <div className="flex justify-center mb-8">
            <img
              src={logoUrl}
              alt={newsletterName}
              className="h-14 sm:h-18 w-auto object-contain"
            />
          </div>

          <p className="text-sm text-slate-500 mb-6">Recommended by {newsletterName}</p>

          {/* Recommendation card */}
          <div className="rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 text-left">
            <div className="flex items-start gap-4">
              {/* Logo */}
              <div className="flex-shrink-0">
                {publicationLogo ? (
                  <img
                    src={publicationLogo}
                    alt={publicationName}
                    className="w-14 h-14 rounded-xl object-cover"
                  />
                ) : (
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-bold"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {initial}
                  </div>
                )}
              </div>

              {/* Name & description */}
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-slate-900">{publicationName}</h1>
                {description && (
                  <p className="mt-2 text-base text-slate-600 leading-relaxed">{description}</p>
                )}
              </div>
            </div>

            {/* Subscribe area */}
            <div className="mt-6">
              {!hasValidEmail ? (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                  <p className="text-sm text-amber-800">
                    Please open this link from your email to subscribe.
                  </p>
                </div>
              ) : status === 'success' ? (
                <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
                  <div className="mx-auto w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-base font-semibold text-green-800">
                    You&apos;re subscribed to {publicationName}!
                  </p>
                  <p className="mt-1 text-sm text-green-700">
                    Check your inbox for a welcome email.
                  </p>
                </div>
              ) : (
                <>
                  <button
                    onClick={handleSubscribe}
                    disabled={status === 'subscribing'}
                    className="w-full py-3.5 px-4 text-white rounded-lg font-semibold text-base hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {status === 'subscribing' ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                        Subscribing...
                      </span>
                    ) : (
                      `Subscribe to ${publicationName}`
                    )}
                  </button>

                  {errorMsg && (
                    <p className="mt-3 text-sm text-red-600 text-center">{errorMsg}</p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Back link */}
          <div className="mt-8">
            <a
              href="/"
              className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Back to {newsletterName}
            </a>
          </div>
        </div>
      </Container>
    </section>
  )
}
