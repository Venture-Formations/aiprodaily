import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type RouteParams = Promise<{ id: string }>

/**
 * GET /api/advertisers/[id] - Get specific advertiser with their ads
 */
export async function GET(
  request: NextRequest,
  segmentData: { params: RouteParams }
) {
  try {
    const params = await segmentData.params
    const { id } = params

    const { data: advertiser, error } = await supabaseAdmin
      .from('advertisers')
      .select(`
        *,
        ads:advertisements(
          id,
          title,
          status,
          times_used,
          last_used_date,
          ad_module:ad_modules(id, name)
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Advertiser not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      advertiser
    })

  } catch (error: any) {
    console.error('[Advertisers] Failed to fetch:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch advertiser', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/advertisers/[id] - Update advertiser
 */
export async function PATCH(
  request: NextRequest,
  segmentData: { params: RouteParams }
) {
  try {
    const params = await segmentData.params
    const { id } = params
    const body = await request.json()

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (body.company_name !== undefined) updates.company_name = body.company_name
    if (body.contact_email !== undefined) updates.contact_email = body.contact_email
    if (body.contact_name !== undefined) updates.contact_name = body.contact_name
    if (body.logo_url !== undefined) updates.logo_url = body.logo_url
    if (body.website_url !== undefined) updates.website_url = body.website_url
    if (body.notes !== undefined) updates.notes = body.notes
    if (body.is_active !== undefined) updates.is_active = body.is_active

    const { data: advertiser, error } = await supabaseAdmin
      .from('advertisers')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    console.log(`[Advertisers] Updated: ${advertiser.company_name}`)

    return NextResponse.json({
      success: true,
      advertiser
    })

  } catch (error: any) {
    console.error('[Advertisers] Failed to update:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update advertiser', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/advertisers/[id] - Delete advertiser
 * Note: This will CASCADE delete all ads for this advertiser
 */
export async function DELETE(
  request: NextRequest,
  segmentData: { params: RouteParams }
) {
  try {
    const params = await segmentData.params
    const { id } = params

    // Get advertiser info and ad count for logging
    const { data: advertiser } = await supabaseAdmin
      .from('advertisers')
      .select('company_name')
      .eq('id', id)
      .single()

    const { count } = await supabaseAdmin
      .from('advertisements')
      .select('id', { count: 'exact', head: true })
      .eq('advertiser_id', id)

    // Delete advertiser (CASCADE will delete all ads)
    const { error } = await supabaseAdmin
      .from('advertisers')
      .delete()
      .eq('id', id)

    if (error) throw error

    console.log(`[Advertisers] Deleted: ${advertiser?.company_name} and ${count || 0} ads`)

    return NextResponse.json({
      success: true,
      message: 'Advertiser deleted successfully',
      deleted_ads: count || 0
    })

  } catch (error: any) {
    console.error('[Advertisers] Failed to delete:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete advertiser', details: error.message },
      { status: 500 }
    )
  }
}
