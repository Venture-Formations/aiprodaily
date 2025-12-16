import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getPublicationSettingsByDomain } from '@/lib/publication-settings'
import { Header } from '@/components/salient/Header'
import { Footer } from '@/components/salient/Footer'

export const metadata: Metadata = {
  title: 'AI Tools Directory | AI Accounting Daily',
  description: 'Discover the best AI tools for accounting professionals. Browse 200+ tools for finance, payroll, HR, productivity, and more.',
}

export default async function ToolsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Get publication settings from domain
  const headersList = await headers()
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'aiaccountingdaily.com'
  const settings = await getPublicationSettingsByDomain(host, [
    'newsletter_name',
    'logo_url',
    'website_header_url',
    'business_name'
  ])

  // Use website_header_url for header (same as /website pages), logo_url for footer
  const headerLogoUrl = settings.website_header_url || settings.logo_url || '/logo.png'
  const logoUrl = settings.logo_url || '/logo.png'
  const newsletterName = settings.newsletter_name || 'AI Accounting Daily'
  const businessName = settings.business_name || 'AI Accounting Daily'

  // JSON-LD structured data for Organization
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": newsletterName,
    "url": "https://aiaccountingdaily.com",
    "logo": {
      "@type": "ImageObject",
      "url": "https://aiaccountingdaily.com/logo.png"
    },
    "description": "Daily insights, tools, and strategies to help accountants and finance professionals leverage AI for better outcomes."
  }

  // JSON-LD structured data for WebSite
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": `AI Tools Directory | ${newsletterName}`,
    "url": "https://aiaccountingdaily.com/tools",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://aiaccountingdaily.com/tools?search={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  }

  return (
    <ClerkProvider>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <div className="min-h-screen flex flex-col">
        <Header logoUrl={headerLogoUrl} />
        <main className="flex-1">
          {children}
        </main>
        <Footer
          logoUrl={logoUrl}
          newsletterName={newsletterName}
          businessName={businessName}
          currentYear={new Date().getFullYear()}
        />
      </div>
    </ClerkProvider>
  )
}
