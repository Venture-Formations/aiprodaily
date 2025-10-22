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

    // Build query with optional section filter
    let query = supabaseAdmin
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
        rss_feed:rss_feeds(name, use_for_primary_section, use_for_secondary_section)
      `)
      .eq('rss_feeds.newsletter_id', newsletter.id)

    // Filter by section if specified
    if (section === 'primary') {
      query = query.eq('rss_feeds.use_for_primary_section', true)
    } else if (section === 'secondary') {
      query = query.eq('rss_feeds.use_for_secondary_section', true)
    }

    const { data: posts, error } = await query
      .order('processed_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[API] Error fetching RSS posts:', error)
      throw error
    }

    return NextResponse.json({
      success: true,
      posts: posts || [],
      total: posts?.length || 0
    })

  } catch (error: any) {
    console.error('[API] Failed to fetch RSS posts:', error)
    return NextResponse.json({
      error: 'Failed to fetch RSS posts',
      message: error.message
    }, { status: 500 })
  }
}
