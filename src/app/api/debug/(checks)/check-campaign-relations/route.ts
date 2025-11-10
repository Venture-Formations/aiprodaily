import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Debug endpoint to check what's preventing campaign deletion
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id')

    if (!campaignId) {
      return NextResponse.json({
        error: 'campaign_id parameter required'
      }, { status: 400 })
    }

    console.log(`Checking relations for campaign: ${campaignId}`)

    const results: Record<string, any> = {}

    // Check all tables that might reference this campaign
    const tables = [
      'campaign_events',
      'articles',
      'rss_posts',
      'road_work_data',
      'user_activities',
      'archived_articles',
      'archived_rss_posts'
    ]

    for (const table of tables) {
      try {
        const { data, error, count } = await supabaseAdmin
          .from(table)
          .select('*', { count: 'exact', head: false })
          .eq('campaign_id', campaignId)

        if (error) {
          results[table] = { error: error.message, code: error.code }
        } else {
          results[table] = {
            count: count || data?.length || 0,
            sample: data?.slice(0, 2) || [] // Show first 2 records
          }
        }
      } catch (err) {
        results[table] = {
          error: err instanceof Error ? err.message : 'Unknown error',
          note: 'Table might not exist or column name different'
        }
      }
    }

    // Check the campaign itself
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    return NextResponse.json({
      success: true,
      campaign_id: campaignId,
      campaign: campaign || { error: campaignError?.message },
      related_data: results,
      summary: {
        tables_with_data: Object.entries(results)
          .filter(([_, data]) => !data.error && data.count > 0)
          .map(([table, data]) => `${table}: ${data.count} records`)
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error checking campaign relations:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
