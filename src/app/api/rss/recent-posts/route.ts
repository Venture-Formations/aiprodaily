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
    const moduleId = searchParams.get('module_id') // Filter by specific article module (new module system)
    const section = searchParams.get('section') || 'all' // Legacy: 'primary', 'secondary', or 'all'
    const source = searchParams.get('source') || 'recent' // 'recent' or 'sent'
    const days = parseInt(searchParams.get('days') || '5')

    console.log('[API] Fetching posts for newsletter slug:', newsletterId, 'limit:', limit, 'module_id:', moduleId, 'section:', section, 'source:', source)

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

    // If source is 'sent', fetch posts that were actually used in sent issues
    if (source === 'sent') {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

      console.log('[API] Fetching posts from sent issues since:', cutoffDateStr, 'module_id:', moduleId)

      // Build query to get posts used in sent issues from module_articles
      let query = supabaseAdmin
        .from('module_articles')
        .select(`
          post_id,
          issue_id,
          headline,
          final_position,
          article_module_id,
          rss_posts (
            id,
            title,
            description,
            full_article_text,
            source_url,
            publication_date
          ),
          publication_issues (
            id,
            date,
            status,
            publication_id
          )
        `)
        .eq('is_active', true)
        .not('final_position', 'is', null)
        .not('post_id', 'is', null)

      // Filter by module_id if provided
      if (moduleId) {
        query = query.eq('article_module_id', moduleId)
      }

      const { data: usedPosts, error: usedPostsError } = await query.limit(200)

      if (usedPostsError) {
        console.error('[API] Error fetching posts from sent issues:', usedPostsError)
        return NextResponse.json(
          { error: 'Failed to fetch posts from sent issues', details: usedPostsError.message },
          { status: 500 }
        )
      }

      // Extract and deduplicate the RSS posts, filtering by publication_id, status, and date
      const postsMap = new Map<string, {
        id: string
        title: string
        description: string | null
        full_article_text: string | null
        source_url: string | null
        publication_date: string | null
        used_in_issue_date?: string
        generated_headline?: string
      }>()

      for (const article of usedPosts || []) {
        const rssPost = article.rss_posts as unknown as {
          id: string
          title: string
          description: string | null
          full_article_text: string | null
          source_url: string | null
          publication_date: string | null
        } | null
        const issue = article.publication_issues as unknown as {
          date: string
          status: string
          publication_id: string
        } | null

        // Filter: must match publication, be sent, and be within date range
        if (!issue) continue
        if (issue.publication_id !== newsletter.id) continue
        if (issue.status !== 'sent') continue
        if (issue.date < cutoffDateStr) continue

        if (rssPost && !postsMap.has(rssPost.id)) {
          postsMap.set(rssPost.id, {
            ...rssPost,
            used_in_issue_date: issue.date,
            generated_headline: article.headline
          })
        }
      }

      const posts = Array.from(postsMap.values()).slice(0, limit)
      console.log('[API] Found', posts.length, 'posts from sent issues')

      return NextResponse.json({
        success: true,
        posts,
        count: posts.length,
        source: 'sent',
        days
      })
    }

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
