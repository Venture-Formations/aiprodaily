import { Header } from "@/components/website/header"
import { Footer } from "@/components/website/footer"
import { NewslettersList } from "@/components/website/newsletters-list"
import { supabaseAdmin } from "@/lib/supabase"
import { headers } from 'next/headers'
import { getPublicationByDomain, getPublicationSettings } from '@/lib/publication-settings'

// Force dynamic rendering to fetch fresh data
export const dynamic = 'force-dynamic'

export default async function NewslettersPage() {
  // Get domain from headers (Next.js 15 requires await)
  const headersList = await headers()
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'aiaccountingdaily.com'

  // Get publication ID from domain
  const publicationId = await getPublicationByDomain(host) || 'accounting'

  // Fetch settings from publication_settings
  const settings = await getPublicationSettings(publicationId, [
    'website_header_url',
    'logo_url',
    'newsletter_name',
    'business_name',
    'primary_color'
  ])

  const headerImageUrl = settings.website_header_url || '/logo.png'
  const logoUrl = settings.logo_url || '/logo.png'
  const newsletterName = settings.newsletter_name || 'AI Accounting Daily'
  const businessName = settings.business_name || 'AI Accounting Daily'
  const primaryColor = settings.primary_color || '#1c293d'
  const currentYear = new Date().getFullYear()

  // Fetch newsletters with articles data for images
  const { data: newsletters } = await supabaseAdmin
    .from('archived_newsletters')
    .select('id, campaign_id, campaign_date, subject_line, send_date, metadata, articles')
    .eq('publication_id', publicationId)
    .order('campaign_date', { ascending: false })

  return (
    <main className="min-h-screen bg-[#F5F5F7]">
      <Header logoUrl={headerImageUrl} />

      {/* Primary Color Banner */}
      <section className="pt-20 pb-10 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: primaryColor }}>
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
              Latest AI Accounting News
            </h1>
            <p className="text-base text-white/80 max-w-xl mx-auto leading-relaxed">
              Browse our complete archive of daily AI insights for accounting professionals.
            </p>
          </div>
        </div>
      </section>

      {/* Newsletters Content */}
      <NewslettersList newsletters={newsletters || []} />

      <Footer logoUrl={logoUrl} newsletterName={newsletterName} businessName={businessName} currentYear={currentYear} />
    </main>
  )
}
