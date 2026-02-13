import { Container } from "@/components/salient/Container"
import { SubscribeProgressBar } from '@/components/SubscribeProgressBar'
import { PersonalizationForm } from "./personalization-form"
import { headers } from 'next/headers'
import { getPublicationByDomain, getPublicationSettings } from '@/lib/publication-settings'

// Force dynamic rendering to fetch fresh data
export const dynamic = 'force-dynamic'

export default async function SubscribeInfoPage() {
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
      {/* Personalization Section */}
      <section className="pt-8 sm:pt-16 pb-6 sm:pb-16">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <SubscribeProgressBar step={4} />

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
              One Last Step!
              <br />
              <span className="relative whitespace-nowrap">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 418 42"
                  className="absolute top-2/3 left-0 h-[0.58em] w-full fill-cyan-300/70"
                  preserveAspectRatio="none"
                >
                  <path d="M203.371.916c-26.013-2.078-76.686 1.963-124.73 9.946L67.3 12.749C35.421 18.062 18.2 21.766 6.004 25.934 1.244 27.561.828 27.778.874 28.61c.07 1.214.828 1.121 9.595-1.176 9.072-2.377 17.15-3.92 39.246-7.496C123.565 7.986 157.869 4.492 195.942 5.046c7.461.108 19.25 1.696 19.17 2.582-.107 1.183-7.874 4.31-25.75 10.366-21.992 7.45-35.43 12.534-36.701 13.884-2.173 2.308-.202 4.407 4.442 4.734 2.654.187 3.263.157 15.593-.78 35.401-2.686 57.944-3.488 88.365-3.143 46.327.526 75.721 2.23 130.788 7.584 19.787 1.924 20.814 1.98 24.557 1.332l.066-.011c1.201-.203 1.53-1.825.399-2.335-2.911-1.31-4.893-1.604-22.048-3.261-57.509-5.556-87.871-7.36-132.059-7.842-23.239-.254-33.617-.116-50.627.674-11.629.54-42.371 2.494-46.696 2.967-2.359.259 8.133-3.625 26.504-9.81 23.239-7.825 27.934-10.149 28.304-14.005.417-4.348-3.529-6-16.878-7.066Z" />
                </svg>
                <span className="relative bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">Personalize Your Experience</span>
              </span>
            </h1>

            {/* Subheadline */}
            <p className="mt-4 sm:mt-6 text-base sm:text-lg tracking-tight text-slate-700">
              Help us tailor your newsletter to your needs.
              <br />
              This only takes 30 seconds!
            </p>

            {/* Personalization Form */}
            <div className="mt-6 sm:mt-10">
              <PersonalizationForm />
            </div>
          </div>
        </Container>
      </section>
    </main>
  )
}
