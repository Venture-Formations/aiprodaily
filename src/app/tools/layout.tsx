import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { headers } from 'next/headers'
import { getPublicationSettingsByDomain } from '@/lib/publication-settings'
import { DirectoryHeader } from './components/DirectoryHeader'
import { Container } from '@/components/salient/Container'
import { NavLink } from '@/components/salient/NavLink'

export const metadata: Metadata = {
  title: 'AI Tools Directory | AI Accounting Daily',
  description: 'Discover the best AI tools for accounting professionals. Browse 200+ tools for finance, payroll, HR, productivity, and more.',
}

interface DirectoryFooterProps {
  logoUrl: string
  newsletterName: string
  businessName: string
}

function DirectoryFooter({ logoUrl, newsletterName, businessName }: DirectoryFooterProps) {
  return (
    <footer className="bg-slate-50">
      <Container>
        <div className="py-16">
          <Link href="/" className="mx-auto block w-fit">
            <Image
              src={logoUrl}
              alt={newsletterName}
              width={140}
              height={40}
              className="h-10 w-auto"
            />
          </Link>
          <nav className="mt-10 text-sm" aria-label="quick links">
            <div className="-my-1 flex justify-center gap-x-6">
              <NavLink href="/">Home</NavLink>
              <NavLink href="/tools">AI Tools</NavLink>
              <NavLink href="/tools/submit">Submit Tool</NavLink>
              <NavLink href="/contactus">Contact</NavLink>
            </div>
          </nav>
        </div>
        <div className="flex flex-col items-center border-t border-slate-400/10 py-10">
          <p className="text-sm text-slate-500">
            Copyright &copy; {new Date().getFullYear()} {businessName}. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  )
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
    'business_name'
  ])

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
        <DirectoryHeader logoUrl={logoUrl} newsletterName={newsletterName} />
        <main className="flex-1">
          {children}
        </main>
        <DirectoryFooter
          logoUrl={logoUrl}
          newsletterName={newsletterName}
          businessName={businessName}
        />
      </div>
    </ClerkProvider>
  )
}
