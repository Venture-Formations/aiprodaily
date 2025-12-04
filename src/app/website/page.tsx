import { Header } from "@/components/website/header"
import { Hero } from "@/components/website/hero"
import { Footer } from "@/components/website/footer"
import { NewslettersList } from "@/components/website/newsletters-list"
import { supabaseAdmin } from "@/lib/supabase"
import { headers } from 'next/headers'
import { getPublicationByDomain, getPublicationSettings } from '@/lib/publication-settings'

// Force dynamic rendering to fetch fresh data
export const dynamic = 'force-dynamic'

export default async function WebsiteHome() {
  // Get domain from headers (Next.js 15 requires await)
  const headersList = await headers()
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'aiaccountingdaily.com'

  // Get publication ID from domain
  let publicationId = await getPublicationByDomain(host)

  // Fallback: if domain lookup fails, try to get by slug or use first active publication
  if (!publicationId) {
    console.warn(`[Website] No publication found for domain: ${host}, falling back to first active`)
    const { data: firstPub } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()
    publicationId = firstPub?.id || ''
  }

  // Fetch settings from publication_settings (publicationId is guaranteed to be string now)
  const settings = await getPublicationSettings(publicationId || '', [
    'website_header_url',
    'logo_url',
    'newsletter_name',
    'business_name'
  ])

  const headerImageUrl = settings.website_header_url || '/logo.png'
  const logoUrl = settings.logo_url || '/logo.png'
  const newsletterName = settings.newsletter_name || 'AI Accounting Daily'
  const businessName = settings.business_name || 'AI Accounting Daily'
  const currentYear = new Date().getFullYear()

  // Fetch newsletters with articles data for images (filtered by publication)
  const { data: newsletters } = await supabaseAdmin
    .from('archived_newsletters')
    .select('id, issue_id, issue_date, subject_line, send_date, metadata, articles')
    .eq('publication_id', publicationId)
    .order('issue_date', { ascending: false })

  // JSON-LD structured data for WebPage
  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "AI Accounting Daily - Newsletter Archive",
    "description": "Daily insights, tools, and strategies to help accountants and finance professionals leverage AI for better outcomes.",
    "publisher": {
      "@type": "Organization",
      "name": "AI Accounting Daily",
      "url": "https://aiaccountingdaily.com"
    }
  }

  return (
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
      />
      <Header logoUrl={headerImageUrl} />
      <Hero />
      {/* Newsletters Content */}
      <NewslettersList
        newsletters={newsletters || []}
        imageOverride="https://raw.githubusercontent.com/Venture-Formations/aiprodaily/master/public/images/accounting_website/ai_accounting_daily_cover_image.jpg"
      />
      <Footer logoUrl={logoUrl} newsletterName={newsletterName} businessName={businessName} currentYear={currentYear} />
    </main>
  )
}
