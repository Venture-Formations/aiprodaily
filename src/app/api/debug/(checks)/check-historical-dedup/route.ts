import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

export const maxDuration = 60

function createContentHash(post: any): string {
  const content = (
    post.full_article_text ||
    post.content ||
    post.description ||
    ''
  ).trim().toLowerCase()

  const normalized = content.replace(/\s+/g, ' ')

  if (normalized.length === 0) {
    return crypto.createHash('md5').update(post.title.toLowerCase()).digest('hex')
  }

  return crypto.createHash('md5').update(normalized).digest('hex')
}

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/check-historical-dedup' },
  async ({ request }) => {
    const { searchParams } = new URL(request.url)
    const issueId1 = searchParams.get('issue1') || 'd8679cfd-c2a2-42c0-aa1a-ca6a612ba0af'
    const issueId2 = searchParams.get('issue2') || 'f546382b-54e6-4d3f-8edf-79bc20541b85'

    const results: any = {
      step1_issue_details: {},
      step2_lookback_calculation: {},
      step3_historical_campaigns: {},
      step4_historical_articles: {},
      step5_historical_posts: {},
      step6_new_issue_posts: {},
      step7_hash_comparison: [],
      step8_dedup_records_check: {}
    }

    console.log('============ HISTORICAL DEDUP TRACE ============')
    console.log(`Issue 1: ${issueId1}`)
    console.log(`Issue 2: ${issueId2}`)

    // STEP 1: Get issue details
    const { data: issues } = await supabaseAdmin
      .from('publication_issues')
      .select('id, date, status, created_at')
      .in('id', [issueId1, issueId2])
      .order('date')

    results.step1_issue_details = issues

    if (!issues || issues.length < 2) {
      return NextResponse.json({ error: 'Issues not found', results }, { status: 404 })
    }

    const earlierIssue = issues[0]
    const laterIssue = issues[1]

    // STEP 2: Calculate lookback period (using default 3 days)
    const historicalLookbackDays = 3
    const laterIssueDate = new Date(laterIssue.date)
    const cutoffDate = new Date(laterIssueDate)
    cutoffDate.setDate(cutoffDate.getDate() - historicalLookbackDays)
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

    results.step2_lookback_calculation = {
      laterIssueDate: laterIssue.date,
      lookbackDays: historicalLookbackDays,
      cutoffDate: cutoffDateStr,
      earlierIssueDate: earlierIssue.date,
      earlierIssueWithinLookback: earlierIssue.date >= cutoffDateStr
    }

    // STEP 3: Get historical campaigns (what the deduper queries)
    const { data: recentCampaigns } = await supabaseAdmin
      .from('publication_issues')
      .select('id, date, status')
      .eq('status', 'sent')
      .gte('date', cutoffDateStr)
      .neq('id', laterIssue.id)

    results.step3_historical_campaigns = {
      count: recentCampaigns?.length || 0,
      campaigns: recentCampaigns,
      includesEarlierIssue: recentCampaigns?.some(c => c.id === earlierIssue.id)
    }

    if (!recentCampaigns || recentCampaigns.length === 0) {
      results.step3_historical_campaigns.note = 'No sent campaigns found in lookback period - this is why dedup did not catch it!'
      return NextResponse.json(results, { status: 200 })
    }

    const campaignIds = recentCampaigns.map(c => c.id)

    // STEP 4: Get historical articles
    const { data: historicalArticles } = await supabaseAdmin
      .from('articles')
      .select('id, post_id, headline, issue_id, is_active, skipped')
      .in('issue_id', campaignIds)
      .eq('is_active', true)
      .eq('skipped', false)

    results.step4_historical_articles = {
      count: historicalArticles?.length || 0,
      articlesByIssue: {} as Record<string, any[]>
    }

    if (historicalArticles) {
      for (const article of historicalArticles) {
        if (!results.step4_historical_articles.articlesByIssue[article.issue_id]) {
          results.step4_historical_articles.articlesByIssue[article.issue_id] = []
        }
        results.step4_historical_articles.articlesByIssue[article.issue_id].push({
          id: article.id,
          post_id: article.post_id,
          headline: article.headline
        })
      }
    }

    // STEP 5: Get historical RSS posts and create hash map
    const historicalPostIds = historicalArticles?.map(a => a.post_id).filter(Boolean) || []

    const { data: historicalPosts } = await supabaseAdmin
      .from('rss_posts')
      .select('id, title, content, full_article_text, feed_id')
      .in('id', historicalPostIds)

    const historicalHashes = new Map<string, any>()

    results.step5_historical_posts = {
      count: historicalPosts?.length || 0,
      hashes: [] as any[]
    }

    for (const post of historicalPosts || []) {
      const hash = createContentHash(post)
      historicalHashes.set(hash, {
        post_id: post.id,
        title: post.title,
        feed_id: post.feed_id
      })
      results.step5_historical_posts.hashes.push({
        hash: hash,
        post_id: post.id,
        title: post.title,
        feed_id: post.feed_id
      })
    }

    // STEP 6: Get new issue posts
    const { data: newIssuePosts } = await supabaseAdmin
      .from('rss_posts')
      .select('id, title, content, full_article_text, feed_id, issue_id')
      .eq('issue_id', laterIssue.id)

    results.step6_new_issue_posts = {
      count: newIssuePosts?.length || 0,
      posts: newIssuePosts?.map(p => ({
        id: p.id,
        title: p.title,
        feed_id: p.feed_id
      }))
    }

    // STEP 7: Check for hash matches
    for (const post of newIssuePosts || []) {
      const postHash = createContentHash(post)
      const match = historicalHashes.get(postHash)

      results.step7_hash_comparison.push({
        new_post: {
          id: post.id,
          title: post.title,
          feed_id: post.feed_id,
          hash: postHash
        },
        matched: !!match,
        historical_match: match || null
      })
    }

    const matchCount = results.step7_hash_comparison.filter((c: any) => c.matched).length

    // STEP 8: Check what deduplication actually recorded for issue 2
    const { data: dupGroups } = await supabaseAdmin
      .from('duplicate_groups')
      .select('id, topic_signature, primary_post_id')
      .eq('issue_id', laterIssue.id)

    const { data: dupPosts } = await supabaseAdmin
      .from('duplicate_posts')
      .select('id, post_id, detection_method, group_id')
      .in('group_id', dupGroups?.map(g => g.id) || [])

    results.step8_dedup_records_check = {
      groups_found: dupGroups?.length || 0,
      duplicate_posts_found: dupPosts?.length || 0,
      groups: dupGroups,
      duplicate_posts: dupPosts
    }

    results.summary = {
      earlierIssueStatus: earlierIssue.status,
      earlierIssueDate: earlierIssue.date,
      laterIssueDate: laterIssue.date,
      lookbackCutoffDate: cutoffDateStr,
      earlierIssueInLookback: earlierIssue.date >= cutoffDateStr,
      earlierIssueInQuery: recentCampaigns?.some(c => c.id === earlierIssue.id),
      historicalCampaignsFound: recentCampaigns?.length || 0,
      historicalPostsFound: historicalPosts?.length || 0,
      newPostsChecked: newIssuePosts?.length || 0,
      hashMatchesFound: matchCount,
      dedupGroupsRecorded: dupGroups?.length || 0,
      conclusion: matchCount > 0
        ? `Found ${matchCount} hash match(es) - dedup SHOULD have caught these`
        : earlierIssue.status !== 'sent'
          ? `Earlier issue status is '${earlierIssue.status}' not 'sent' - NOT included in historical check`
          : `No hash matches found - posts have different content or feeds`
    }

    console.log('============ SUMMARY ============')
    console.log(JSON.stringify(results.summary, null, 2))

    return NextResponse.json(results, { status: 200 })
  }
)
