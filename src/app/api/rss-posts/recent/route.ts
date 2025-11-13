import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const section = url.searchParams.get('section') // 'primary' or 'secondary'

    // Get accounting newsletter ID
    const { data: newsletter } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('slug', 'accounting')
      .single()

    if (!newsletter) {
      return NextResponse.json({
        error: 'Accounting newsletter not found'
      }, { status: 404 })
    }

    // Fetch RSS posts with feed information
    const { data: allPosts, error } = await supabaseAdmin
      .from('rss_posts')
      .select(`
        id,
        title,
        description,
        content,
        author,
        source_url,
        publication_date,
        processed_at,
        issue_id,
        feed_id,
        rss_feed:rss_feeds!inner(name, use_for_primary_section, use_for_secondary_section, publication_id)
      `)
      .eq('rss_feed.publication_id', newsletter.id)
      .order('processed_at', { ascending: false })
      .limit(200) // Fetch more to ensure we have enough after filtering

    if (error) {
      console.error('[API] Error fetching RSS posts:', error)
      throw error
    }

    // Filter posts by section in JavaScript
    let posts = allPosts || []

    if (section === 'primary') {
      posts = posts.filter(post => {
        const feed = Array.isArray(post.rss_feed) ? post.rss_feed[0] : post.rss_feed
        return feed?.use_for_primary_section === true
      })
    } else if (section === 'secondary') {
      posts = posts.filter(post => {
        const feed = Array.isArray(post.rss_feed) ? post.rss_feed[0] : post.rss_feed
        return feed?.use_for_secondary_section === true
      })
    }

    // Apply limit after filtering
    posts = posts.slice(0, limit)

    return NextResponse.json({
      success: true,
      posts: posts,
      total: posts.length
    })

  } catch (error: any) {
    console.error('[API] Failed to fetch RSS posts:', error)
    return NextResponse.json({
      error: 'Failed to fetch RSS posts',
      message: error.message
    }, { status: 500 })
  }
}
