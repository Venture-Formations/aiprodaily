import { Header } from "@/components/website/header"
import { Hero } from "@/components/website/hero"
import { Footer } from "@/components/website/footer"
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

  return (
    <main className="min-h-screen">
      <Header logoUrl={logoUrl} />
      <Hero />
      {/* Content area for visual separation */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F5F5F7] min-h-[400px]">
        <div className="container mx-auto max-w-6xl">
          {/* Content will go here */}
        </div>
      </section>
      <Footer logoUrl={logoUrl} newsletterName={newsletterName} businessName={businessName} currentYear={currentYear} />
    </main>
  )
}
