import { supabaseAdmin } from './supabase'
import type { ArchivedArticle, ArchivedRssPost, ArchivedPostRating } from '@/types/database'

export class ArticleArchiveService {
  /**
   * Archives all articles and related data for a campaign before RSS processing clears them
   * This preserves important data like review_position and final_position
   */
  async archiveCampaignArticles(campaignId: string, archiveReason: string = 'rss_processing_clear'): Promise<{
    archivedArticlesCount: number;
    archivedPostsCount: number;
    archivedRatingsCount: number;
  }> {
    console.log(`=== ARCHIVING ARTICLES FOR CAMPAIGN ${campaignId} ===`)
    console.log(`Archive reason: ${archiveReason}`)

    try {
      // Get campaign info for denormalized data
      const { data: campaign } = await supabaseAdmin
        .from('newsletter_campaigns')
        .select('date, status')
        .eq('id', campaignId)
        .single()

      const campaignDate = campaign?.date || null
      const campaignStatus = campaign?.status || null

      // Step 1: Archive articles with their position data
      const archivedArticlesCount = await this.archiveArticles(campaignId, archiveReason, campaignDate, campaignStatus)

      // Step 2: Archive RSS posts and their ratings
      const { archivedPostsCount, archivedRatingsCount } = await this.archiveRssPosts(campaignId, archiveReason, campaignDate)

      console.log(`✅ Archive complete: ${archivedArticlesCount} articles, ${archivedPostsCount} posts, ${archivedRatingsCount} ratings`)

      return {
        archivedArticlesCount,
        archivedPostsCount,
        archivedRatingsCount
      }

    } catch (error) {
      console.error('❌ Failed to archive campaign articles:', error)
      throw new Error(`Archive failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Archive all articles for a campaign
   */
  private async archiveArticles(
    campaignId: string,
    archiveReason: string,
    campaignDate: string | null,
    campaignStatus: string | null
  ): Promise<number> {
    // Get articles to archive
    const { data: articles, error: articlesError } = await supabaseAdmin
      .from('articles')
      .select('*')
      .eq('campaign_id', campaignId)

    if (articlesError) {
      throw new Error(`Failed to fetch articles: ${articlesError.message}`)
    }

    if (!articles || articles.length === 0) {
      console.log('No articles found to archive')
      return 0
    }

    console.log(`Found ${articles.length} articles to archive`)

    // Transform articles for archiving
    const archiveData = articles.map(article => ({
      original_article_id: article.id,
      post_id: article.post_id,
      campaign_id: article.campaign_id,
      headline: article.headline,
      content: article.content,
      rank: article.rank,
      is_active: article.is_active,
      fact_check_score: article.fact_check_score,
      fact_check_details: article.fact_check_details,
      word_count: article.word_count,
      review_position: article.review_position, // PRESERVE POSITION DATA
      final_position: article.final_position,   // PRESERVE POSITION DATA
      archive_reason: archiveReason,
      campaign_date: campaignDate,
      campaign_status: campaignStatus,
      original_created_at: article.created_at,
      original_updated_at: article.updated_at
    }))

    // Insert archived articles
    const { error: insertError } = await supabaseAdmin
      .from('archived_articles')
      .insert(archiveData)

    if (insertError) {
      throw new Error(`Failed to insert archived articles: ${insertError.message}`)
    }

    console.log(`✅ Archived ${articles.length} articles (including ${articles.filter(a => a.review_position !== null).length} with review positions)`)

    return articles.length
  }

  /**
   * Archive all RSS posts and their ratings for a campaign
   */
  private async archiveRssPosts(
    campaignId: string,
    archiveReason: string,
    campaignDate: string | null
  ): Promise<{ archivedPostsCount: number; archivedRatingsCount: number }> {
    // Get posts to archive with their ratings
    const { data: posts, error: postsError } = await supabaseAdmin
      .from('rss_posts')
      .select(`
        *,
        post_ratings:post_ratings(*)
      `)
      .eq('campaign_id', campaignId)

    if (postsError) {
      throw new Error(`Failed to fetch posts: ${postsError.message}`)
    }

    if (!posts || posts.length === 0) {
      console.log('No posts found to archive')
      return { archivedPostsCount: 0, archivedRatingsCount: 0 }
    }

    console.log(`Found ${posts.length} posts to archive`)

    // Transform posts for archiving
    const archivePostsData = posts.map(post => ({
      original_post_id: post.id,
      feed_id: post.feed_id,
      campaign_id: post.campaign_id,
      external_id: post.external_id,
      title: post.title,
      description: post.description,
      content: post.content,
      author: post.author,
      publication_date: post.publication_date,
      source_url: post.source_url,
      image_url: post.image_url,
      processed_at: post.processed_at,
      archive_reason: archiveReason,
      campaign_date: campaignDate
    }))

    // Insert archived posts
    const { data: archivedPosts, error: insertPostsError } = await supabaseAdmin
      .from('archived_rss_posts')
      .insert(archivePostsData)
      .select('id, original_post_id')

    if (insertPostsError) {
      throw new Error(`Failed to insert archived posts: ${insertPostsError.message}`)
    }

    // Create mapping from original post ID to archived post ID
    const postIdMap = new Map<string, string>()
    archivedPosts?.forEach(archivedPost => {
      postIdMap.set(archivedPost.original_post_id, archivedPost.id)
    })

    // Archive post ratings
    let totalRatings = 0
    const allRatingsData = []

    for (const post of posts) {
      if (post.post_ratings && post.post_ratings.length > 0) {
        const archivedPostId = postIdMap.get(post.id)
        if (archivedPostId) {
          const ratingsData = post.post_ratings.map((rating: any) => ({
            original_rating_id: rating.id,
            archived_post_id: archivedPostId,
            interest_level: rating.interest_level,
            local_relevance: rating.local_relevance,
            community_impact: rating.community_impact,
            total_score: rating.total_score,
            ai_reasoning: rating.ai_reasoning,
            original_created_at: rating.created_at
          }))
          allRatingsData.push(...ratingsData)
          totalRatings += post.post_ratings.length
        }
      }
    }

    // Insert archived ratings if any
    if (allRatingsData.length > 0) {
      const { error: insertRatingsError } = await supabaseAdmin
        .from('archived_post_ratings')
        .insert(allRatingsData)

      if (insertRatingsError) {
        throw new Error(`Failed to insert archived ratings: ${insertRatingsError.message}`)
      }
    }

    console.log(`✅ Archived ${posts.length} posts with ${totalRatings} ratings`)

    return {
      archivedPostsCount: posts.length,
      archivedRatingsCount: totalRatings
    }
  }

  /**
   * Get archived articles for a campaign (useful for debugging/viewing historical data)
   */
  async getArchivedArticles(campaignId: string): Promise<ArchivedArticle[]> {
    const { data, error } = await supabaseAdmin
      .from('archived_articles')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('archived_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch archived articles: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get articles archived by date range (useful for analytics)
   */
  async getArchivedArticlesByDateRange(startDate: string, endDate: string): Promise<ArchivedArticle[]> {
    const { data, error } = await supabaseAdmin
      .from('archived_articles')
      .select('*')
      .gte('campaign_date', startDate)
      .lte('campaign_date', endDate)
      .order('campaign_date', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch archived articles by date: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get statistics about archived data
   */
  async getArchiveStats(): Promise<{
    totalArchivedArticles: number;
    totalArchivedPosts: number;
    articlesWithPositions: number;
    oldestArchive: string | null;
    newestArchive: string | null;
  }> {
    const { data: articleStats } = await supabaseAdmin
      .from('archived_articles')
      .select('archived_at, review_position, final_position')

    const { data: postStats } = await supabaseAdmin
      .from('archived_rss_posts')
      .select('archived_at')

    const articlesWithPositions = articleStats?.filter(a =>
      a.review_position !== null || a.final_position !== null
    ).length || 0

    const allDates = [
      ...(articleStats?.map(a => a.archived_at) || []),
      ...(postStats?.map(p => p.archived_at) || [])
    ].sort()

    return {
      totalArchivedArticles: articleStats?.length || 0,
      totalArchivedPosts: postStats?.length || 0,
      articlesWithPositions,
      oldestArchive: allDates.length > 0 ? allDates[0] : null,
      newestArchive: allDates.length > 0 ? allDates[allDates.length - 1] : null
    }
  }
}