import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type RouteParams = Promise<{ id: string }>

/**
 * POST /api/ad-modules/[id]/companies/reorder
 * Reorder companies (advertisers) within a module.
 * Body: { order: [{ advertiser_id: string, display_order: number }] }
 */
export async function POST(
  request: NextRequest,
  segmentData: { params: RouteParams }
) {
  try {
    const params = await segmentData.params
    const moduleId = params.id
    const body = await request.json()
    const { order } = body

    if (!Array.isArray(order) || order.length === 0) {
      return NextResponse.json(
        { success: false, error: 'order array is required' },
        { status: 400 }
      )
    }

    // Update each junction entry's display_order
    for (const item of order) {
      const { error } = await supabaseAdmin
        .from('ad_module_advertisers')
        .update({
          display_order: item.display_order,
          updated_at: new Date().toISOString()
        })
        .eq('ad_module_id', moduleId)
        .eq('advertiser_id', item.advertiser_id)

      if (error) {
        console.error(`[AdModules] Error reordering company ${item.advertiser_id}:`, error)
      }
    }

    console.log(`[AdModules] Reordered ${order.length} companies in module ${moduleId}`)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[AdModules] Failed to reorder companies:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to reorder companies', details: error.message },
      { status: 500 }
    )
  }
}
