import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'rss/recent-posts' },
  async ({ logger, request }) => {
    const { searchParams } = new URL(request.url)
    const newsletterId = searchParams.get('publication_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const moduleId = searchParams.get('module_id') // Filter by specific article module (new module system)
    const section = searchParams.get('section') || 'all' // Legacy: 'primary', 'secondary', or 'all'
    const source = searchParams.get('source') || 'recent' // 'recent' or 'sent'
    const days = parseInt(searchParams.get('days') || '5')

    logger.info(`[API] Fetching posts for newsletter slug: ${newsletterId}, limit: ${limit}, module_id: ${moduleId}, section: ${section}, source: ${source}`)

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
      logger.error({ slug: newsletterId, err: newsletterError }, '[API] Newsletter not found for slug')
      return NextResponse.json(
        { error: 'Newsletter not found' },
        { status: 404 }
      )
    }

    logger.info(`[API] Found newsletter UUID: ${newsletter.id}`)

    // If source is 'sent', fetch posts that were actually used in sent issues
    if (source === 'sent') {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

      logger.info(`[API] Fetching posts from sent issues since: ${cutoffDateStr}, module_id: ${moduleId}`)

      // First get the issue IDs that match our criteria (sent, within date range, for this publication)
      const { data: sentIssues, error: issuesError } = await supabaseAdmin
        .from('publication_issues')
        .select('id')
        .eq('publication_id', newsletter.id)
        .eq('status', 'sent')
        .gte('date', cutoffDateStr)
        .order('date', { ascending: false })

      if (issuesError) {
        logger.error({ err: issuesError }, '[API] Error fetching sent issues')
        return NextResponse.json(
          { error: 'Failed to fetch sent issues', details: issuesError.message },
          { status: 500 }
        )
      }

      const sentIssueIds = sentIssues?.map(i => i.id) || []
      logger.info(`[API] Found ${sentIssueIds.length} sent issues in date range`)

      if (sentIssueIds.length === 0) {
        return NextResponse.json({
          success: true,
          posts: [],
          count: 0,
          source: 'sent',
          days,
          message: 'No sent issues found in date range'
        })
      }

      // Now query module_articles for these specific issues
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
          )
        `)
        .in('issue_id', sentIssueIds)
        .not('post_id', 'is', null)
        .not('headline', 'is', null)
        .not('final_position', 'is', null) // Only posts that were actually included in the sent email

      // Filter by module_id if provided
      if (moduleId) {
        query = query.eq('article_module_id', moduleId)
      }

      const { data: usedPosts, error: usedPostsError } = await query.limit(500)

      if (usedPostsError) {
        logger.error({ err: usedPostsError }, '[API] Error fetching posts from sent issues')
        return NextResponse.json(
          { error: 'Failed to fetch posts from sent issues', details: usedPostsError.message },
          { status: 500 }
        )
      }

      logger.info(`[API] Found ${usedPosts?.length || 0} module_articles records`)

      // Get issue dates for display
      const issuesById = new Map<string, string>()
      const { data: issueDetails } = await supabaseAdmin
        .from('publication_issues')
        .select('id, date')
        .in('id', sentIssueIds)

      for (const issue of issueDetails || []) {
        issuesById.set(issue.id, issue.date)
      }

      // Extract and deduplicate the RSS posts
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

        if (!rssPost) continue

        if (!postsMap.has(rssPost.id)) {
          postsMap.set(rssPost.id, {
            ...rssPost,
            used_in_issue_date: issuesById.get(article.issue_id) || '',
            generated_headline: article.headline
          })
        }
      }

      const posts = Array.from(postsMap.values()).slice(0, limit)
      logger.info(`[API] Found ${posts.length} posts from sent issues`)

      return NextResponse.json({
        success: true,
        posts,
        count: posts.length,
        source: 'sent',
        days
      })
    }

    // If source is 'pool', fetch recently ingested posts directly from rss_posts via rss_feeds
    if (source === 'pool') {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

      logger.info(`[API] Fetching pool posts since: ${cutoffDateStr}`)

      // Get feed IDs for this publication
      const { data: pubFeeds, error: pubFeedsError } = await supabaseAdmin
        .from('rss_feeds')
        .select('id')
        .eq('publication_id', newsletter.id)
        .eq('active', true)

      if (pubFeedsError) {
        logger.error({ err: pubFeedsError }, '[API] Error fetching publication feeds')
        return NextResponse.json(
          { error: 'Failed to fetch feeds', details: pubFeedsError.message },
          { status: 500 }
        )
      }

      const pubFeedIds = pubFeeds?.map(f => f.id) || []
      if (pubFeedIds.length === 0) {
        return NextResponse.json({
          success: true,
          posts: [],
          count: 0,
          source: 'pool',
          days,
          message: 'No active feeds found for this publication'
        })
      }

      // Fetch pool posts first, then exclude duplicates in JS
      // (Avoids stuffing thousands of IDs into a PostgREST filter which can exceed URL limits)
      const { data: rawPoolPosts, error: poolError } = await supabaseAdmin
        .from('rss_posts')
        .select('id, title, description, full_article_text, source_url, publication_date')
        .in('feed_id', pubFeedIds)
        .not('full_article_text', 'is', null)
        .gte('publication_date', cutoffDateStr)
        .order('publication_date', { ascending: false })
        .limit(limit + 100) // Fetch extra to account for duplicate filtering

      // Filter out duplicates in JS
      let poolPosts = rawPoolPosts
      if (rawPoolPosts && rawPoolPosts.length > 0) {
        const { data: poolDuplicates } = await supabaseAdmin
          .from('duplicate_posts')
          .select('post_id')
          .in('post_id', rawPoolPosts.map(p => p.id))

        if (poolDuplicates && poolDuplicates.length > 0) {
          const dupSet = new Set(poolDuplicates.map(d => d.post_id))
          poolPosts = rawPoolPosts.filter(p => !dupSet.has(p.id))
        }
        poolPosts = poolPosts?.slice(0, limit) ?? null
      }

      if (poolError) {
        logger.error({ err: poolError }, '[API] Error fetching pool posts')
        return NextResponse.json(
          { error: 'Failed to fetch pool posts', details: poolError.message },
          { status: 500 }
        )
      }

      logger.info(`[API] Found ${poolPosts?.length || 0} pool posts`)

      return NextResponse.json({
        success: true,
        posts: poolPosts || [],
        count: poolPosts?.length || 0,
        source: 'pool',
        days
      })
    }

    // If source is 'scored', fetch posts that have been scored, ordered by total_score
    if (source === 'scored') {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

      logger.info(`[API] Fetching scored posts since: ${cutoffDateStr}`)

      // Get feed IDs for this publication (optionally filtered by module)
      let feedQuery = supabaseAdmin
        .from('rss_feeds')
        .select('id')
        .eq('publication_id', newsletter.id)
        .eq('active', true)

      if (moduleId) {
        feedQuery = feedQuery.eq('article_module_id', moduleId)
      }

      const { data: pubFeeds, error: pubFeedsError } = await feedQuery

      if (pubFeedsError) {
        logger.error({ err: pubFeedsError }, '[API] Error fetching publication feeds')
        return NextResponse.json(
          { error: 'Failed to fetch feeds', details: pubFeedsError.message },
          { status: 500 }
        )
      }

      const pubFeedIds = pubFeeds?.map(f => f.id) || []
      if (pubFeedIds.length === 0) {
        return NextResponse.json({
          success: true,
          posts: [],
          count: 0,
          source: 'scored',
          days,
          message: 'No active feeds found for this publication'
        })
      }

      // Fetch posts with their ratings via join
      const { data: rawScoredPosts, error: scoredError } = await supabaseAdmin
        .from('rss_posts')
        .select('id, title, description, full_article_text, source_url, publication_date, post_ratings(total_score)')
        .in('feed_id', pubFeedIds)
        .not('full_article_text', 'is', null)
        .gte('publication_date', cutoffDateStr)
        .order('publication_date', { ascending: false })
        .limit(limit * 3) // Fetch extra since we filter to only scored posts

      if (scoredError) {
        logger.error({ err: scoredError }, '[API] Error fetching scored posts')
        return NextResponse.json(
          { error: 'Failed to fetch scored posts', details: scoredError.message },
          { status: 500 }
        )
      }

      // Filter to only posts with ratings, flatten score, and sort by total_score desc
      const scoredPosts = (rawScoredPosts || [])
        .filter(p => p.post_ratings && p.post_ratings.length > 0)
        .map(p => ({
          id: p.id,
          title: p.title,
          description: p.description,
          full_article_text: p.full_article_text,
          source_url: p.source_url,
          publication_date: p.publication_date,
          total_score: p.post_ratings[0]?.total_score ?? 0,
        }))
        .sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0))
        .slice(0, limit)

      logger.info(`[API] Found ${scoredPosts.length} scored posts`)

      return NextResponse.json({
        success: true,
        posts: scoredPosts,
        count: scoredPosts.length,
        source: 'scored',
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
        logger.error({ err: feedsError }, '[API] Error fetching feeds')
        return NextResponse.json(
          { error: 'Failed to fetch feeds', details: feedsError.message },
          { status: 500 }
        )
      }

      feedIds = feeds ? feeds.map(f => f.id) : []
      logger.info(`[API] Found ${feedIds.length} ${section} feeds`)

      if (feedIds.length === 0) {
        logger.info(`[API] No ${section} feeds found`)
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
      logger.error({ err: issuesError }, '[API] Error fetching issues')
      return NextResponse.json(
        { error: 'Failed to fetch issues', details: issuesError.message },
        { status: 500 }
      )
    }

    if (!issues || issues.length === 0) {
      logger.info(`[API] No issues found for newsletter: ${newsletterId}`)
      return NextResponse.json({
        success: true,
        posts: [],
        count: 0
      })
    }

    const issueIds = issues.map(c => c.id)

    // Fetch recent RSS posts, then exclude duplicates in JS
    // (Avoids stuffing thousands of IDs into a PostgREST filter which can exceed URL limits)
    let query = supabaseAdmin
      .from('rss_posts')
      .select('id, title, description, full_article_text, source_url, publication_date')
      .in('issue_id', issueIds)
      .not('full_article_text', 'is', null)

    // Filter by feed IDs if section is specified
    if (feedIds !== null) {
      query = query.in('feed_id', feedIds)
    }

    const { data: rawPosts, error } = await query
      .order('publication_date', { ascending: false })
      .limit(limit + 100)

    // Filter out duplicates in JS
    let posts = rawPosts
    if (rawPosts && rawPosts.length > 0) {
      const { data: duplicatePosts, error: duplicatesError } = await supabaseAdmin
        .from('duplicate_posts')
        .select('post_id')
        .in('post_id', rawPosts.map(p => p.id))

      if (duplicatesError) {
        logger.error({ err: duplicatesError }, '[API] Error fetching duplicates')
      }

      if (duplicatePosts && duplicatePosts.length > 0) {
        const dupSet = new Set(duplicatePosts.map(d => d.post_id))
        posts = rawPosts.filter(p => !dupSet.has(p.id))
        logger.info(`[API] Excluded ${dupSet.size} duplicate posts`)
      }
      posts = posts?.slice(0, limit) ?? null
    }

    if (error) {
      logger.error({ err: error }, '[API] Error fetching recent posts')
      return NextResponse.json(
        { error: 'Failed to fetch recent posts', details: error.message },
        { status: 500 }
      )
    }

    logger.info(`[API] Found ${posts?.length || 0} posts`)

    return NextResponse.json({
      success: true,
      posts: posts || [],
      count: posts?.length || 0
    })
  }
)
