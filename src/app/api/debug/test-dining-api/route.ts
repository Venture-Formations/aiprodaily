import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const campaignId = 'c94eff9d-c316-4f18-91fb-1ad0c6ede5fc' // The campaign from the logs

    console.log('🔍 Testing dining deals API for campaign:', campaignId)

    // Test 1: Check if campaign_dining_selections table exists and has data
    const { data: selections, error: selectionsError } = await supabaseAdmin
      .from('campaign_dining_selections')
      .select('*')
      .eq('campaign_id', campaignId)

    console.log('📊 Campaign dining selections query result:', { selections, selectionsError })

    // Test 2: Check if dining_deals table exists
    const { data: allDeals, error: dealsError } = await supabaseAdmin
      .from('dining_deals')
      .select('*')
      .limit(5)

    console.log('🍽️ Dining deals table sample:', { allDeals, dealsError })

    // Test 3: Try the exact query from the API
    const { data: joinQuery, error: joinError } = await supabaseAdmin
      .from('campaign_dining_selections')
      .select(`
        *,
        dining_deal:dining_deals(*)
      `)
      .eq('campaign_id', campaignId)

    console.log('🔗 Join query result:', { joinQuery, joinError })

    return NextResponse.json({
      success: true,
      debug: {
        campaignId,
        tests: {
          selectionsTable: {
            data: selections,
            error: selectionsError,
            count: selections?.length || 0
          },
          dealsTable: {
            data: allDeals,
            error: dealsError,
            count: allDeals?.length || 0
          },
          joinQuery: {
            data: joinQuery,
            error: joinError,
            count: joinQuery?.length || 0
          }
        }
      }
    })

  } catch (error) {
    console.error('🚨 Debug dining API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}