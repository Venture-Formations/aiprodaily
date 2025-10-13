import { NextRequest, NextResponse } from 'next/server'
import { getRoadWorkItemsForCampaign } from '@/lib/road-work-manager'

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params
    console.log('Fetching normalized road work items for campaign:', id)

    // Get road work items from normalized database
    const roadWorkItems = await getRoadWorkItemsForCampaign(id)

    return NextResponse.json({
      success: true,
      campaign_id: id,
      total_items: roadWorkItems.length,
      roadWorkItems: roadWorkItems,
      generated_at: roadWorkItems.length > 0 ? roadWorkItems[0].created_at : new Date().toISOString(),
      source: 'normalized_database'
    })

  } catch (error) {
    console.error('Failed to fetch road work items for campaign:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}