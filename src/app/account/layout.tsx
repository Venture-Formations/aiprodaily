import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata } from 'next'
import { AccountSidebar } from './components/AccountSidebar'
import { supabaseAdmin } from '@/lib/supabase'

export const metadata: Metadata = {
  title: 'Account | AI Accounting Daily',
  description: 'Manage your AI tool listings and advertisements',
}

export const dynamic = 'force-dynamic'

async function getPublicationSettings() {
  // Get the first active publication (or you could filter by domain/slug)
  const { data: publication } = await supabaseAdmin
    .from('publications')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .single()

  if (!publication) {
    return { newsletterName: 'AI Accounting Daily', logoUrl: null }
  }

  // Fetch settings
  const { data: settings } = await supabaseAdmin
    .from('publication_settings')
    .select('key, value')
    .eq('publication_id', publication.id)
    .in('key', ['newsletter_name', 'logo_url'])

  const settingsMap = settings?.reduce((acc, s) => {
    acc[s.key] = s.value
    return acc
  }, {} as Record<string, string | null>) || {}

  return {
    newsletterName: settingsMap.newsletter_name || 'AI Accounting Daily',
    logoUrl: settingsMap.logo_url || null,
  }
}

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { newsletterName, logoUrl } = await getPublicationSettings()

  return (
    <ClerkProvider>
      <AccountSidebar newsletterName={newsletterName} logoUrl={logoUrl}>
        {children}
      </AccountSidebar>
    </ClerkProvider>
  )
}
