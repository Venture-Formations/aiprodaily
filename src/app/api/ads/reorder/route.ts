import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'ads/reorder' },
  async ({ request, logger }) => {
    const { updates } = await request.json()

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({ error: 'Invalid updates array' }, { status: 400 })
    }

    // Update each ad's display_order
    for (const update of updates) {
      const { error } = await supabaseAdmin
        .from('advertisements')
        .update({ display_order: update.display_order })
        .eq('id', update.id)

      if (error) {
        logger.error({ adId: update.id, err: error }, 'Error updating ad order')
        throw error
      }
    }

    return NextResponse.json({ success: true })
  }
)
