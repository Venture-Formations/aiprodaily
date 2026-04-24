import { cookies, headers } from 'next/headers'
import { Container } from "@/components/salient/Container"
import { SubscribeForm } from "./subscribe-form"
import { renderStyledHeading } from "@/components/StyledHeading"
import { resolvePublicationFromRequest, getPublicationSettings } from '@/lib/publication-settings'
import {
  getActiveTestForPublication,
  getDefaultPageForPublication,
  ensureAssignment,
  recordEvent,
  VISITOR_COOKIE,
} from '@/lib/ab-tests'
import { checkUserAgent } from '@/lib/bot-detection/ua-detector'

// Force dynamic rendering to fetch fresh data
export const dynamic = 'force-dynamic'

export default async function SubscribePage() {
  const { publicationId } = await resolvePublicationFromRequest()

  // Fetch publication-level defaults (used when no variant overrides exist)
  const settings = await getPublicationSettings(publicationId, [
    'logo_url',
    'newsletter_name',
    'subscribe_heading',
    'subscribe_subheading',
    'subscribe_tagline',
  ])

  // Resolve A/B test (if any) and assign a sticky variant.
  // Also load the default subscribe page — used as the base when no test is
  // active, and as the fallback for any variant field left blank.
  const [active, defaultPage] = await Promise.all([
    getActiveTestForPublication(publicationId),
    getDefaultPageForPublication(publicationId),
  ])
  const defaultContent = (defaultPage?.content || {}) as Record<string, string | undefined>

  let variantContent: Record<string, string | undefined> = {}
  if (active) {
    const cookieStore = await cookies()
    const headerList = await headers()
    const visitorId = cookieStore.get(VISITOR_COOKIE)?.value
    const userAgent = headerList.get('user-agent')
    const ipAddress =
      headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headerList.get('x-real-ip') ||
      null
    const uaCheck = checkUserAgent(userAgent)

    if (visitorId) {
      const assignment = await ensureAssignment(active, visitorId, {
        ipAddress,
        userAgent,
        isBotUa: uaCheck.isBot,
      })

      if (assignment) {
        variantContent = (assignment.variant.page.content || {}) as Record<string, string | undefined>

        // Only record page_view events for real visitors (skip obvious bots).
        if (!uaCheck.isBot) {
          await recordEvent(active.test.id, assignment.variant.id, 'page_view', {
            publicationId,
            visitorId,
            ipAddress,
            userAgent,
          })
        }
      }
    }
  }

  // Fallback chain for each field: active variant → default page → publication_settings → hardcoded
  const logoUrl = variantContent.logo_url || defaultContent.logo_url || settings.logo_url || '/logo.png'
  const newsletterName = settings.newsletter_name || 'AI Accounting Daily'
  const heading =
    variantContent.heading ||
    defaultContent.heading ||
    settings.subscribe_heading ||
    'Master AI Tools, Prompts & News **in Just 3 Minutes a Day**'
  const subheading =
    variantContent.subheading ||
    defaultContent.subheading ||
    settings.subscribe_subheading ||
    'Join 10,000+ accounting professionals staying current as AI reshapes bookkeeping, tax, and advisory work.'
  const tagline =
    variantContent.tagline ||
    defaultContent.tagline ||
    settings.subscribe_tagline ||
    'FREE FOREVER'

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
              {subheading.split('\n').map((line, i) => (
                <span key={i}>{i > 0 && <br />}{line}</span>
              ))}
            </p>

            {/* Subscribe Form */}
            <div className="mt-6 sm:mt-10">
              <SubscribeForm newsletterName={newsletterName} tagline={tagline} publicationId={publicationId} />
            </div>
          </div>
        </Container>
      </section>
    </main>
  )
}
