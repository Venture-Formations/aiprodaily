import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('=== RSS IMAGES DEBUG ===')

    // Get recent RSS posts with image URLs
    const { data: posts, error: postsError } = await supabaseAdmin
      .from('rss_posts')
      .select(`
        id,
        title,
        image_url,
        publication_date,
        campaign_id,
        rss_feed:rss_feeds(name)
      `)
      .order('publication_date', { ascending: false })
      .limit(20)

    console.log('Posts query:', { posts: posts?.length, error: postsError })

    // Get recent articles with their RSS post images
    const { data: articles, error: articlesError } = await supabaseAdmin
      .from('articles')
      .select(`
        id,
        headline,
        is_active,
        campaign_id,
        rss_post:rss_posts(
          id,
          title,
          image_url
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10)

    console.log('Articles query:', { articles: articles?.length, error: articlesError })

    return NextResponse.json({
      debug: 'RSS Images Analysis',
      posts: {
        total: posts?.length || 0,
        withImages: posts?.filter(p => p.image_url)?.length || 0,
        data: posts || []
      },
      articles: {
        total: articles?.length || 0,
        withImages: articles?.filter((a: any) => a.rss_post?.image_url)?.length || 0,
        data: articles || []
      },
      postsError,
      articlesError
    })

  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      debug: 'Failed to query database'
    }, { status: 500 })
  }
}