import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'ads/[id]/activate' },
  async ({ params }) => {
    const id = params.id

    // Get all active ads to determine next display_order
    const { data: activeAds, error: fetchError } = await supabaseAdmin
      .from('advertisements')
      .select('display_order')
      .eq('status', 'active')
      .not('display_order', 'is', null)
      .order('display_order', { ascending: false })
      .limit(1)

    if (fetchError) throw fetchError

    // Calculate next display_order
    const nextOrder = activeAds && activeAds.length > 0
      ? (activeAds[0].display_order || 0) + 1
      : 1

    // Update ad to active status with next display_order
    const { error } = await supabaseAdmin
      .from('advertisements')
      .update({
        status: 'active',
        display_order: nextOrder,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true, display_order: nextOrder })
  }
)
