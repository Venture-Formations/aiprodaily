import { NextRequest, NextResponse } from 'next/server'
import { validateDebugAuth } from '@/lib/debug-auth'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  // Validate authentication
  const authResult = validateDebugAuth(request)
  if (!authResult.authorized) {
    return authResult.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id')

    if (!campaignId) {
      return NextResponse.json({ error: 'campaign_id parameter required' }, { status: 400 })
    }

    console.log('=== STATUS UPDATE DEBUG ===')
    console.log('Campaign ID:', campaignId)

    // Check session
    const session = await getServerSession(authOptions)
    console.log('Session:', {
      exists: !!session,
      user: session?.user?.email || 'none'
    })

    if (!session) {
      return NextResponse.json({ error: 'No session found' }, { status: 401 })
    }

    // Check if campaign exists
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    console.log('Campaign lookup:', {
      found: !!campaign,
      error: campaignError?.message || 'none',
      status: campaign?.status || 'none'
    })

    if (campaignError) {
      return NextResponse.json({
        error: 'Campaign lookup failed',
        details: campaignError.message,
        code: campaignError.code
      }, { status: 500 })
    }

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Test the update operation
    console.log('Testing status update...')
    const { error: updateError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .update({
        status: 'changes_made',
        last_action: 'changes_made',
        last_action_at: new Date().toISOString(),
        last_action_by: session.user?.email || 'unknown'
      })
      .eq('id', campaignId)

    console.log('Update result:', {
      success: !updateError,
      error: updateError?.message || 'none',
      code: updateError?.code || 'none'
    })

    if (updateError) {
      return NextResponse.json({
        error: 'Update failed',
        details: updateError.message,
        code: updateError.code,
        hint: updateError.hint || 'none'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Status update test completed successfully',
      campaign: {
        id: campaignId,
        current_status: campaign.status,
        updated_status: 'changes_made'
      }
    })

  } catch (error) {
    console.error('Debug test failed:', error)
    return NextResponse.json({
      error: 'Debug test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'none'
    }, { status: 500 })
  }
}