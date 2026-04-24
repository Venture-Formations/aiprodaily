import { cookies, headers } from 'next/headers'
import { getPublicationByDomain, getPublicationSettings } from '@/lib/publication-settings'
import { OffersContent } from './offers-content'
import {
  attributeByVisitor,
  recordEvent,
  VISITOR_COOKIE,
} from '@/lib/ab-tests'
import { checkUserAgent } from '@/lib/bot-detection/ua-detector'

// Force dynamic rendering to fetch fresh data
export const dynamic = 'force-dynamic'

export default async function OffersPage() {
  // Get domain from headers (Next.js 15 requires await)
  const headersList = await headers()
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'aiaccountingdaily.com'

  // Get publication ID from domain
  const publicationId = await getPublicationByDomain(host) || 'accounting'

  // Fetch settings from publication_settings
  const settings = await getPublicationSettings(publicationId, [
    'logo_url',
    'newsletter_name',
    'afteroffers_form_id',
  ])

  const logoUrl = settings.logo_url || '/logo.png'
  const newsletterName = settings.newsletter_name || 'AI Accounting Daily'
  const afteroffersFormId = settings.afteroffers_form_id || ''

  // Record reached_offers conversion if an active A/B test assignment exists
  try {
    const cookieStore = await cookies()
    const visitorId = cookieStore.get(VISITOR_COOKIE)?.value
    const userAgent = headersList.get('user-agent')
    if (visitorId && !checkUserAgent(userAgent).isBot) {
      const attribution = await attributeByVisitor(publicationId, visitorId)
      if (attribution) {
        const ipAddress =
          headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          headersList.get('x-real-ip') ||
          null
        await recordEvent(attribution.testId, attribution.variantId, 'reached_offers', {
          publicationId,
          visitorId,
          ipAddress,
          userAgent,
        })
      }
    }
  } catch (abError) {
    console.error('[Offers] A/B reached_offers event failed:', abError)
  }

  return (
    <main className="min-h-[100dvh] bg-white">
      <OffersContent logoUrl={logoUrl} newsletterName={newsletterName} afteroffersFormId={afteroffersFormId} />
    </main>
  )
}
