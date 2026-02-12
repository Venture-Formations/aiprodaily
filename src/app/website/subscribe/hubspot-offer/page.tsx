import { headers } from 'next/headers'
import { getPublicationByDomain, getPublicationSettings } from '@/lib/publication-settings'
import { HubspotOfferContent } from './hubspot-offer-content'

export const dynamic = 'force-dynamic'

export default async function HubspotOfferPage() {
  const headersList = await headers()
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'aiaccountingdaily.com'

  const publicationId = await getPublicationByDomain(host) || 'accounting'

  const settings = await getPublicationSettings(publicationId, [
    'logo_url',
    'newsletter_name'
  ])

  const logoUrl = settings.logo_url || '/logo.png'
  const newsletterName = settings.newsletter_name || 'AI Accounting Daily'

  return (
    <main className="min-h-[100dvh] bg-white">
      <HubspotOfferContent logoUrl={logoUrl} newsletterName={newsletterName} />
    </main>
  )
}
