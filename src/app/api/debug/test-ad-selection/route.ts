import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { AdScheduler } from '@/lib/ad-scheduler'

/**
 * Debug endpoint to test advertisement selection and recording
 *
 * Usage:
 * POST /api/debug/test-ad-selection
 * Body: { campaign_id: "uuid", date: "2025-11-07" }
 *
 * Or create a test campaign:
 * POST /api/debug/test-ad-selection?create_test=true
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const createTest = searchParams.get('create_test') === 'true'

    let body
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    let campaignId = body.campaign_id
    let date = body.date || new Date().toISOString().split('T')[0]

    // Create a test campaign if requested
    if (createTest || !campaignId) {
      console.log('[Test Ad] Creating test campaign...')

      // Get newsletter ID
      const { data: newsletter } = await supabaseAdmin
        .from('newsletters')
        .select('id')
        .eq('slug', 'accounting')
        .single()

      if (!newsletter) {
        return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 })
      }

      const { data: testCampaign, error: createError } = await supabaseAdmin
        .from('newsletter_campaigns')
        .insert([{
          date: date,
          status: 'draft',
          newsletter_id: newsletter.id
        }])
        .select('id')
        .single()

      if (createError || !testCampaign) {
        return NextResponse.json({
          error: 'Failed to create test campaign',
          details: createError
        }, { status: 500 })
      }

      campaignId = testCampaign.id
      console.log(`[Test Ad] Created test campaign: ${campaignId}`)
    }

    // Get newsletter_id from campaign
    const { data: campaign } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('newsletter_id')
      .eq('id', campaignId)
      .single()

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Test ad selection
    console.log(`[Test Ad] Testing ad selection for campaign: ${campaignId}`)

    const selectedAd = await AdScheduler.selectAdForCampaign({
      campaignId: campaignId,
      campaignDate: date,
      newsletterId: campaign.newsletter_id
    })

    if (!selectedAd) {
      return NextResponse.json({
        success: false,
        message: 'No advertisement available',
        campaign_id: campaignId,
        date: date
      })
    }

    console.log(`[Test Ad] Selected ad: ${selectedAd.title} (ID: ${selectedAd.id})`)

    // Test ad recording
    try {
      await AdScheduler.recordAdUsage(campaignId, selectedAd.id, date, campaign.newsletter_id)
      console.log('[Test Ad] Successfully recorded ad usage')
    } catch (recordError) {
      console.error('[Test Ad] Failed to record ad usage:', recordError)
      return NextResponse.json({
        success: false,
        error: 'Failed to record ad usage',
        details: recordError,
        selected_ad: {
          id: selectedAd.id,
          title: selectedAd.title,
          display_order: selectedAd.display_order
        },
        campaign_id: campaignId,
        newsletter_id: campaign.newsletter_id
      }, { status: 500 })
    }

    // Verify the ad was recorded (get most recent)
    const { data: verification, error: verifyError } = await supabaseAdmin
      .from('campaign_advertisements')
      .select('*, advertisement:advertisements(*)')
      .eq('campaign_id', campaignId)
      .order('used_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (verifyError) {
      console.error('[Test Ad] Verification failed:', verifyError)
    }

    // Check next_ad_position was updated
    const { data: nextPosition } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('newsletter_id', campaign.newsletter_id)
      .eq('key', 'next_ad_position')
      .maybeSingle()

    return NextResponse.json({
      success: true,
      message: 'Advertisement selection and recording successful',
      campaign_id: campaignId,
      date: date,
      selected_ad: {
        id: selectedAd.id,
        title: selectedAd.title,
        display_order: selectedAd.display_order,
        status: selectedAd.status
      },
      verification: {
        recorded: !!verification,
        error: verifyError?.message
      },
      next_ad_position: nextPosition?.value,
      test_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/accounting/campaigns/${campaignId}`
    })

  } catch (error) {
    console.error('[Test Ad] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error
    }, { status: 500 })
  }
}

export const maxDuration = 60
