import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'settings/footer' },
  async ({ request }) => {
    let publicationId = request.nextUrl.searchParams.get('publication_id')

    // Fall back to first active publication for public website callers
    if (!publicationId) {
      const { data: pub } = await supabaseAdmin
        .from('publications')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .single()

      if (!pub) {
        return NextResponse.json({ error: 'No active newsletter found' }, { status: 404 })
      }
      publicationId = pub.id
    }

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
