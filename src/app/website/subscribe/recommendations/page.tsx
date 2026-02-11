import { headers } from 'next/headers'
import { getPublicationByDomain, getPublicationSettings } from '@/lib/publication-settings'
import { RecommendationsContent } from './recommendations-content'

// Force dynamic rendering to fetch fresh data
export const dynamic = 'force-dynamic'

export default async function RecommendationsPage() {
  // Get domain from headers (Next.js 15 requires await)
  const headersList = await headers()
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'aiaccountingdaily.com'

  // Get publication ID from domain
  const publicationId = await getPublicationByDomain(host) || 'accounting'

  // Fetch settings from publication_settings
  const settings = await getPublicationSettings(publicationId, [
    'logo_url',
    'newsletter_name'
  ])

  const logoUrl = settings.logo_url || '/logo.png'
  const newsletterName = settings.newsletter_name || 'AI Accounting Daily'

  return (
    <main className="min-h-[100dvh] bg-white px-4">
      <RecommendationsContent logoUrl={logoUrl} newsletterName={newsletterName} />
    </main>
  )
}
