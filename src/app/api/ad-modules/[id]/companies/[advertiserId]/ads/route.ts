import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withApiHandler } from '@/lib/api-handler'

/**
 * POST /api/ad-modules/[id]/companies/[advertiserId]/ads
 * Reorder ads within a company for a specific module.
 * Body: { order: [{ id: string, display_order: number }] }
 */
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'ad-modules/[id]/companies/[advertiserId]/ads' },
  async ({ params, request }) => {
    const moduleId = params.id
    const advertiserId = params.advertiserId
    const body = await request.json()
    const { order } = body

    if (!Array.isArray(order) || order.length === 0) {
      return NextResponse.json(
        { success: false, error: 'order array is required' },
        { status: 400 }
      )
    }

    // Update each ad's display_order
    for (const item of order) {
      const { error } = await supabaseAdmin
        .from('advertisements')
        .update({
          display_order: item.display_order,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id)
        .eq('ad_module_id', moduleId)
        .eq('advertiser_id', advertiserId)

      if (error) {
        console.error(`[AdModules] Error reordering ad ${item.id}:`, error)
      }
    }

    console.log(`[AdModules] Reordered ${order.length} ads for company ${advertiserId} in module ${moduleId}`)

    return NextResponse.json({ success: true })
  }
)
