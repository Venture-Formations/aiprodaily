import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Debug endpoint to assign a specific ad to a campaign for testing
 * Does NOT update ad usage statistics
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { campaignId, adId } = body

    if (!campaignId || !adId) {
      return NextResponse.json(
        { error: 'Missing campaignId or adId' },
        { status: 400 }
      )
    }

    // Get campaign date
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('date')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found', details: campaignError },
        { status: 404 }
      )
    }

    // Check if already assigned
    const { data: existing } = await supabaseAdmin
      .from('campaign_advertisements')
      .select('id')
      .eq('campaign_id', campaignId)
      .maybeSingle()

    if (existing) {
      // Update existing assignment
      const { error: updateError } = await supabaseAdmin
        .from('campaign_advertisements')
        .update({
          advertisement_id: adId,
          campaign_date: campaign.date,
          used_at: new Date().toISOString()
        })
        .eq('campaign_id', campaignId)

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update assignment', details: updateError },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Updated existing ad assignment (no usage stats changed)',
        campaignId,
        adId
      })
    } else {
      // Insert new assignment
      const { error: insertError } = await supabaseAdmin
        .from('campaign_advertisements')
        .insert({
          campaign_id: campaignId,
          advertisement_id: adId,
          campaign_date: campaign.date,
          used_at: new Date().toISOString()
        })

      if (insertError) {
        return NextResponse.json(
          { error: 'Failed to insert assignment', details: insertError },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Created new ad assignment (no usage stats changed)',
        campaignId,
        adId
      })
    }
  } catch (error) {
    console.error('Error assigning test ad:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
