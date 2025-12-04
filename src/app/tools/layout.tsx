import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { getPublicationSettingsByDomain } from '@/lib/publication-settings'
import { DirectoryHeader } from './components/DirectoryHeader'

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
    <footer className="py-8 px-4 sm:px-6 lg:px-8 bg-[#1c293d] text-white">
      <div className="container mx-auto max-w-6xl">
        <div className="grid md:grid-cols-4 gap-6 mb-6">
          {/* About */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <img src={logoUrl} alt={newsletterName} className="w-8 h-8 object-contain" />
              <span className="font-bold text-base">{newsletterName}</span>
            </div>
            <p className="text-sm text-white/70 leading-relaxed max-w-sm">
              Curated collection of AI tools for accounting professionals. 
              Empowering finance teams with daily AI insights and strategies.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Quick Links</h3>
            <ul className="space-y-1.5 text-sm text-white/70">
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/tools" className="hover:text-white transition-colors">
                  Browse Tools
                </Link>
              </li>
              <li>
                <Link href="/tools/submit" className="hover:text-white transition-colors">
                  Submit a Tool
                </Link>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Stay Updated</h3>
            <p className="text-sm text-white/70 mb-3">
              Get daily AI insights delivered to your inbox.
            </p>
            <Link
              href="/"
              className="inline-block bg-white text-[#1c293d] px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/90 transition-colors"
            >
              Subscribe Free
            </Link>
          </div>
        </div>

        <div className="pt-6 border-t border-white/10 text-center text-white/60 text-xs">
          <p>&copy; {new Date().getFullYear()} {businessName}. All rights reserved.</p>
        </div>
      </div>
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
      <div className="min-h-screen flex flex-col bg-gray-50">
        <DirectoryHeader logoUrl={logoUrl} newsletterName={newsletterName} />
        {/* Add padding-top for fixed header */}
        <main className="flex-1 pt-16">
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
