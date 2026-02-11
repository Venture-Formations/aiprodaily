import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type RouteParams = Promise<{ id: string; advertiserId: string }>

/**
 * PATCH /api/ad-modules/[id]/companies/[advertiserId]/next-position
 * Set the next_ad_position for a company within a module.
 * Body: { next_ad_position: number }
 */
export async function PATCH(
  request: NextRequest,
  segmentData: { params: RouteParams }
) {
  try {
    const params = await segmentData.params
    const moduleId = params.id
    const advertiserId = params.advertiserId
    const body = await request.json()
    const { next_ad_position } = body

    if (!next_ad_position || next_ad_position < 1) {
      return NextResponse.json(
        { success: false, error: 'next_ad_position must be at least 1' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('ad_module_advertisers')
      .update({
        next_ad_position,
        updated_at: new Date().toISOString()
      })
      .eq('ad_module_id', moduleId)
      .eq('advertiser_id', advertiserId)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    console.log(`[AdModules] Set next_ad_position=${next_ad_position} for company ${advertiserId} in module ${moduleId}`)

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('[AdModules] Failed to set next position:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to set next position', details: error.message },
      { status: 500 }
    )
  }
}
