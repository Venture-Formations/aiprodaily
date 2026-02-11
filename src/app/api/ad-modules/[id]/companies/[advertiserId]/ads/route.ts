import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type RouteParams = Promise<{ id: string; advertiserId: string }>

/**
 * POST /api/ad-modules/[id]/companies/[advertiserId]/ads/reorder
 * Reorder ads within a company for a specific module.
 * Body: { order: [{ id: string, display_order: number }] }
 *
 * Note: This route is at /ads instead of /ads/reorder because
 * Next.js routing uses the folder structure. The POST method handles reordering.
 */
export async function POST(
  request: NextRequest,
  segmentData: { params: RouteParams }
) {
  try {
    const params = await segmentData.params
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
  } catch (error: any) {
    console.error('[AdModules] Failed to reorder ads:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to reorder ads', details: error.message },
      { status: 500 }
    )
  }
}
