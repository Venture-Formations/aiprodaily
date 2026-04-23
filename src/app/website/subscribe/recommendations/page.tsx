import { resolvePublicationFromRequest, getPublicationSettings } from '@/lib/publication-settings'
import { RecommendationsContent } from './recommendations-content'

// Force dynamic rendering to fetch fresh data
export const dynamic = 'force-dynamic'

export default async function RecommendationsPage() {
  const { publicationId } = await resolvePublicationFromRequest()

  const settings = await getPublicationSettings(publicationId, [
    'logo_url',
    'newsletter_name',
  ])

  const logoUrl = settings.logo_url || '/logo.png'
  const newsletterName = settings.newsletter_name || 'AI Accounting Daily'

  return (
    <main className="min-h-[100dvh] bg-white px-4">
      <RecommendationsContent
        logoUrl={logoUrl}
        newsletterName={newsletterName}
        publicationId={publicationId}
      />
    </main>
  )
}
