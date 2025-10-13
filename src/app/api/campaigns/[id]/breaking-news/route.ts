import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type RouteParams = {
  params: Promise<{ id: string }>
}

/**
 * GET /api/campaigns/[id]/breaking-news
 * Fetch Breaking News articles for a campaign
 */
export async function GET(request: NextRequest, props: RouteParams) {
  try {
    const params = await props.params
    const campaignId = params.id

    // Fetch RSS posts with Breaking News scores for this campaign
    const { data: posts, error: postsError } = await supabaseAdmin
      .from('rss_posts')
      .select('*')
      .eq('campaign_id', campaignId)
      .not('breaking_news_score', 'is', null)
      .order('breaking_news_score', { ascending: false })

    if (postsError) {
      console.error('Error fetching Breaking News posts:', postsError)
      return NextResponse.json({
        success: false,
        error: postsError.message
      }, { status: 500 })
    }

    // Fetch selected Breaking News articles from campaign_breaking_news table
    const { data: selections, error: selectionsError } = await supabaseAdmin
      .from('campaign_breaking_news')
      .select('*')
      .eq('campaign_id', campaignId)

    const selectedBreaking = selections?.filter(s => s.section === 'breaking').map(s => s.post_id) || []
    const selectedBeyondFeed = selections?.filter(s => s.section === 'beyond_feed').map(s => s.post_id) || []

    return NextResponse.json({
      success: true,
      articles: posts || [],
      selectedBreaking,
      selectedBeyondFeed
    })

  } catch (error) {
    console.error('Error in GET /api/campaigns/[id]/breaking-news:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * POST /api/campaigns/[id]/breaking-news
 * Update Breaking News article selections for a campaign
 */
export async function POST(request: NextRequest, props: RouteParams) {
  try {
    const params = await props.params
    const campaignId = params.id
    const body = await request.json()
    const { breaking, beyond_feed } = body

    // Delete existing selections
    await supabaseAdmin
      .from('campaign_breaking_news')
      .delete()
      .eq('campaign_id', campaignId)

    // Insert new selections
    const insertions = [
      ...breaking.map((postId: string, index: number) => ({
        campaign_id: campaignId,
        post_id: postId,
        section: 'breaking',
        position: index + 1
      })),
      ...beyond_feed.map((postId: string, index: number) => ({
        campaign_id: campaignId,
        post_id: postId,
        section: 'beyond_feed',
        position: index + 1
      }))
    ]

    if (insertions.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('campaign_breaking_news')
        .insert(insertions)

      if (insertError) {
        console.error('Error inserting Breaking News selections:', insertError)
        return NextResponse.json({
          success: false,
          error: insertError.message
        }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Breaking News selections updated'
    })

  } catch (error) {
    console.error('Error in POST /api/campaigns/[id]/breaking-news:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
