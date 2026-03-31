import { supabaseAdmin } from './supabase'
import type { ArchivedArticle, ArchivedRssPost, ArchivedPostRating } from '@/types/database'

export class ArticleArchiveService {
  /**
   * Archives all articles and related data for a issue before RSS processing clears them
   * This preserves important data like review_position and final_position
   */
  async archiveissueArticles(issueId: string, archiveReason: string = 'rss_processing_clear'): Promise<{
    archivedArticlesCount: number;
    archivedPostsCount: number;
    archivedRatingsCount: number;
  }> {
    console.log(`=== ARCHIVING ARTICLES FOR issue ${issueId} ===`)
    console.log(`Archive reason: ${archiveReason}`)

    try {
      // Get issue info for denormalized data (including publication_id for tenant scoping)
      const { data: issue } = await supabaseAdmin
        .from('publication_issues')
        .select('date, status, publication_id')
        .eq('id', issueId)
        .single()

      const issueDate = issue?.date || null
      const campaignStatus = issue?.status || null
      const publicationId = issue?.publication_id || null

      // Step 1: Archive articles with their position data
      const archivedArticlesCount = await this.archiveArticles(issueId, archiveReason, issueDate, campaignStatus, publicationId)

      // Step 2: Archive RSS posts and their ratings
      const { archivedPostsCount, archivedRatingsCount } = await this.archiveRssPosts(issueId, archiveReason, issueDate)

      console.log(`✅ Archive complete: ${archivedArticlesCount} articles, ${archivedPostsCount} posts, ${archivedRatingsCount} ratings`)

      return {
        archivedArticlesCount,
        archivedPostsCount,
        archivedRatingsCount
      }

    } catch (error) {
      console.error('❌ Failed to archive issue articles:', error)
      throw new Error(`Archive failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Archive all articles for an issue
   */
  private async archiveArticles(
    issueId: string,
    archiveReason: string,
    issueDate: string | null,
    campaignStatus: string | null,
    publicationId: string | null = null
  ): Promise<number> {
    // Get articles from module_articles (explicit column list — no select('*'))
    const { data: articles, error: articlesError } = await supabaseAdmin
      .from('module_articles')
      .select('id, post_id, issue_id, article_module_id, headline, content, rank, is_active, fact_check_score, fact_check_details, word_count, review_position, final_position, ai_image_url, image_alt, trade_image_url, trade_image_alt, ticker, member_name, transaction_type, created_at, updated_at')
      .eq('issue_id', issueId)

    if (articlesError) {
      throw new Error(`Failed to fetch module articles: ${articlesError.message}`)
    }

    if (!articles || articles.length === 0) {
      console.log('No module articles found to archive')
      return 0
    }

    console.log(`Found ${articles.length} module articles to archive`)

    // Transform articles for archiving (includes module-specific fields)
    const archiveData = articles.map(article => ({
      original_article_id: article.id,
      post_id: article.post_id,
      issue_id: article.issue_id,
      publication_id: publicationId,
      headline: article.headline,
      content: article.content,
      rank: article.rank,
      is_active: article.is_active,
      fact_check_score: article.fact_check_score,
      fact_check_details: article.fact_check_details,
      word_count: article.word_count,
      review_position: article.review_position,
      final_position: article.final_position,
      article_module_id: article.article_module_id,
      ai_image_url: article.ai_image_url,
      image_alt: article.image_alt,
      trade_image_url: article.trade_image_url,
      trade_image_alt: article.trade_image_alt,
      ticker: article.ticker,
      member_name: article.member_name,
      transaction_type: article.transaction_type,
      archive_reason: archiveReason,
      issue_date: issueDate,
      issue_status: campaignStatus,
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
   * Archive all RSS posts and their ratings for an issue
   */
  private async archiveRssPosts(
    issueId: string,
    archiveReason: string,
    issueDate: string | null
  ): Promise<{ archivedPostsCount: number; archivedRatingsCount: number }> {
    // Get posts to archive with their ratings
    const { data: posts, error: postsError } = await supabaseAdmin
      .from('rss_posts')
      .select(`
        *,
        post_ratings:post_ratings(*)
      `)
      .eq('issue_id', issueId)

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
      issue_id: post.issue_id,
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
      issue_date: issueDate
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
        // If table doesn't exist, log warning but don't fail the entire archive
        if (insertRatingsError.message.includes('archived_post_ratings')) {
          console.warn('⚠️ archived_post_ratings table does not exist - skipping rating archival')
          console.warn('Run db/migrations/create_archived_post_ratings.sql to enable rating archival')
        } else {
          throw new Error(`Failed to insert archived ratings: ${insertRatingsError.message}`)
        }
      }
    }

    console.log(`✅ Archived ${posts.length} posts with ${totalRatings} ratings`)

    return {
      archivedPostsCount: posts.length,
      archivedRatingsCount: totalRatings
    }
  }

  /**
   * Get archived articles for a issue (useful for debugging/viewing historical data)
   */
  async getArchivedArticles(issueId: string): Promise<ArchivedArticle[]> {
    const { data, error } = await supabaseAdmin
      .from('archived_articles')
      .select('id, original_article_id, post_id, issue_id, publication_id, headline, content, rank, is_active, skipped, fact_check_score, fact_check_details, word_count, review_position, final_position, article_module_id, ai_image_url, image_alt, trade_image_url, trade_image_alt, ticker, member_name, transaction_type, archive_reason, issue_date, issue_status, original_created_at, original_updated_at, archived_at, created_at')
      .eq('issue_id', issueId)
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
      .select('id, original_article_id, post_id, issue_id, publication_id, headline, content, rank, is_active, skipped, fact_check_score, fact_check_details, word_count, review_position, final_position, article_module_id, ai_image_url, image_alt, trade_image_url, trade_image_alt, ticker, member_name, transaction_type, archive_reason, issue_date, issue_status, original_created_at, original_updated_at, archived_at, created_at')
      .gte('issue_date', startDate)
      .lte('issue_date', endDate)
      .order('issue_date', { ascending: false })

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
    // Use database-side aggregates (DBA review: was unbounded full-table JS fetch)
    const { count: totalArchivedArticles } = await supabaseAdmin
      .from('archived_articles')
      .select('id', { count: 'exact', head: true })

    const { count: totalArchivedPosts } = await supabaseAdmin
      .from('archived_rss_posts')
      .select('id', { count: 'exact', head: true })

    const { count: articlesWithPositions } = await supabaseAdmin
      .from('archived_articles')
      .select('id', { count: 'exact', head: true })
      .not('review_position', 'is', null)

    const { data: oldest } = await supabaseAdmin
      .from('archived_articles')
      .select('archived_at')
      .order('archived_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const { data: newest } = await supabaseAdmin
      .from('archived_articles')
      .select('archived_at')
      .order('archived_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return {
      totalArchivedArticles: totalArchivedArticles || 0,
      totalArchivedPosts: totalArchivedPosts || 0,
      articlesWithPositions: articlesWithPositions || 0,
      oldestArchive: oldest?.archived_at || null,
      newestArchive: newest?.archived_at || null
    }
  }
}