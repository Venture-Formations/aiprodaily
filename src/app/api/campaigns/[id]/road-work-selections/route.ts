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

    // Fetch campaign road work selections
    const { data: selections, error } = await supabaseAdmin
      .from('campaign_road_work_selections')
      .select(`
        *,
        road_work_item:road_work_items(*)
      `)
      .eq('campaign_id', campaignId)
      .order('selection_order', { ascending: true })

    if (error) {
      console.error('Error fetching campaign road work selections:', error)

      // If table doesn't exist, return empty selections instead of error
      if (error.message && error.message.includes('relation "campaign_road_work_selections" does not exist')) {
        console.log('campaign_road_work_selections table does not exist, returning empty selections')
        return NextResponse.json({
          success: true,
          campaign_id: campaignId,
          selections: [],
          notice: 'Road work selection table not yet created'
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
    console.error('Error in campaign road work GET:', error)
    return NextResponse.json({
      error: 'Failed to fetch campaign road work selections',
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
    const { item_ids } = body

    if (!Array.isArray(item_ids)) {
      return NextResponse.json({ error: 'item_ids must be an array' }, { status: 400 })
    }

    console.log('🔧 Updating road work selections for campaign:', campaignId)
    console.log('📝 Request data:', { item_ids, item_ids_length: item_ids?.length })

    // First, delete existing selections for this campaign
    const { error: deleteError } = await supabaseAdmin
      .from('campaign_road_work_selections')
      .delete()
      .eq('campaign_id', campaignId)

    if (deleteError) {
      console.error('Error deleting existing selections:', deleteError)

      // If table doesn't exist, log warning but continue
      if (deleteError.message && deleteError.message.includes('relation "campaign_road_work_selections" does not exist')) {
        console.log('⚠️ campaign_road_work_selections table does not exist - road work selection will not be saved')
        return NextResponse.json({
          success: false,
          error: 'Road work selection table not yet created',
          message: 'Please create the campaign_road_work_selections table in Supabase to enable road work selection',
          notice: 'Selections cannot be saved without the database table'
        }, { status: 400 })
      }

      return NextResponse.json({ error: 'Failed to clear existing selections' }, { status: 500 })
    }

    // Insert new selections
    if (item_ids.length > 0) {
      const insertData = item_ids.map((itemId: string, index: number) => ({
        campaign_id: campaignId,
        road_work_item_id: itemId,
        selection_order: index + 1
      }))

      console.log('💾 Attempting to insert data:', insertData)

      const { error: insertError } = await supabaseAdmin
        .from('campaign_road_work_selections')
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

      console.log('✅ Successfully inserted road work selections')
    } else {
      console.log('📭 No road work items to insert (empty selection)')
    }

    console.log('Successfully updated road work selections')

    return NextResponse.json({
      success: true,
      message: 'Road work selections updated successfully',
      campaign_id: campaignId,
      selected_count: item_ids.length
    })

  } catch (error) {
    console.error('Error in campaign road work POST:', error)
    return NextResponse.json({
      error: 'Failed to update campaign road work selections',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
