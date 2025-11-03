import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id')

    if (!campaignId) {
      return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
    }

    // Get all posts
    const { data: allPosts, count: totalPosts } = await supabaseAdmin
      .from('rss_posts')
      .select('id, title, post_ratings(total_score)', { count: 'exact' })
      .eq('campaign_id', campaignId)

    // Get posts with ratings
    const postsWithRatings = allPosts?.filter(p => p.post_ratings && p.post_ratings.length > 0) || []

    // Get duplicates (two-step query for proper filtering)
    const { data: duplicateGroups } = await supabaseAdmin
      .from('duplicate_groups')
      .select('id')
      .eq('campaign_id', campaignId)

    const groupIds = duplicateGroups?.map(g => g.id) || []

    let duplicateIds = new Set<string>()
    if (groupIds.length > 0) {
      const { data: duplicates } = await supabaseAdmin
        .from('duplicate_posts')
        .select('post_id')
        .in('group_id', groupIds)

      duplicateIds = new Set(duplicates?.map(d => d.post_id) || [])
    }

    // Get articles
    const { data: articles, count: totalArticles } = await supabaseAdmin
      .from('articles')
      .select('id', { count: 'exact' })
      .eq('campaign_id', campaignId)

    return NextResponse.json({
      campaign_id: campaignId,
      total_rss_posts: totalPosts,
      posts_with_ratings: postsWithRatings.length,
      duplicate_posts: duplicateIds.size,
      non_duplicate_posts_with_ratings: postsWithRatings.filter(p => !duplicateIds.has(p.id)).length,
      total_articles_created: totalArticles,
      all_posts: allPosts?.map(p => ({
        id: p.id,
        title: p.title,
        has_rating: !!(p.post_ratings && p.post_ratings.length > 0),
        score: p.post_ratings?.[0]?.total_score || null,
        is_duplicate: duplicateIds.has(p.id)
      }))
    })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({
      error: 'Failed to get post counts',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
