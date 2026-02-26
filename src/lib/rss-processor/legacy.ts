import Parser from 'rss-parser'
import { supabaseAdmin } from '../supabase'
import { getExcludedRssSources } from '../publication-settings'
import type { RssFeed } from '@/types/database'
import type { RSSProcessorContext } from './shared-context'
import { getNewsletterIdFromIssue, logInfo, logError } from './shared-context'
import type { Scoring } from './scoring'
import type { Deduplication } from './deduplication'
import type { ArticleGenerator } from './article-generator'
import type { ArticleSelector } from './article-selector'
import type { ArticleExtraction } from './article-extraction'

const parser = new Parser({
  customFields: {
    item: ['media:content', 'enclosure']
  }
})

/**
 * @deprecated Legacy monolithic processing methods.
 * Kept for backward compatibility. New code should use the step-based workflow.
 */
export class Legacy {
  private ctx: RSSProcessorContext
  private scoring: Scoring
  private deduplication: Deduplication
  private articleGenerator: ArticleGenerator
  private articleSelector: ArticleSelector
  private articleExtraction: ArticleExtraction

  constructor(
    ctx: RSSProcessorContext,
    scoring: Scoring,
    deduplication: Deduplication,
    articleGenerator: ArticleGenerator,
    articleSelector: ArticleSelector,
    articleExtraction: ArticleExtraction
  ) {
    this.ctx = ctx
    this.scoring = scoring
    this.deduplication = deduplication
    this.articleGenerator = articleGenerator
    this.articleSelector = articleSelector
    this.articleExtraction = articleExtraction
  }

  /**
   * @deprecated Legacy monolithic feed processing for an issue
   */
  async processAllFeedsForIssue(issueId: string) {
    let archiveResult: any = null

    try {
      // STEP 0: Archive existing articles and posts
      try {
        archiveResult = await this.ctx.archiveService.archiveissueArticles(issueId, 'rss_processing_clear')
      } catch (archiveError) {
        await this.ctx.errorHandler.logInfo('Archive failed but RSS processing continuing', {
          issueId,
          archiveError: archiveError instanceof Error ? archiveError.message : 'Unknown error'
        }, 'rss_processor')
      }

      // Clear previous articles and posts
      await supabaseAdmin
        .from('articles')
        .delete()
        .eq('issue_id', issueId)

      await supabaseAdmin
        .from('secondary_articles')
        .delete()
        .eq('issue_id', issueId)

      await supabaseAdmin
        .from('rss_posts')
        .delete()
        .eq('issue_id', issueId)

      // Get active RSS feeds
      const { data: allFeeds, error: feedsError } = await supabaseAdmin
        .from('rss_feeds')
        .select('*')
        .eq('active', true)

      if (feedsError) {
        throw new Error(`Failed to fetch feeds: ${feedsError.message}`)
      }

      if (!allFeeds || allFeeds.length === 0) {
        await logError('No active RSS feeds found')
        return
      }

      const primaryFeeds = allFeeds.filter(feed => feed.use_for_primary_section)
      const secondaryFeeds = allFeeds.filter(feed => feed.use_for_secondary_section)

      // Process primary feeds
      for (const feed of primaryFeeds) {
        try {
          await this.processFeed(feed, issueId, 'primary')
        } catch (error) {
          await logError(`Failed to process primary feed ${feed.name}`, {
            feedId: feed.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          })

          await supabaseAdmin
            .from('rss_feeds')
            .update({
              processing_errors: feed.processing_errors + 1
            })
            .eq('id', feed.id)
        }
      }

      // Process secondary feeds
      for (const feed of secondaryFeeds) {
        try {
          await this.processFeed(feed, issueId, 'secondary')
        } catch (error) {
          await logError(`Failed to process secondary feed ${feed.name}`, {
            feedId: feed.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          })

          await supabaseAdmin
            .from('rss_feeds')
            .update({
              processing_errors: feed.processing_errors + 1
            })
            .eq('id', feed.id)
        }
      }

      // Extract full article text
      try {
        await this.articleExtraction.enrichRecentPostsWithFullContent(issueId)
      } catch (extractionError) {
        // Don't fail the entire RSS processing if article extraction fails
      }

      // Process posts with AI for both sections
      await this.processPostsWithAI(issueId, 'primary')
      await this.processPostsWithAI(issueId, 'secondary')

      // Initialize and generate text box modules
      try {
        const publicationId = await getNewsletterIdFromIssue(issueId)
        const { TextBoxModuleSelector, TextBoxGenerator } = await import('@/lib/text-box-modules')
        await TextBoxModuleSelector.initializeForIssue(issueId, publicationId)
        await TextBoxGenerator.generateBlocksWithTiming(issueId, 'after_articles')
      } catch (textBoxError) {
        console.log('[Legacy Processing] Text box generation skipped:', textBoxError)
      }

      // Update issue status
      await supabaseAdmin
        .from('publication_issues')
        .update({ status: 'draft' })
        .eq('id', issueId)

      // Get final article count
      const { data: finalArticles, error: countError } = await supabaseAdmin
        .from('articles')
        .select('id')
        .eq('issue_id', issueId)

      const articleCount = finalArticles?.length || 0

      const { data: issueInfo } = await supabaseAdmin
        .from('publication_issues')
        .select('date')
        .eq('id', issueId)
        .single()

      const issueDate = issueInfo?.date || 'Unknown'

      await this.ctx.errorHandler.logInfo('RSS processing completed successfully', {
        issueId,
        articleCount,
        issueDate
      }, 'rss_processor')

      await this.ctx.slack.sendRSSProcessingCompleteAlert(
        issueId,
        articleCount,
        issueDate,
        archiveResult ? {
          archivedArticles: archiveResult.archivedArticlesCount,
          archivedPosts: archiveResult.archivedPostsCount,
          archivedRatings: archiveResult.archivedRatingsCount
        } : undefined
      )

    } catch (error) {
      const completedSteps: string[] = []

      const { data: issueCheck } = await supabaseAdmin
        .from('publication_issues')
        .select('status')
        .eq('id', issueId)
        .single()

      const { data: articlesCheck } = await supabaseAdmin
        .from('articles')
        .select('id')
        .eq('issue_id', issueId)
        .limit(1)

      const { data: postsCheck } = await supabaseAdmin
        .from('rss_posts')
        .select('id')
        .eq('issue_id', issueId)
        .limit(1)

      if (archiveResult) completedSteps.push('Archive')
      if (postsCheck?.length) completedSteps.push('RSS Feed Processing')
      if (articlesCheck?.length) completedSteps.push('Article Generation')
      if (issueCheck?.status === 'draft') completedSteps.push('Status Update')

      let failedStepGuess = 'RSS Processing Start'
      if (postsCheck?.length && !articlesCheck?.length) failedStepGuess = 'AI Article Processing'
      else if (articlesCheck?.length && issueCheck?.status !== 'draft') failedStepGuess = 'issue Status Update'
      else if (completedSteps.length === 0) failedStepGuess = 'Archive or Initial Setup'

      await this.ctx.errorHandler.handleError(error, {
        source: 'rss_processor',
        operation: 'processAllFeedsForissue',
        issueId,
        completedSteps,
        failedStep: failedStepGuess
      })

      await this.ctx.slack.sendRSSIncompleteAlert(
        issueId,
        completedSteps,
        failedStepGuess,
        error instanceof Error ? error.message : 'Unknown error'
      )

      await this.ctx.slack.sendRSSProcessingAlert(false, issueId, error instanceof Error ? error.message : 'Unknown error')

      throw error
    }
  }

  /**
   * @deprecated Process a single feed (legacy monolithic path)
   */
  async processFeed(feed: RssFeed, issueId: string, section: 'primary' | 'secondary' = 'primary') {
    try {
      const newsletterId = await getNewsletterIdFromIssue(issueId)
      const excludedSources = await getExcludedRssSources(newsletterId)

      const rssFeed = await parser.parseURL(feed.url)

      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      const recentPosts = rssFeed.items.filter(item => {
        if (!item.pubDate) {
          return false
        }
        const pubDate = new Date(item.pubDate)
        return pubDate >= yesterday && pubDate <= now
      })

      for (const item of recentPosts) {
        try {
          const author = item.creator || (item as any)['dc:creator'] || '(No Author)'
          const blockImages = excludedSources.includes(author)

          let imageUrl = null

          // Method 1: media:content
          if (item['media:content']) {
            if (Array.isArray(item['media:content'])) {
              const imageContent = item['media:content'].find((media: any) =>
                media.type?.startsWith('image/') || media.medium === 'image'
              )
              imageUrl = imageContent?.url || imageContent?.$?.url
            } else {
              const mediaContent = item['media:content']
              imageUrl = mediaContent.url ||
                        mediaContent.$?.url ||
                        (mediaContent.medium === 'image' ? mediaContent.url : null) ||
                        (mediaContent.$?.medium === 'image' ? mediaContent.$?.url : null)
            }
          }

          // Method 1b: Try raw XML parsing for Facebook format
          if (!imageUrl && (item.content || item.contentSnippet)) {
            const content = item.content || item.contentSnippet || ''
            const mediaMatch = content.match(/<media:content[^>]+medium=["']image["'][^>]+url=["']([^"']+)["']/i)
            if (mediaMatch) {
              imageUrl = mediaMatch[1]
            }
          }

          // Method 2: enclosure
          if (!imageUrl && item.enclosure) {
            if (Array.isArray(item.enclosure)) {
              const imageEnclosure = item.enclosure.find((enc: any) => enc.type?.startsWith('image/'))
              imageUrl = imageEnclosure?.url
            } else if (item.enclosure.type?.startsWith('image/')) {
              imageUrl = item.enclosure.url
            }
          }

          // Method 3: Look in content HTML
          if (!imageUrl && (item.content || item.contentSnippet)) {
            const content = item.content || item.contentSnippet || ''
            const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
            if (imgMatch) {
              imageUrl = imgMatch[1]
            }
          }

          // Method 4: thumbnail or image fields
          if (!imageUrl) {
            const itemAny = item as any
            imageUrl = itemAny.thumbnail || itemAny.image || itemAny['media:thumbnail']?.url || null
          }

          // Check if post already exists FOR THIS ISSUE
          const { data: existingPost } = await supabaseAdmin
            .from('rss_posts')
            .select('id')
            .eq('feed_id', feed.id)
            .eq('issue_id', issueId)
            .eq('external_id', item.guid || item.link || '')
            .maybeSingle()

          if (existingPost) {
            continue
          }

          let finalImageUrl = imageUrl
          if (!blockImages && imageUrl && imageUrl.includes('fbcdn.net')) {
            try {
              const hostedUrl = await this.ctx.imageStorage.uploadImage(imageUrl, item.title || 'Untitled')
              if (hostedUrl) {
                finalImageUrl = hostedUrl
              }
            } catch (error) {
              // Silent failure
            }
          }

          if (blockImages) {
            finalImageUrl = null
          }

          const { data: newPost, error: postError } = await supabaseAdmin
            .from('rss_posts')
            .insert([{
              feed_id: feed.id,
              issue_id: issueId,
              external_id: item.guid || item.link || '',
              title: item.title || '',
              description: item.contentSnippet || item.content || '',
              content: item.content || '',
              author: item.creator || (item as any)['dc:creator'] || null,
              publication_date: item.pubDate,
              source_url: item.link,
              image_url: finalImageUrl,
            }])
            .select('id')
            .single()

          if (postError) {
            continue
          }

        } catch (error) {
          // Silent failure, continue processing other items
        }
      }

      await supabaseAdmin
        .from('rss_feeds')
        .update({
          last_processed: now.toISOString(),
          processing_errors: 0
        })
        .eq('id', feed.id)

    } catch (error) {
      throw error
    }
  }

  /**
   * @deprecated Legacy AI processing for posts
   */
  private async processPostsWithAI(issueId: string, section: 'primary' | 'secondary' = 'primary') {
    const newsletterId = await getNewsletterIdFromIssue(issueId)

    const { data: feeds, error: feedsError } = await supabaseAdmin
      .from('rss_feeds')
      .select('id')
      .eq('active', true)
      .eq(section === 'primary' ? 'use_for_primary_section' : 'use_for_secondary_section', true)

    if (feedsError || !feeds || feeds.length === 0) {
      return
    }

    const feedIds = feeds.map(f => f.id)

    const { data: posts, error } = await supabaseAdmin
      .from('rss_posts')
      .select('*')
      .eq('issue_id', issueId)
      .in('feed_id', feedIds)

    if (error || !posts) {
      throw new Error(`Failed to fetch ${section} posts for AI processing`)
    }

    // Step 1: Evaluate posts in batches
    const BATCH_SIZE = 3
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
      const batch = posts.slice(i, i + BATCH_SIZE)

      const batchPromises = batch.map(async (post) => {
        try {
          const evaluation = await this.scoring.evaluatePost(post, newsletterId, section)

          if (typeof evaluation.interest_level !== 'number' ||
              typeof evaluation.local_relevance !== 'number' ||
              typeof evaluation.community_impact !== 'number') {
            throw new Error(`Invalid score types returned by AI`)
          }

          const ratingRecord: any = {
            post_id: post.id,
            interest_level: evaluation.interest_level,
            local_relevance: evaluation.local_relevance,
            community_impact: evaluation.community_impact,
            ai_reasoning: evaluation.reasoning,
            total_score: (evaluation as any).total_score || ((evaluation.interest_level + evaluation.local_relevance + evaluation.community_impact) / 30 * 100)
          }

          const criteriaScores = (evaluation as any).criteria_scores
          if (criteriaScores && Array.isArray(criteriaScores)) {
            for (let k = 0; k < criteriaScores.length && k < 5; k++) {
              const criterionNum = k + 1
              ratingRecord[`criteria_${criterionNum}_score`] = criteriaScores[k].score
              ratingRecord[`criteria_${criterionNum}_reason`] = criteriaScores[k].reason
              ratingRecord[`criteria_${criterionNum}_weight`] = criteriaScores[k].weight
            }
          }

          const { error: ratingError } = await supabaseAdmin
            .from('post_ratings')
            .insert([ratingRecord])

          if (ratingError) {
            throw new Error(`Rating insert failed: ${ratingError.message}`)
          }

          return { success: true, post: post }

        } catch (error) {
          return { success: false, post: post, error }
        }
      })

      const batchResults = await Promise.all(batchPromises)

      const batchSuccess = batchResults.filter(r => r.success).length
      const batchErrors = batchResults.filter(r => !r.success).length

      successCount += batchSuccess
      errorCount += batchErrors

      if (i + BATCH_SIZE < posts.length) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    // Step 2: Detect and handle duplicates
    await this.deduplication.handleDuplicates(posts, issueId)

    // Step 3: Generate newsletter articles for top posts
    await logInfo(`Starting ${section} newsletter article generation...`, { issueId, section })
    await this.articleGenerator.generateNewsletterArticles(issueId, section)
  }
}
