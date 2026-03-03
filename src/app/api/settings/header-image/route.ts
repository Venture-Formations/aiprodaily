import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'settings/header-image' },
  async ({ request }) => {
    const publicationId = request.nextUrl.searchParams.get('publication_id')
    if (!publicationId) {
      return NextResponse.json({ error: 'publication_id is required' }, { status: 400 })
    }

    const newsletter = { id: publicationId }

    const { data: settings } = await supabaseAdmin
      .from('publication_settings')
      .select('value')
      .eq('key', 'header_image_url')
      .eq('publication_id', newsletter.id)
      .single()

    return NextResponse.json({
      success: true,
      headerImageUrl: settings?.value || '/logo.png'
    })
  }
)
