import { Header } from "@/components/website/header"
import { Footer } from "@/components/website/footer"
import { ContactForm } from "@/components/website/contact-form"
import { supabaseAdmin } from "@/lib/supabase"

// Force dynamic rendering to fetch fresh data
export const dynamic = 'force-dynamic'

export default async function ContactUsPage() {
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
    <div className="min-h-screen bg-[#F5F5F7]">
      <Header logoUrl={headerImageUrl} />

      {/* Primary Color Banner */}
      <section className="pt-20 pb-10 px-4 sm:px-6 lg:px-8 bg-[#1c293d]">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
              Contact Us
            </h1>
            <p className="text-base text-white/80 max-w-xl mx-auto leading-relaxed">
              Have questions or feedback? We'd love to hear from you.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-2xl">
          <ContactForm />
        </div>
      </section>

      <Footer logoUrl={logoUrl} newsletterName={newsletterName} businessName={businessName} currentYear={currentYear} />
    </div>
  )
}
