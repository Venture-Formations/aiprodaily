import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/rss-posts - Fetch RSS posts for prompt testing
 * Query params:
 *   - publication_id (required): The publication slug or ID
 *   - article_module_id (optional): Filter by article module
 *   - limit (optional): Number of posts to return (default 20)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const publicationIdOrSlug = searchParams.get('publication_id')
    const articleModuleId = searchParams.get('article_module_id')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!publicationIdOrSlug) {
      return NextResponse.json(
        { error: 'Missing publication_id parameter' },
        { status: 400 }
      )
    }

    // Try to resolve publication by ID first, then by slug
    let publicationId = publicationIdOrSlug
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(publicationIdOrSlug)

    if (!isUuid) {
      const { data: pub, error: pubError } = await supabaseAdmin
        .from('publications')
        .select('id')
        .eq('slug', publicationIdOrSlug)
        .single()

      if (pubError || !pub) {
        return NextResponse.json(
          { error: 'Publication not found' },
          { status: 404 }
        )
      }
      publicationId = pub.id
    }

    // If article_module_id provided, get feeds for that module
    let feedIds: string[] | null = null
    if (articleModuleId) {
      const { data: feeds, error: feedsError } = await supabaseAdmin
        .from('rss_feeds')
        .select('id')
        .eq('article_module_id', articleModuleId)
        .eq('active', true)

      if (feedsError) {
        console.error('[RssPosts] Error fetching module feeds:', feedsError)
        return NextResponse.json(
          { error: 'Failed to fetch feeds', details: feedsError.message },
          { status: 500 }
        )
      }

      feedIds = feeds?.map(f => f.id) || []

      if (feedIds.length === 0) {
        // No feeds assigned to this module
        return NextResponse.json({
          success: true,
          posts: [],
          count: 0,
          message: 'No feeds assigned to this article module'
        })
      }
    } else {
      // Get all feeds for the publication
      const { data: feeds, error: feedsError } = await supabaseAdmin
        .from('rss_feeds')
        .select('id')
        .eq('publication_id', publicationId)
        .eq('active', true)

      if (feedsError) {
        console.error('[RssPosts] Error fetching publication feeds:', feedsError)
        return NextResponse.json(
          { error: 'Failed to fetch feeds', details: feedsError.message },
          { status: 500 }
        )
      }

      feedIds = feeds?.map(f => f.id) || []
    }

    if (!feedIds || feedIds.length === 0) {
      return NextResponse.json({
        success: true,
        posts: [],
        count: 0
      })
    }

    // Fetch recent posts from these feeds
    const { data: posts, error: postsError } = await supabaseAdmin
      .from('rss_posts')
      .select('id, title, description, full_article_text, source_url, publication_date, processed_at')
      .in('feed_id', feedIds)
      .not('full_article_text', 'is', null)
      .order('processed_at', { ascending: false })
      .limit(limit)

    if (postsError) {
      console.error('[RssPosts] Error fetching posts:', postsError)
      return NextResponse.json(
        { error: 'Failed to fetch posts', details: postsError.message },
        { status: 500 }
      )
    }

    console.log(`[RssPosts] Found ${posts?.length || 0} posts for module ${articleModuleId || 'all'}`)

    return NextResponse.json({
      success: true,
      posts: posts || [],
      count: posts?.length || 0
    })

  } catch (error: any) {
    console.error('[RssPosts] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
