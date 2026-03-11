import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'settings/footer', requirePublicationId: true },
  async ({ publicationId }) => {
    const { data: settings } = await supabaseAdmin
      .from('publication_settings')
      .select('key, value')
      .eq('publication_id', publicationId!)
      .in('key', ['logo_url', 'newsletter_name', 'business_name'])

    const logoUrl = settings?.find(s => s.key === 'logo_url')?.value || '/logo.png'
    const newsletterName = settings?.find(s => s.key === 'newsletter_name')?.value || 'Newsletter'
    const businessName = settings?.find(s => s.key === 'business_name')?.value || 'Newsletter'

    return NextResponse.json({
      logoUrl,
      newsletterName,
      businessName,
      currentYear: new Date().getFullYear()
    })
  }
)
