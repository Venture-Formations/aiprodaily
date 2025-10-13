import { NextRequest, NextResponse } from 'next/server'
import { validateDebugAuth } from '@/lib/debug-auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  // Validate authentication
  const authResult = validateDebugAuth(request)
  if (!authResult.authorized) {
    return authResult.response
  }

  try {
    console.log('=== CLEARING CAMPAIGN EVENTS ===')

    const body = await request.json().catch(() => ({}))
    const { campaignId } = body

    if (!campaignId) {
      return NextResponse.json({
        success: false,
        error: 'Campaign ID is required'
      }, { status: 400 })
    }

    // Delete all existing campaign events
    const { error: deleteError } = await supabaseAdmin
      .from('campaign_events')
      .delete()
      .eq('campaign_id', campaignId)

    if (deleteError) {
      throw new Error(`Failed to clear campaign events: ${deleteError.message}`)
    }

    console.log('Successfully cleared all events for campaign:', campaignId)

    return NextResponse.json({
      success: true,
      message: 'Successfully cleared all campaign events',
      campaignId,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Clear campaign events error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}