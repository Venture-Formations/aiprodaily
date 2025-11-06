import { Header } from "@/components/website/header"
import { Hero } from "@/components/website/hero"
import { Footer } from "@/components/website/footer"
import { NewslettersList } from "@/components/website/newsletters-list"
import { supabaseAdmin } from "@/lib/supabase"

// Force dynamic rendering to fetch fresh data
export const dynamic = 'force-dynamic'

export default async function WebsiteHome() {
  // Fetch settings from database
  const { data: settings } = await supabaseAdmin
    .from('app_settings')
    .select('key, value')
    .in('key', ['website_header_url', 'logo_url', 'newsletter_name', 'business_name'])

  const headerImageUrl = settings?.find(s => s.key === 'website_header_url')?.value || '/logo.png'
  const logoUrl = settings?.find(s => s.key === 'logo_url')?.value || '/logo.png'
  const newsletterName = settings?.find(s => s.key === 'newsletter_name')?.value || 'AI Accounting Daily'
  const businessName = settings?.find(s => s.key === 'business_name')?.value || 'AI Accounting Daily'
  const currentYear = new Date().getFullYear()

  // Fetch newsletters with articles data for images
  const { data: newsletters } = await supabaseAdmin
    .from('archived_newsletters')
    .select('id, campaign_date, subject_line, send_date, metadata, articles')
    .order('campaign_date', { ascending: false })

  return (
    <main className="min-h-screen">
      <Header logoUrl={headerImageUrl} />
      <Hero />
      {/* Newsletters Content */}
      <NewslettersList
        newsletters={newsletters || []}
        imageOverride="https://github.com/Venture-Formations/aiprodaily/raw/refs/heads/master/website/public/ai_accounting_daily_cover_image.jpg"
      />
      <Footer logoUrl={logoUrl} newsletterName={newsletterName} businessName={businessName} currentYear={currentYear} />
    </main>
  )
}
