import { NextRequest, NextResponse } from 'next/server'
import { generateDailyRoadWork, storeRoadWorkItems } from '@/lib/road-work-manager'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  console.log('🚧 Starting road work data generation...')

  try {
    // Get campaign date from query parameters
    const { searchParams } = new URL(request.url)
    const campaignDate = searchParams.get('campaign_date')
    const targetDate = campaignDate || new Date().toISOString().split('T')[0]

    // Look up campaign ID - required, no fallback
    console.log(`Looking up campaign for date: ${targetDate}`)
    const { data: campaign, error } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id')
      .eq('date', targetDate)
      .single()

    if (error) {
      console.error(`Database error looking up campaign:`, error)
    }

    if (!campaign || error) {
      console.error(`No campaign found for date ${targetDate}`)
      return NextResponse.json({
        success: false,
        error: `No campaign found for date ${targetDate}`,
        message: 'Cannot generate road work data without valid campaign',
        debug: { targetDate, error: error?.message }
      }, { status: 404 })
    }

    const campaignId = campaign.id
    console.log(`Found campaign ID ${campaignId} for date ${targetDate}`)

    // Generate new road work data
    const roadWorkData = await generateDailyRoadWork(campaignDate || undefined)
    console.log('✅ Road work data generated successfully')

    // Store items in normalized database
    let storedItems = []
    if (roadWorkData.road_work_data && roadWorkData.road_work_data.length > 0) {
      console.log(`Storing ${roadWorkData.road_work_data.length} road work items in normalized database`)
      storedItems = await storeRoadWorkItems(roadWorkData.road_work_data, campaignId)
      console.log(`✅ Stored ${storedItems.length} items in normalized database`)
    }

    return NextResponse.json({
      success: true,
      message: 'Road work data generated and stored successfully',
      roadWork: {
        generated_at: roadWorkData.generated_at,
        total_items: roadWorkData.road_work_data.length,
        has_html: !!roadWorkData.html_content
      },
      roadWorkData: roadWorkData.road_work_data,
      normalized_storage: {
        items_stored: storedItems.length,
        campaign_id: campaignId
      }
    })

  } catch (error) {
    console.error('❌ Road work generation failed:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to generate road work data'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}