'use client'

import { useSearchParams } from 'next/navigation'
import { Container } from '@/components/salient/Container'

interface OffersContentProps {
  logoUrl: string
  newsletterName: string
}

export function OffersContent({ logoUrl, newsletterName }: OffersContentProps) {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''

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
            You&apos;re Almost There!
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

          {/* Skip link */}
          <p className="mt-6 text-sm text-slate-500">
            <a
              href={`/subscribe/info?email=${encodeURIComponent(email)}`}
              className="text-blue-600 hover:text-blue-500 underline"
            >
              Skip and continue to complete your profile
            </a>
          </p>
        </div>
      </Container>
    </section>
  )
}
