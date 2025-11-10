import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = new URL(request.url).searchParams
    const campaignId = searchParams.get('campaign_id')

    if (!campaignId) {
      return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
    }

    // Get secondary articles
    const { data: secondaryArticles, error: secondaryError } = await supabaseAdmin
      .from('secondary_articles')
      .select(`
        *,
        rss_post:rss_posts(
          id,
          title,
          post_rating:post_ratings(total_score)
        )
      `)
      .eq('campaign_id', campaignId)
      .order('rank', { ascending: true, nullsFirst: false })

    if (secondaryError) {
      return NextResponse.json({ error: secondaryError.message }, { status: 500 })
    }

    const activeCount = secondaryArticles?.filter(a => a.is_active).length || 0
    const totalCount = secondaryArticles?.length || 0

    return NextResponse.json({
      success: true,
      campaign_id: campaignId,
      total_secondary_articles: totalCount,
      active_secondary_articles: activeCount,
      articles: secondaryArticles?.map(a => ({
        id: a.id,
        headline: a.headline,
        is_active: a.is_active,
        rank: a.rank,
        fact_check_score: a.fact_check_score,
        rss_post_title: a.rss_post?.title,
        score: a.rss_post?.post_rating?.[0]?.total_score || 0
      })) || []
    })

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
