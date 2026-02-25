import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'settings/header-image' },
  async () => {
    // Get user's publication_id (use first active newsletter for now)
    const { data: newsletter } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!newsletter) {
      return NextResponse.json({ error: 'No active newsletter found' }, { status: 404 })
    }

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
