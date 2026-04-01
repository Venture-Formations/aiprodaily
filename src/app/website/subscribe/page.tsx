import { Container } from "@/components/salient/Container"
import { SubscribeForm } from "./subscribe-form"
import { renderStyledHeading } from "@/components/StyledHeading"
import { resolvePublicationFromRequest, getPublicationSettings } from '@/lib/publication-settings'

// Force dynamic rendering to fetch fresh data
export const dynamic = 'force-dynamic'

export default async function SubscribePage() {
  const { publicationId } = await resolvePublicationFromRequest()

  // Fetch settings from publication_settings
  const settings = await getPublicationSettings(publicationId, [
    'logo_url',
    'newsletter_name',
    'subscribe_heading',
    'subscribe_subheading',
    'subscribe_tagline',
  ])

  const logoUrl = settings.logo_url || '/logo.png'
  const newsletterName = settings.newsletter_name || 'AI Accounting Daily'
  const heading = settings.subscribe_heading || 'Master AI Tools, Prompts & News **in Just 3 Minutes a Day**'
  const subheading = settings.subscribe_subheading || 'Join 10,000+ accounting professionals staying current as AI reshapes bookkeeping, tax, and advisory work.'
  const tagline = settings.subscribe_tagline || 'FREE FOREVER'

  return (
    <main className="min-h-[100dvh] bg-white px-4">
      {/* Subscribe Section */}
      <section className="pt-8 sm:pt-16 pb-6 sm:pb-16">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            {/* Logo */}
            <div className="flex justify-center mb-6 sm:mb-8">
              <img
                src={logoUrl}
                alt={newsletterName}
                className="h-28 sm:h-44 w-auto object-contain"
              />
            </div>

            {/* Headline */}
            <h1 className="font-display text-2xl tracking-tight text-slate-900 sm:text-4xl">
              {renderStyledHeading(heading)}
            </h1>

            {/* Subheadline */}
            <p className="mt-4 sm:mt-6 text-base sm:text-lg tracking-tight text-slate-700">
              {subheading}
            </p>

            {/* Subscribe Form */}
            <div className="mt-6 sm:mt-10">
              <SubscribeForm newsletterName={newsletterName} tagline={tagline} />
            </div>
          </div>
        </Container>
      </section>
    </main>
  )
}
