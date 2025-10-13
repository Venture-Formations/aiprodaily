import { NextRequest, NextResponse } from 'next/server'
import { validateDebugAuth } from '@/lib/debug-auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  // Validate authentication
  const authResult = validateDebugAuth(request)
  if (!authResult.authorized) {
    return authResult.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id') || 'c9da768c-588b-4ca2-ba7f-5553a32a7298'

    console.log('Clearing road work items for campaign:', campaignId)

    // Delete existing road work items for this campaign
    const { error, count } = await supabaseAdmin
      .from('road_work_items')
      .delete({ count: 'exact' })
      .eq('campaign_id', campaignId)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: `Cleared road work items for campaign ${campaignId}`,
      campaign_id: campaignId,
      deleted_count: count || 0
    })

  } catch (error) {
    console.error('Error clearing road work items:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}