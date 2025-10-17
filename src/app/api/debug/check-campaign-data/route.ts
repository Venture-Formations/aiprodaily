import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const campaignId = url.searchParams.get('campaign_id')

    if (!campaignId) {
      return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
    }

    console.log('Fetching campaign data for:', campaignId)

    // Test 1: Check campaign_ai_app_selections table directly
    const { data: selections, error: selectionsError } = await supabaseAdmin
      .from('campaign_ai_app_selections')
      .select('*')
      .eq('campaign_id', campaignId)

    console.log('Direct selections query:', selections?.length || 0, 'results')
    if (selectionsError) {
      console.error('Selections error:', selectionsError)
    }

    // Test 2: Check with join to ai_applications
    const { data: selectionsWithApps, error: joinError } = await supabaseAdmin
      .from('campaign_ai_app_selections')
      .select('*, app:ai_applications(*)')
      .eq('campaign_id', campaignId)

    console.log('Selections with apps join:', selectionsWithApps?.length || 0, 'results')
    if (joinError) {
      console.error('Join error:', joinError)
    }

    // Test 3: Full campaign query (same as campaign detail page)
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select(`
        *,
        articles:articles(
          *,
          rss_post:rss_posts(
            *,
            post_rating:post_ratings(*),
            rss_feed:rss_feeds(*)
          )
        ),
        secondary_articles:secondary_articles(
          *,
          rss_post:rss_posts(
            *,
            post_rating:post_ratings(*),
            rss_feed:rss_feeds(*)
          )
        ),
        manual_articles:manual_articles(*),
        email_metrics(*),
        campaign_ai_app_selections(
          *,
          app:ai_applications(*)
        )
      `)
      .eq('id', campaignId)
      .single()

    console.log('Full campaign query:', {
      found: !!campaign,
      ai_apps_count: campaign?.campaign_ai_app_selections?.length || 0
    })

    if (campaignError) {
      console.error('Campaign error:', campaignError)
    }

    return NextResponse.json({
      success: true,
      campaign_id: campaignId,
      test_results: {
        direct_selections: {
          count: selections?.length || 0,
          error: selectionsError?.message || null,
          data: selections
        },
        selections_with_apps: {
          count: selectionsWithApps?.length || 0,
          error: joinError?.message || null,
          data: selectionsWithApps
        },
        full_campaign: {
          found: !!campaign,
          ai_apps_count: campaign?.campaign_ai_app_selections?.length || 0,
          error: campaignError?.message || null,
          ai_apps: campaign?.campaign_ai_app_selections
        }
      }
    })

  } catch (error) {
    console.error('Check campaign data error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
