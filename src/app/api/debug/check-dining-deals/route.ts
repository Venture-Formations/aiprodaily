import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
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

    // Get dining deal selections for this campaign
    const { data: selections, error: selectionsError } = await supabaseAdmin
      .from('campaign_dining_selections')
      .select(`
        *,
        deal:dining_deals(
          id,
          business_name,
          special_description,
          day_of_week,
          is_featured,
          created_at
        )
      `)
      .eq('campaign_id', campaignId)
      .order('selection_order')

    if (selectionsError) {
      return NextResponse.json({ error: selectionsError.message }, { status: 500 })
    }

    // Get the campaign date day of week
    const campaignDate = new Date(campaign.date + 'T00:00:00')
    const dayOfWeek = campaignDate.toLocaleDateString('en-US', { weekday: 'long' })

    // Get all available dining deals for this day of week for comparison
    const { data: availableDeals, error: availableError } = await supabaseAdmin
      .from('dining_deals')
      .select('*')
      .eq('active', true)
      .eq('day_of_week', dayOfWeek)
      .order('business_name')

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        date: campaign.date,
        dayOfWeek: dayOfWeek,
        status: campaign.status
      },
      selections: {
        count: selections?.length || 0,
        deals: selections?.map(s => ({
          selectionOrder: s.selection_order,
          isFeaturedInCampaign: s.is_featured_in_campaign,
          businessName: s.deal.business_name,
          specialDescription: s.deal.special_description,
          isFeaturedInDB: s.deal.is_featured,
          dealId: s.deal.id
        })) || []
      },
      available: {
        count: availableDeals?.length || 0,
        totalFeatured: availableDeals?.filter(d => d.is_featured).length || 0,
        deals: availableDeals?.map(d => ({
          id: d.id,
          businessName: d.business_name,
          specialDescription: d.special_description,
          isFeatured: d.is_featured
        })) || []
      },
      analysis: {
        hasSelections: (selections?.length || 0) > 0,
        expectedDayOfWeek: dayOfWeek,
        selectionOrderMatches: selections?.every((s, index) => s.selection_order === index + 1) || false
      }
    })

  } catch (error) {
    console.error('Debug dining deals error:', error)
    return NextResponse.json({
      error: 'Failed to check dining deals',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}