import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Debug endpoint to check RSS ingestion status
 * Shows recent posts, feed activity, and ingestion statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Get total post count
    const { count: totalPosts } = await supabaseAdmin
      .from('rss_posts')
      .select('*', { count: 'exact', head: true })

    // Get unassigned posts (campaign_id IS NULL)
    const { count: unassignedPosts } = await supabaseAdmin
      .from('rss_posts')
      .select('*', { count: 'exact', head: true })
      .is('campaign_id', null)

    // Get most recent posts
    const { data: recentPosts } = await supabaseAdmin
      .from('rss_posts')
      .select('title, created_at, processed_at, campaign_id, feed:rss_feeds(name)')
      .order('created_at', { ascending: false })
      .limit(10)

    // Get posts from last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: last24Hours } = await supabaseAdmin
      .from('rss_posts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo)

    // Get posts from last 6 hours (ingest window)
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
    const { count: last6Hours } = await supabaseAdmin
      .from('rss_posts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sixHoursAgo)

    // Get active feeds
    const { data: activeFeeds } = await supabaseAdmin
      .from('rss_feeds')
      .select('name, url, active')
      .eq('active', true)

    // Get post count by feed (last 24 hours)
    const { data: feedActivity } = await supabaseAdmin
      .from('rss_posts')
      .select('feed_id, feed:rss_feeds(name)')
      .gte('created_at', oneDayAgo)

    const feedCounts = feedActivity?.reduce((acc: Record<string, number>, post: any) => {
      const feedName = post.feed?.name || 'Unknown'
      acc[feedName] = (acc[feedName] || 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      summary: {
        totalPosts,
        unassignedPosts,
        postsLast24Hours: last24Hours,
        postsLast6Hours: last6Hours,
        activeFeeds: activeFeeds?.length || 0
      },
      feeds: {
        active: activeFeeds,
        activityLast24Hours: feedCounts
      },
      recentPosts: recentPosts?.map((post: any) => ({
        title: post.title,
        feedName: post.feed?.name,
        createdAt: post.created_at,
        processedAt: post.processed_at,
        assigned: post.campaign_id !== null
      })),
      timestamp: new Date().toISOString(),
      diagnostics: {
        message: (last6Hours || 0) === 0
          ? '⚠️ No posts ingested in last 6 hours - RSS feeds may not have new content or ingestion may be failing'
          : (last6Hours || 0) < 5
          ? `⚠️ Only ${last6Hours} posts in last 6 hours - RSS feeds may have low activity`
          : `✅ ${last6Hours} posts ingested in last 6 hours - ingestion appears to be working`
      }
    })

  } catch (error) {
    console.error('[RSS Status] Error:', error)
    return NextResponse.json({
      error: 'Failed to fetch RSS status',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export const maxDuration = 60
