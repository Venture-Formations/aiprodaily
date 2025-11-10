import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Debug endpoint to check deduplication status
 * Usage: GET /api/debug/check-deduplication?campaign_id=xxx
 * Or without campaign_id to check the most recent campaign
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    let campaignId = searchParams.get('campaign_id')

    // If no campaign_id provided, get the most recent one
    if (!campaignId) {
      const { data: recentCampaign } = await supabaseAdmin
        .from('newsletter_campaigns')
        .select('id, date, status')
        .order('date', { ascending: false })
        .limit(1)
        .single()

      if (!recentCampaign) {
        return NextResponse.json({ error: 'No campaigns found' }, { status: 404 })
      }

      campaignId = recentCampaign.id
    }

    // Get campaign info
    const { data: campaign } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, date, status, subject_line')
      .eq('id', campaignId)
      .single()

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Get ALL duplicate groups for this campaign
    const { data: duplicateGroups } = await supabaseAdmin
      .from('duplicate_groups')
      .select(`
        id,
        topic_signature,
        primary_post_id,
        primary_post:rss_posts!duplicate_groups_primary_post_id_fkey(
          id,
          title,
          description
        )
      `)
      .eq('campaign_id', campaignId)

    // Get ALL duplicate posts (the ones that should be filtered out)
    const groupIds = duplicateGroups?.map(g => g.id) || []
    const { data: duplicatePosts } = await supabaseAdmin
      .from('duplicate_posts')
      .select(`
        id,
        post_id,
        group_id,
        detection_method,
        similarity_score,
        post:rss_posts(
          id,
          title,
          description
        )
      `)
      .in('group_id', groupIds)

    // Check if any duplicate posts made it into articles (THIS SHOULD BE ZERO)
    const duplicatePostIds = duplicatePosts?.map(dp => dp.post_id) || []
    const { data: articlesFromDuplicates } = await supabaseAdmin
      .from('articles')
      .select('id, headline, post_id')
      .eq('campaign_id', campaignId)
      .in('post_id', duplicatePostIds)

    const { data: secondaryArticlesFromDuplicates } = await supabaseAdmin
      .from('secondary_articles')
      .select('id, headline, post_id')
      .eq('campaign_id', campaignId)
      .in('post_id', duplicatePostIds)

    // Get all articles for this campaign
    const { data: allArticles } = await supabaseAdmin
      .from('articles')
      .select('id, headline, post_id, is_active')
      .eq('campaign_id', campaignId)

    const { data: allSecondaryArticles } = await supabaseAdmin
      .from('secondary_articles')
      .select('id, headline, post_id, is_active')
      .eq('campaign_id', campaignId)

    // Format duplicate groups with their duplicates
    const groupsFormatted = duplicateGroups?.map(group => ({
      topic: group.topic_signature,
      primary_post: {
        id: group.primary_post_id,
        title: (group.primary_post as any)?.title || 'Unknown',
        description: (group.primary_post as any)?.description?.substring(0, 100) || 'No description'
      },
      duplicates: duplicatePosts
        ?.filter(dp => dp.group_id === group.id)
        .map(dp => ({
          id: dp.post_id,
          title: (dp.post as any)?.title || 'Unknown',
          description: (dp.post as any)?.description?.substring(0, 100) || 'No description',
          detection_method: dp.detection_method,
          similarity_score: dp.similarity_score
        })) || []
    })) || []

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        date: campaign.date,
        status: campaign.status,
        subject_line: campaign.subject_line
      },
      deduplication_summary: {
        total_duplicate_groups: duplicateGroups?.length || 0,
        total_duplicate_posts: duplicatePosts?.length || 0,
        posts_filtered_correctly: duplicatePostIds.length - ((articlesFromDuplicates?.length || 0) + (secondaryArticlesFromDuplicates?.length || 0)),

        // ⚠️ THIS SHOULD BE ZERO - If not, the filter is broken
        duplicate_posts_that_made_it_to_articles: (articlesFromDuplicates?.length || 0) + (secondaryArticlesFromDuplicates?.length || 0),
      },
      articles_count: {
        primary_articles: allArticles?.length || 0,
        secondary_articles: allSecondaryArticles?.length || 0,
        primary_active: allArticles?.filter(a => a.is_active).length || 0,
        secondary_active: allSecondaryArticles?.filter(a => a.is_active).length || 0
      },
      duplicate_groups: groupsFormatted,

      // ⚠️ THIS SHOULD BE EMPTY - If not, the filter is BROKEN
      warning_duplicates_in_articles: [
        ...(articlesFromDuplicates?.map(a => ({
          section: 'primary',
          article_id: a.id,
          headline: a.headline,
          post_id: a.post_id
        })) || []),
        ...(secondaryArticlesFromDuplicates?.map(a => ({
          section: 'secondary',
          article_id: a.id,
          headline: a.headline,
          post_id: a.post_id
        })) || [])
      ]
    })

  } catch (error) {
    console.error('[DEBUG] Error checking deduplication:', error)
    return NextResponse.json({
      error: 'Failed to check deduplication',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
