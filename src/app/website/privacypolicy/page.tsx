import { Header } from "@/components/salient/Header"
import { Footer } from "@/components/salient/Footer"
import { Container } from "@/components/salient/Container"
import { headers } from 'next/headers'
import { getPublicationByDomain, getPublicationSettings } from '@/lib/publication-settings'

// Force dynamic rendering to fetch fresh data
export const dynamic = 'force-dynamic'

export default async function PrivacyPolicyPage() {
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

      {/* Hero Section - Blue background with cloud effect */}
      <section className="relative overflow-hidden bg-blue-600 pt-24 pb-16">
        <img
          src="/images/background-call-to-action.jpg"
          alt=""
          className="absolute top-1/2 left-1/2 max-w-none -translate-x-1/2 -translate-y-1/2"
          width={2347}
          height={1244}
        />
        <Container className="relative">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="font-display text-3xl tracking-tight text-white sm:text-4xl">
              Privacy Policy
            </h1>
            <p className="mt-4 text-lg tracking-tight text-blue-100">
              Effective Date: January 1, 2025 | Last Updated: August 15, 2025
            </p>
          </div>
        </Container>
      </section>

      {/* Privacy Policy Content */}
      <section className="bg-white py-16">
        <Container>
          <div className="mx-auto max-w-3xl prose prose-slate prose-lg">
            <p className="lead">
              AI Accounting Daily ("we," "our," or "us") is a division of Venture Formations LLC.
              We operate daily email newsletters for professionals. This Privacy Policy explains
              how we collect, use, and protect your information when you subscribe to our newsletter
              or interact with our services.
            </p>

            <h2>1. Information We Collect</h2>
            <p>We collect information that helps us deliver our newsletter and improve your experience:</p>
            <ul>
              <li><strong>Personal Information:</strong> Your name, email address, and any details you choose to provide when subscribing or contacting us.</li>
              <li><strong>Usage Data:</strong> Information about how you interact with our emails (opens, clicks, etc.) and our website.</li>
              <li><strong>Technical Data:</strong> IP address, browser type, device information, and operating system when you visit our site.</li>
            </ul>

            <h2>2. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul>
              <li>Send you the AI Accounting Daily newsletter.</li>
              <li>Provide updates, promotions, or announcements relevant to our audience.</li>
              <li>Improve newsletter content and website functionality.</li>
              <li>Comply with legal obligations and enforce our Terms of Service.</li>
            </ul>
            <p><strong>We do not sell your personal information to third parties.</strong></p>

            <h2>3. Sharing Your Information</h2>
            <p>We may share your information only in these cases:</p>
            <ul>
              <li><strong>Service Providers:</strong> Email marketing platforms, analytics providers, or other vendors who help us operate our newsletter.</li>
              <li><strong>Legal Compliance:</strong> When required by law or to protect our rights.</li>
              <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets involving Venture Formations LLC.</li>
            </ul>

            <h2>4. Cookies & Tracking Technologies</h2>
            <p>We may use cookies, pixels, and similar tools to:</p>
            <ul>
              <li>Measure email engagement.</li>
              <li>Track website traffic and performance.</li>
              <li>Personalize content and ads (if applicable).</li>
            </ul>
            <p>You can adjust your browser settings to block cookies, but this may affect your experience.</p>

            <h2>5. Data Retention</h2>
            <p>
              We keep your information for as long as you are subscribed to AI Accounting Daily
              or as needed for legal purposes. You can unsubscribe at any time by clicking the
              link in any email.
            </p>

            <h2>6. Your Rights</h2>
            <p>Depending on your location, you may have rights to:</p>
            <ul>
              <li>Access, correct, or delete your personal information.</li>
              <li>Opt out of marketing emails.</li>
              <li>Request a copy of the data we have about you.</li>
            </ul>
            <p>
              To make a request, contact us at{' '}
              <a href="mailto:aiaccountingdaily@aiprodaily.com">aiaccountingdaily@aiprodaily.com</a>.
            </p>

            <h2>7. Security</h2>
            <p>
              We use reasonable administrative, technical, and physical safeguards to protect
              your information. No system is 100% secure, but we take data protection seriously.
            </p>

            <h2>8. Third-Party Links</h2>
            <p>
              Our newsletter or website may contain links to other sites. We are not responsible
              for their privacy practices. Please review their policies before providing information.
            </p>

            <h2>9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. The latest version will always
              be posted on our website with the "Last Updated" date.
            </p>

            <h2>10. Contact Us</h2>
            <p>For questions about this Privacy Policy or your data, contact:</p>
            <address className="not-italic">
              <strong>Venture Formations LLC</strong><br />
              Attn: Privacy – AI Accounting Daily<br />
              8250 Delta Cir.<br />
              Saint Joseph, MN 56374<br /><br />
              Email: <a href="mailto:aiaccountingdaily@aiprodaily.com">aiaccountingdaily@aiprodaily.com</a>
            </address>
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
