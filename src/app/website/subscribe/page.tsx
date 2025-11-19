import { SubscribeForm } from "./subscribe-form"
import { headers } from 'next/headers'
import { getPublicationByDomain, getPublicationSettings } from '@/lib/publication-settings'

// Force dynamic rendering to fetch fresh data
export const dynamic = 'force-dynamic'

export default async function SubscribePage() {
  // Get domain from headers (Next.js 15 requires await)
  const headersList = await headers()
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'aiaccountingdaily.com'

  // Get publication ID from domain
  const publicationId = await getPublicationByDomain(host) || 'accounting'

  // Fetch logo from publication_settings
  const settings = await getPublicationSettings(publicationId, ['logo_url'])
  const logoUrl = settings.logo_url || '/logo.png'

  return (
    <main className="min-h-screen bg-white px-4 pt-12 pb-12">
      <div className="max-w-2xl w-full mx-auto">
        <div className="text-center space-y-8">
          {/* Logo */}
          <div className="flex justify-center">
            <img
              src={logoUrl}
              alt="AI Accounting Daily"
              className="h-48 w-auto object-contain"
            />
          </div>

          {/* Headline */}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
            Master AI Tools, Prompts & News
            <br />
            in Just 3 Mins a Day
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Join 10,000+ accounting professionals staying current<br />
            as AI reshapes bookkeeping, tax, and advisory work.
          </p>

          {/* Subscribe Form */}
          <SubscribeForm />
        </div>
      </div>
    </main>
  )
}
