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
    <main className="min-h-screen bg-white">
      <Header logoUrl={headerImageUrl} />

      {/* Privacy Policy Content */}
      <section className="pt-28 pb-20">
        <Container>
          <div className="mx-auto max-w-3xl">
            {/* Title Section - matching tools page style */}
            <div className="mb-12">
              <h1 className="font-display text-4xl font-medium tracking-tight text-slate-900 sm:text-6xl">
                Privacy Policy
              </h1>
              <div className="mt-6 space-y-1 text-slate-600">
                <p>Effective Date: 1/1/2025</p>
                <p>Last Updated: 8/15/2025</p>
              </div>
            </div>

            {/* Intro paragraph */}
            <p className="text-gray-700 leading-relaxed mb-12">
              AI Accounting Daily ("we," "our," or "us") is a division of Venture Formations
              LLC. We operate daily email newsletters for professionals. This Privacy Policy explains
              how we collect, use, and protect your information when you subscribe to our newsletter
              or interact with our services.
            </p>

            {/* Section 1 */}
            <section className="mb-10">
              <h2 className="text-3xl sm:text-4xl font-light text-gray-900 mb-6">
                1. Information We Collect
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We collect information that helps us deliver our newsletter and improve your experience:
              </p>
              <ul className="space-y-3 text-gray-700 leading-relaxed ml-6">
                <li className="flex">
                  <span className="mr-3 text-gray-400">●</span>
                  <span><strong>Personal Information:</strong> Your name, email address, and any details you choose to provide when subscribing or contacting us.</span>
                </li>
                <li className="flex">
                  <span className="mr-3 text-gray-400">●</span>
                  <span><strong>Usage Data:</strong> Information about how you interact with our emails (opens, clicks, etc.) and our website.</span>
                </li>
                <li className="flex">
                  <span className="mr-3 text-gray-400">●</span>
                  <span><strong>Technical Data:</strong> IP address, browser type, device information, and operating system when you visit our site.</span>
                </li>
              </ul>
            </section>

            {/* Section 2 */}
            <section className="mb-10">
              <h2 className="text-3xl sm:text-4xl font-light text-gray-900 mb-6">
                2. How We Use Your Information
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We use your information to:
              </p>
              <ul className="space-y-3 text-gray-700 leading-relaxed ml-6">
                <li className="flex">
                  <span className="mr-3 text-gray-400">●</span>
                  <span>Send you the AI Accounting Daily newsletter.</span>
                </li>
                <li className="flex">
                  <span className="mr-3 text-gray-400">●</span>
                  <span>Provide updates, promotions, or announcements relevant to our audience.</span>
                </li>
                <li className="flex">
                  <span className="mr-3 text-gray-400">●</span>
                  <span>Improve newsletter content and website functionality.</span>
                </li>
                <li className="flex">
                  <span className="mr-3 text-gray-400">●</span>
                  <span>Comply with legal obligations and enforce our Terms of Service.</span>
                </li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                We do not sell your personal information to third parties.
              </p>
            </section>

            {/* Section 3 */}
            <section className="mb-10">
              <h2 className="text-3xl sm:text-4xl font-light text-gray-900 mb-6">
                3. Sharing Your Information
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We may share your information only in these cases:
              </p>
              <ul className="space-y-3 text-gray-700 leading-relaxed ml-6">
                <li className="flex">
                  <span className="mr-3 text-gray-400">●</span>
                  <span><strong>Service Providers:</strong> Email marketing platforms, analytics providers, or other vendors who help us operate our newsletter.</span>
                </li>
                <li className="flex">
                  <span className="mr-3 text-gray-400">●</span>
                  <span><strong>Legal Compliance:</strong> When required by law or to protect our rights.</span>
                </li>
                <li className="flex">
                  <span className="mr-3 text-gray-400">●</span>
                  <span><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets involving Venture Formations LLC.</span>
                </li>
              </ul>
            </section>

            {/* Section 4 */}
            <section className="mb-10">
              <h2 className="text-3xl sm:text-4xl font-light text-gray-900 mb-6">
                4. Cookies & Tracking Technologies
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We may use cookies, pixels, and similar tools to:
              </p>
              <ul className="space-y-3 text-gray-700 leading-relaxed ml-6">
                <li className="flex">
                  <span className="mr-3 text-gray-400">●</span>
                  <span>Measure email engagement.</span>
                </li>
                <li className="flex">
                  <span className="mr-3 text-gray-400">●</span>
                  <span>Track website traffic and performance.</span>
                </li>
                <li className="flex">
                  <span className="mr-3 text-gray-400">●</span>
                  <span>Personalize content and ads (if applicable).</span>
                </li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                You can adjust your browser settings to block cookies, but this may affect your experience.
              </p>
            </section>

            {/* Section 5 */}
            <section className="mb-10">
              <h2 className="text-3xl sm:text-4xl font-light text-gray-900 mb-6">
                5. Data Retention
              </h2>
              <p className="text-gray-700 leading-relaxed">
                We keep your information for as long as you are subscribed to AI Accounting Daily
                or as needed for legal purposes. You can unsubscribe at any time by clicking the
                link in any email.
              </p>
            </section>

            {/* Section 6 */}
            <section className="mb-10">
              <h2 className="text-3xl sm:text-4xl font-light text-gray-900 mb-6">
                6. Your Rights
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Depending on your location, you may have rights to:
              </p>
              <ul className="space-y-3 text-gray-700 leading-relaxed ml-6">
                <li className="flex">
                  <span className="mr-3 text-gray-400">●</span>
                  <span>Access, correct, or delete your personal information.</span>
                </li>
                <li className="flex">
                  <span className="mr-3 text-gray-400">●</span>
                  <span>Opt out of marketing emails.</span>
                </li>
                <li className="flex">
                  <span className="mr-3 text-gray-400">●</span>
                  <span>Request a copy of the data we have about you.</span>
                </li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                To make a request, contact us at{' '}
                <a href="mailto:aiaccountingdaily@aiprodaily.com" className="text-blue-600 hover:underline">
                  aiaccountingdaily@aiprodaily.com
                </a>.
              </p>
            </section>

            {/* Section 7 */}
            <section className="mb-10">
              <h2 className="text-3xl sm:text-4xl font-light text-gray-900 mb-6">
                7. Security
              </h2>
              <p className="text-gray-700 leading-relaxed">
                We use reasonable administrative, technical, and physical safeguards to protect
                your information. No system is 100% secure, but we take data protection seriously.
              </p>
            </section>

            {/* Section 8 */}
            <section className="mb-10">
              <h2 className="text-3xl sm:text-4xl font-light text-gray-900 mb-6">
                8. Third-Party Links
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Our newsletter or website may contain links to other sites. We are not responsible
                for their privacy practices. Please review their policies before providing information.
              </p>
            </section>

            {/* Section 9 */}
            <section className="mb-10">
              <h2 className="text-3xl sm:text-4xl font-light text-gray-900 mb-6">
                9. Changes to This Policy
              </h2>
              <p className="text-gray-700 leading-relaxed">
                We may update this Privacy Policy from time to time. The latest version will always
                be posted on our website with the "Last Updated" date.
              </p>
            </section>

            {/* Section 10 */}
            <section className="mb-10">
              <h2 className="text-3xl sm:text-4xl font-light text-gray-900 mb-6">
                10. Contact Us
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                For questions about this Privacy Policy or your data, contact:
              </p>
              <div className="text-gray-700 leading-relaxed">
                <p className="font-medium">Venture Formations LLC</p>
                <p>Attn: Privacy – AI Accounting Daily</p>
                <p>8250 Delta Cir.</p>
                <p>Saint Joseph, MN 56374</p>
                <p className="mt-4">
                  Email:{' '}
                  <a href="mailto:aiaccountingdaily@aiprodaily.com" className="text-blue-600 hover:underline">
                    aiaccountingdaily@aiprodaily.com
                  </a>
                </p>
              </div>
            </section>
          </div>
        </Container>
      </section>

      <Footer logoUrl={logoUrl} newsletterName={newsletterName} businessName={businessName} currentYear={currentYear} />
    </main>
  )
}
