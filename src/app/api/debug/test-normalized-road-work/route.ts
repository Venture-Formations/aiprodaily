import { NextResponse } from 'next/server'
import { getRoadWorkItemsForCampaign, storeRoadWorkItems } from '@/lib/road-work-manager'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id') || 'c9da768c-588b-4ca2-ba7f-5553a32a7298'

    console.log('Testing normalized road work database for campaign:', campaignId)

    // Check if there are existing road work items for this campaign
    const existingItems = await getRoadWorkItemsForCampaign(campaignId)
    console.log('Existing road work items:', existingItems.length)

    if (existingItems.length === 0) {
      // Test storing some sample road work items
      const sampleItems = [
        {
          road_name: 'Highway 15',
          road_range: 'from 2nd Street to Division Street',
          city_or_township: 'St. Cloud',
          reason: 'Bridge maintenance test',
          start_date: '2025-09-29',
          expected_reopen: '2025-10-15',
          source_url: 'https://www.dot.state.mn.us/d3/'
        },
        {
          road_name: 'County Road 8',
          road_range: 'from 9th Avenue to County Road 43',
          city_or_township: 'St. Joseph',
          reason: 'Resurfacing project test',
          start_date: '2025-09-29',
          expected_reopen: '2025-10-08',
          source_url: 'https://www.co.benton.mn.us/180/Highway'
        }
      ]

      console.log('Storing sample road work items...')
      const storedItems = await storeRoadWorkItems(sampleItems, campaignId)
      console.log('Stored items:', storedItems.length)

      return NextResponse.json({
        success: true,
        message: 'Stored sample road work items in normalized database',
        campaign_id: campaignId,
        items_stored: storedItems.length,
        stored_items: storedItems
      })
    } else {
      return NextResponse.json({
        success: true,
        message: 'Found existing road work items in normalized database',
        campaign_id: campaignId,
        existing_items_count: existingItems.length,
        existing_items: existingItems
      })
    }

  } catch (error) {
    console.error('Error testing normalized road work database:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}