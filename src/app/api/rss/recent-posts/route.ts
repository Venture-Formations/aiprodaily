import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    console.log('[API] Session check:', session ? 'Authenticated' : 'Not authenticated')

    if (!session) {
      console.log('[API] No session found, returning 401')
      return NextResponse.json({ error: 'Unauthorized - Please log in' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const newsletterId = searchParams.get('publication_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const section = searchParams.get('section') || 'all' // 'primary', 'secondary', or 'all'

    console.log('[API] Fetching posts for newsletter slug:', newsletterId, 'limit:', limit, 'section:', section)

    if (!newsletterId) {
      return NextResponse.json(
        { error: 'Missing publication_id parameter' },
        { status: 400 }
      )
    }

    // First, look up the newsletter UUID from the slug
    const { data: newsletter, error: newsletterError } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('slug', newsletterId)
      .single()

    if (newsletterError || !newsletter) {
      console.error('[API] Newsletter not found for slug:', newsletterId, newsletterError)
      return NextResponse.json(
        { error: 'Newsletter not found' },
        { status: 404 }
      )
    }

    console.log('[API] Found newsletter UUID:', newsletter.id)

    // Get feeds for the specified section
    let feedIds: string[] | null = null
    if (section !== 'all') {
      const sectionField = section === 'primary' ? 'use_for_primary_section' : 'use_for_secondary_section'
      const { data: feeds, error: feedsError } = await supabaseAdmin
        .from('rss_feeds')
        .select('id')
        .eq('active', true)
        .eq(sectionField, true)

      if (feedsError) {
        console.error('[API] Error fetching feeds:', feedsError)
        return NextResponse.json(
          { error: 'Failed to fetch feeds', details: feedsError.message },
          { status: 500 }
        )
      }

      feedIds = feeds ? feeds.map(f => f.id) : []
      console.log('[API] Found', feedIds.length, section, 'feeds')

      if (feedIds.length === 0) {
        console.log('[API] No', section, 'feeds found')
        return NextResponse.json({
          success: true,
          posts: [],
          count: 0
        })
      }
    }

    // Get recent issues for this newsletter
    const { data: issues, error: issuesError } = await supabaseAdmin
      .from('publication_issues')
      .select('id')
      .eq('publication_id', newsletter.id)
      .order('date', { ascending: false })
      .limit(10) // Get last 10 issues

    if (issuesError) {
      console.error('[API] Error fetching issues:', issuesError)
      return NextResponse.json(
        { error: 'Failed to fetch issues', details: issuesError.message },
        { status: 500 }
      )
    }

    if (!issues || issues.length === 0) {
      console.log('[API] No issues found for newsletter:', newsletterId)
      return NextResponse.json({
        success: true,
        posts: [],
        count: 0
      })
    }

    const issueIds = issues.map(c => c.id)

    // Get list of duplicate post IDs to exclude
    const { data: duplicatePosts, error: duplicatesError } = await supabaseAdmin
      .from('duplicate_posts')
      .select('post_id')

    if (duplicatesError) {
      console.error('[API] Error fetching duplicates:', duplicatesError)
    }

    const duplicatePostIds = duplicatePosts?.map(d => d.post_id) || []
    console.log('[API] Excluding', duplicatePostIds.length, 'duplicate posts')

    // Fetch recent RSS posts from these campaigns, filtered by section if specified
    let query = supabaseAdmin
      .from('rss_posts')
      .select('id, title, description, full_article_text, source_url, publication_date')
      .in('issue_id', issueIds)
      .not('full_article_text', 'is', null)  // Exclude posts without full text

    // Exclude duplicate posts
    if (duplicatePostIds.length > 0) {
      query = query.not('id', 'in', `(${duplicatePostIds.join(',')})`)
    }

    // Filter by feed IDs if section is specified
    if (feedIds !== null) {
      query = query.in('feed_id', feedIds)
    }

    const { data: posts, error } = await query
      .order('publication_date', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[API] Error fetching recent posts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch recent posts', details: error.message },
        { status: 500 }
      )
    }

    console.log('[API] Found', posts?.length || 0, 'posts')

    return NextResponse.json({
      success: true,
      posts: posts || [],
      count: posts?.length || 0
    })
  } catch (error) {
    console.error('[API] Error in recent-posts:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch recent posts',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
