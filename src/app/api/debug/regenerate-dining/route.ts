import { NextRequest, NextResponse } from 'next/server'
import { validateDebugAuth } from '@/lib/debug-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { selectDiningDealsForCampaign } from '@/lib/dining-selector'

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

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    console.log(`Regenerating dining deals for campaign ${campaignId} (${campaign.date})`)

    // Clear existing dining deal selections
    const { error: deleteError } = await supabaseAdmin
      .from('campaign_dining_selections')
      .delete()
      .eq('campaign_id', campaignId)

    if (deleteError) {
      console.error('Error clearing existing dining selections:', deleteError)
      return NextResponse.json({ error: 'Failed to clear existing dining selections' }, { status: 500 })
    }

    console.log('Cleared existing dining selections')

    // Regenerate dining deals with fresh randomization
    const campaignDate = new Date(campaign.date + 'T00:00:00')
    const result = await selectDiningDealsForCampaign(campaignId, campaignDate)

    console.log('Dining deals regeneration result:', result.message)

    return NextResponse.json({
      success: true,
      message: 'Dining deals regenerated with fresh randomization',
      campaign: {
        id: campaign.id,
        date: campaign.date,
        status: campaign.status
      },
      result: {
        dealCount: result.deals.length,
        message: result.message,
        dealOrder: result.deals.map((deal, index) => ({
          order: index + 1,
          business: deal.business_name,
          description: deal.special_description,
          featured: deal.is_featured
        }))
      }
    })

  } catch (error) {
    console.error('Dining deals regeneration error:', error)
    return NextResponse.json({
      error: 'Failed to regenerate dining deals',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}