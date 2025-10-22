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
      .from('newsletters')
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
        campaign_id,
        feed_id,
        rss_feed:rss_feeds!inner(name, use_for_primary_section, use_for_secondary_section, newsletter_id)
      `)
      .eq('rss_feed.newsletter_id', newsletter.id)
      .order('processed_at', { ascending: false })
      .limit(200) // Fetch more to ensure we have enough after filtering

    if (error) {
      console.error('[API] Error fetching RSS posts:', error)
      throw error
    }

    // Filter posts by section in JavaScript
    let posts = allPosts || []

    // Debug: Log first post structure to understand the data
    if (posts.length > 0 && section) {
      console.log('[API] Sample post structure:', JSON.stringify(posts[0], null, 2))
      console.log('[API] Section filter:', section)
    }

    if (section === 'primary') {
      posts = posts.filter(post => {
        const feed = Array.isArray(post.rss_feed) ? post.rss_feed[0] : post.rss_feed
        const isPrimary = feed?.use_for_primary_section === true
        if (!isPrimary && posts.indexOf(post) < 3) {
          console.log('[API] Filtering out non-primary post:', post.title, 'feed:', feed)
        }
        return isPrimary
      })
      console.log('[API] After primary filter: found', posts.length, 'posts')
    } else if (section === 'secondary') {
      posts = posts.filter(post => {
        const feed = Array.isArray(post.rss_feed) ? post.rss_feed[0] : post.rss_feed
        const isSecondary = feed?.use_for_secondary_section === true
        if (!isSecondary && posts.indexOf(post) < 3) {
          console.log('[API] Filtering out non-secondary post:', post.title, 'feed:', feed)
        }
        return isSecondary
      })
      console.log('[API] After secondary filter: found', posts.length, 'posts')
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
