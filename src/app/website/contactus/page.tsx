import { Header } from "@/components/salient/Header"
import { Footer } from "@/components/salient/Footer"
import { Container } from "@/components/salient/Container"
import { ContactForm } from "@/components/website/contact-form"
import { headers } from 'next/headers'
import { getPublicationByDomain, getPublicationSettings } from '@/lib/publication-settings'

// Force dynamic rendering to fetch fresh data
export const dynamic = 'force-dynamic'

export default async function ContactUsPage() {
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
    'business_name'
  ])

  const headerImageUrl = settings.website_header_url || '/logo.png'
  const logoUrl = settings.logo_url || '/logo.png'
  const newsletterName = settings.newsletter_name || 'AI Accounting Daily'
  const businessName = settings.business_name || 'AI Accounting Daily'
  const currentYear = new Date().getFullYear()

  return (
    <main className="min-h-screen">
      <Header logoUrl={headerImageUrl} />

      {/* Contact Form Section - Blue background with cloud effect */}
      <section className="relative overflow-hidden bg-blue-600 pt-24 pb-16">
        <img
          src="/images/background-call-to-action.jpg"
          alt=""
          className="absolute top-1/2 left-1/2 max-w-none -translate-x-1/2 -translate-y-1/2"
          width={2347}
          height={1244}
        />
        <Container className="relative">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <h1 className="font-display text-3xl tracking-tight text-white sm:text-4xl">
              Contact Us
            </h1>
            <p className="mt-4 text-lg tracking-tight text-blue-100">
              Have questions or feedback? We'd love to hear from you.
            </p>
          </div>
          <div className="mx-auto max-w-xl">
            <ContactForm />
          </div>
        </Container>
      </section>

      {/* CTA Section - Light background */}
      <section className="bg-slate-50 py-16">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-2xl tracking-tight text-slate-900 sm:text-3xl">
              Stay Updated
            </h2>
            <p className="mt-4 text-lg tracking-tight text-slate-700">
              Subscribe to our newsletter for daily AI insights for accounting professionals.
            </p>
            <a
              href="/subscribe"
              className="mt-8 inline-flex items-center justify-center rounded-full bg-blue-600 py-3 px-8 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors"
            >
              Subscribe Free
            </a>
          </div>
        </Container>
      </section>

      <Footer logoUrl={logoUrl} newsletterName={newsletterName} businessName={businessName} currentYear={currentYear} />
    </main>
  )
}
