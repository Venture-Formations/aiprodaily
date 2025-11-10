import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Debug endpoint to check campaign advertisement data
 *
 * Usage: GET /api/debug/check-campaign-ad?campaign_id=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id')

    if (!campaignId) {
      return NextResponse.json({
        error: 'campaign_id parameter required'
      }, { status: 400 })
    }

    // Check campaign exists
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, date, status, newsletter_id')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({
        error: 'Campaign not found',
        details: campaignError
      }, { status: 404 })
    }

    // Check campaign_advertisements records
    const { data: campaignAds, error: adsError } = await supabaseAdmin
      .from('campaign_advertisements')
      .select('*')
      .eq('campaign_id', campaignId)

    console.log(`[Check Ad] Found ${campaignAds?.length || 0} campaign_advertisements records`)

    // Check with nested advertisement
    const { data: campaignAdsNested, error: nestedError } = await supabaseAdmin
      .from('campaign_advertisements')
      .select('*, advertisement:advertisements(*)')
      .eq('campaign_id', campaignId)

    console.log(`[Check Ad] Nested query returned ${campaignAdsNested?.length || 0} records`)

    // Test the exact query the dashboard uses
    const { data: fullCampaign, error: fullError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select(`
        id,
        date,
        status,
        campaign_advertisements(
          *,
          advertisement:advertisements(*)
        )
      `)
      .eq('id', campaignId)
      .single()

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        date: campaign.date,
        status: campaign.status,
        newsletter_id: campaign.newsletter_id
      },
      campaign_advertisements_count: campaignAds?.length || 0,
      campaign_advertisements: campaignAds,
      nested_query_error: nestedError?.message,
      nested_query_result: campaignAdsNested,
      full_dashboard_query_error: fullError?.message,
      full_dashboard_query: fullCampaign?.campaign_advertisements
    })

  } catch (error) {
    console.error('[Check Ad] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export const maxDuration = 60
