import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'ads/reset-position', requirePublicationId: true },
  async ({ publicationId }) => {
    // Reset next_ad_position to 1 for this publication
    const { error } = await supabaseAdmin
      .from('publication_settings')
      .update({ value: '1', updated_at: new Date().toISOString() })
      .eq('publication_id', publicationId!)
      .eq('key', 'next_ad_position')

    if (error) throw error

    return NextResponse.json({ success: true, next_ad_position: 1 })
  }
)
