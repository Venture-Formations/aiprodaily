import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: campaignId } = await params

    // Fetch campaign dining deal selections
    const { data: selections, error } = await supabaseAdmin
      .from('campaign_dining_selections')
      .select(`
        *,
        dining_deal:dining_deals(*)
      `)
      .eq('campaign_id', campaignId)

    if (error) {
      console.error('Error fetching campaign dining selections:', error)

      // If table doesn't exist, return empty selections instead of error
      if (error.message && error.message.includes('relation "campaign_dining_selections" does not exist')) {
        console.log('campaign_dining_selections table does not exist, returning empty selections')
        return NextResponse.json({
          success: true,
          campaign_id: campaignId,
          selections: [],
          notice: 'Dining deals selection table not yet created'
        })
      }

      return NextResponse.json({ error: 'Failed to fetch selections' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      campaign_id: campaignId,
      selections: selections || []
    })

  } catch (error) {
    console.error('Error in campaign dining deals GET:', error)
    return NextResponse.json({
      error: 'Failed to fetch campaign dining selections',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: campaignId } = await params
    const body = await request.json()
    const { deal_ids, featured_deal_id } = body

    if (!Array.isArray(deal_ids)) {
      return NextResponse.json({ error: 'deal_ids must be an array' }, { status: 400 })
    }

    console.log('🔧 Updating dining deals for campaign:', campaignId)
    console.log('📝 Request data:', { deal_ids, featured_deal_id, deal_ids_type: typeof deal_ids, deal_ids_length: deal_ids?.length })

    // First, delete existing selections for this campaign
    const { error: deleteError } = await supabaseAdmin
      .from('campaign_dining_selections')
      .delete()
      .eq('campaign_id', campaignId)

    if (deleteError) {
      console.error('Error deleting existing selections:', deleteError)

      // If table doesn't exist, log warning but continue
      if (deleteError.message && deleteError.message.includes('relation "campaign_dining_selections" does not exist')) {
        console.log('⚠️ campaign_dining_selections table does not exist - dining deals selection will not be saved')
        return NextResponse.json({
          success: false,
          error: 'Dining deals selection table not yet created',
          message: 'Please create the campaign_dining_selections table in Supabase to enable dining deals selection',
          notice: 'Selections cannot be saved without the database table'
        }, { status: 400 })
      }

      return NextResponse.json({ error: 'Failed to clear existing selections' }, { status: 500 })
    }

    // Insert new selections
    if (deal_ids.length > 0) {
      const insertData = deal_ids.map((dealId: string, index: number) => ({
        campaign_id: campaignId,
        deal_id: dealId,
        selection_order: index + 1,
        is_featured_in_campaign: dealId === featured_deal_id
      }))

      console.log('💾 Attempting to insert data:', insertData)

      const { error: insertError } = await supabaseAdmin
        .from('campaign_dining_selections')
        .insert(insertData)

      if (insertError) {
        console.error('❌ Error inserting new selections:', insertError)
        console.error('📋 Insert data that failed:', insertData)
        return NextResponse.json({
          error: 'Failed to save selections',
          details: insertError.message,
          data: insertData
        }, { status: 500 })
      }

      console.log('✅ Successfully inserted dining deal selections')
    } else {
      console.log('📭 No deals to insert (empty selection)')
    }

    console.log('Successfully updated dining deals selections')

    return NextResponse.json({
      success: true,
      message: 'Dining deals updated successfully',
      campaign_id: campaignId,
      selected_count: deal_ids.length,
      featured_deal_id
    })

  } catch (error) {
    console.error('Error in campaign dining deals POST:', error)
    return NextResponse.json({
      error: 'Failed to update campaign dining selections',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}