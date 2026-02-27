import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata } from 'next'
import { AccountSidebar } from './components/AccountSidebar'
import { resolvePublicationFromRequest } from '@/lib/publication-settings'

export const metadata: Metadata = {
  title: 'Account',
  description: 'Manage your AI tool listings and advertisements',
}

export const dynamic = 'force-dynamic'

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { settings } = await resolvePublicationFromRequest()
  const newsletterName = settings.newsletter_name || 'Newsletter'
  const logoUrl = settings.logo_url || null

  return (
    <ClerkProvider>
      <AccountSidebar newsletterName={newsletterName} logoUrl={logoUrl}>
        {children}
      </AccountSidebar>
    </ClerkProvider>
  )
}
