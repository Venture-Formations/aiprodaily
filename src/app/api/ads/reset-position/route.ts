import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'ads/reset-position' },
  async ({ logger }) => {
    // Get the first active newsletter for publication_id
    const { data: newsletter, error: newsletterError } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (newsletterError || !newsletter) {
      return NextResponse.json(
        { error: 'No active newsletter found' },
        { status: 404 }
      )
    }

    // Reset next_ad_position to 1 for this newsletter
    const { error } = await supabaseAdmin
      .from('publication_settings')
      .update({ value: '1', updated_at: new Date().toISOString() })
      .eq('publication_id', newsletter.id)
      .eq('key', 'next_ad_position')

    if (error) throw error

    return NextResponse.json({ success: true, next_ad_position: 1 })
  }
)
