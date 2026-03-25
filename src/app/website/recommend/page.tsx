import { supabaseAdmin } from '@/lib/supabase'
import { getPublicationSettings } from '@/lib/publication-settings'
import { PUBLICATION_ID } from '@/lib/config'
import { RecommendContent } from './recommend-content'
import { Container } from '@/components/salient/Container'

export const dynamic = 'force-dynamic'

export default async function RecommendPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; email?: string; issue_id?: string }>
}) {
  const params = await searchParams
  const refCode = params.ref
  const email = params.email || null
  const issueId = params.issue_id || null

  // Fetch publication settings for branding
  const settings = await getPublicationSettings(PUBLICATION_ID, [
    'logo_url',
    'newsletter_name',
    'primary_color',
  ])
  const logoUrl = settings.logo_url || '/logo.png'
  const newsletterName = settings.newsletter_name || 'AI Pro Daily'
  const primaryColor = settings.primary_color || '#1877F2'

  // Validate ref_code param
  if (!refCode) {
    return (
      <main className="min-h-[100dvh] bg-white px-4">
        <section className="pt-16 sm:pt-24 pb-16">
          <Container>
            <div className="mx-auto max-w-lg text-center">
              <div className="flex justify-center mb-6">
                <img src={logoUrl} alt={newsletterName} className="h-16 sm:h-20 w-auto object-contain" />
              </div>
              <h1 className="font-display text-2xl tracking-tight text-slate-900 sm:text-3xl mb-4">
                Invalid Link
              </h1>
              <p className="text-lg text-slate-600">
                This recommendation link is missing required information.
              </p>
              <div className="mt-8">
                <a
                  href="/"
                  className="inline-block px-6 py-3 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: primaryColor }}
                >
                  Back to {newsletterName}
                </a>
              </div>
            </div>
          </Container>
        </section>
      </main>
    )
  }

  // Fetch recommendation details
  const { data: rec } = await supabaseAdmin
    .from('sparkloop_recommendations')
    .select('ref_code, publication_name, publication_logo, description, status, excluded')
    .eq('publication_id', PUBLICATION_ID)
    .eq('ref_code', refCode)
    .single()

  if (!rec || rec.status !== 'active' || rec.excluded) {
    return (
      <main className="min-h-[100dvh] bg-white px-4">
        <section className="pt-16 sm:pt-24 pb-16">
          <Container>
            <div className="mx-auto max-w-lg text-center">
              <div className="flex justify-center mb-6">
                <img src={logoUrl} alt={newsletterName} className="h-16 sm:h-20 w-auto object-contain" />
              </div>
              <h1 className="font-display text-2xl tracking-tight text-slate-900 sm:text-3xl mb-4">
                Recommendation Unavailable
              </h1>
              <p className="text-lg text-slate-600">
                This newsletter recommendation is no longer available.
              </p>
              <div className="mt-8">
                <a
                  href="/"
                  className="inline-block px-6 py-3 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: primaryColor }}
                >
                  Back to {newsletterName}
                </a>
              </div>
            </div>
          </Container>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-[100dvh] bg-white px-4">
      <RecommendContent
        refCode={rec.ref_code}
        issueId={issueId}
        email={email}
        publicationName={rec.publication_name}
        publicationLogo={rec.publication_logo}
        description={rec.description}
        logoUrl={logoUrl}
        newsletterName={newsletterName}
        primaryColor={primaryColor}
      />
    </main>
  )
}
