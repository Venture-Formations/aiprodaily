import Parser from 'rss-parser'
import { supabaseAdmin } from './supabase'
import { AI_CALL, callAIWithPrompt, AI_PROMPTS, callOpenAI } from './openai'
import { ErrorHandler, SlackNotificationService } from './slack'
import { GitHubImageStorage } from './github-storage'
import { ArticleArchiveService } from './article-archive'
import { ArticleExtractor } from './article-extractor'
import { Deduplicator } from './deduplicator'
import type {
  RssFeed,
  RssPost,
  ContentEvaluation,
  NewsletterContent,
  FactCheckResult
} from '@/types/database'
import crypto from 'crypto'

const parser = new Parser({
  customFields: {
    item: ['media:content', 'enclosure']
  }
})

export class RSSProcessor {
  private errorHandler: ErrorHandler
  private slack: SlackNotificationService
  private githubStorage: GitHubImageStorage
  private archiveService: ArticleArchiveService
  private articleExtractor: ArticleExtractor

  constructor() {
    this.errorHandler = new ErrorHandler()
    this.slack = new SlackNotificationService()
    this.githubStorage = new GitHubImageStorage()
    this.archiveService = new ArticleArchiveService()
    this.articleExtractor = new ArticleExtractor()
  }

  /**
   * Helper: Get newsletter_id from campaign_id
   */
  private async getNewsletterIdFromCampaign(campaignId: string): Promise<string> {
    const { data: campaign, error } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('newsletter_id')
      .eq('id', campaignId)
      .single()

    if (error || !campaign || !campaign.newsletter_id) {
      throw new Error(`Failed to get newsletter_id for campaign ${campaignId}`)
    }

    return campaign.newsletter_id
  }

  /**
   * Public method to process a single feed - used by step-based processing
   */
  async processSingleFeed(feed: RssFeed, campaignId: string, section: 'primary' | 'secondary' = 'primary') {
    return await this.processFeed(feed, campaignId, section)
  }

  /**
   * Public method to extract full article text - used by step-based processing
   */
  async extractFullArticleText(campaignId: string) {
    return await this.enrichRecentPostsWithFullContent(campaignId)
  }

  /**
   * Public method to score/evaluate posts - used by step-based processing
   */
  async scorePostsForSection(campaignId: string, section: 'primary' | 'secondary' = 'primary') {
    // Get newsletter_id from campaign
    const newsletterId = await this.getNewsletterIdFromCampaign(campaignId)

    // Get feeds for this section
    const { data: feeds, error: feedsError } = await supabaseAdmin
      .from('rss_feeds')
      .select('id')
      .eq('active', true)
      .eq(section === 'primary' ? 'use_for_primary_section' : 'use_for_secondary_section', true)

    if (feedsError || !feeds || feeds.length === 0) {
      return { scored: 0, errors: 0 }
    }

    const feedIds = feeds.map(f => f.id)

    // Get posts for this campaign from feeds in this section
    // Limit to 12 most recent posts (processing sequentially to handle full article text)
    const { data: posts, error } = await supabaseAdmin
      .from('rss_posts')
      .select('*')
      .eq('campaign_id', campaignId)
      .in('feed_id', feedIds)
      .order('processed_at', { ascending: false })
      .limit(12)

    if (error || !posts) {
      throw new Error(`Failed to fetch ${section} posts for scoring`)
    }

    // Evaluate posts in batches
    const BATCH_SIZE = 3
    let successCount = 0
    let errorCount = 0
    const totalBatches = Math.ceil(posts.length / BATCH_SIZE)

    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
      const batch = posts.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      let batchSuccess = 0
      let batchErrors = 0

      // Process posts sequentially (not in parallel) to avoid memory issues with full article text
      for (let j = 0; j < batch.length; j++) {
        const post = batch[j]
        try {
          const evaluation = await this.evaluatePost(post, newsletterId)

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

          successCount++
          batchSuccess++

        } catch (error) {
          errorCount++
          batchErrors++
        }
      }

      // Log batch completion
      console.log(`[Score] Batch ${batchNum}/${totalBatches} (${section}): ${batchSuccess} succeeded, ${batchErrors} failed`)

      if (i + BATCH_SIZE < posts.length) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    // Note: Deduplication moved to separate step

    return { scored: successCount, errors: errorCount }
  }

  /**
   * Public method to generate newsletter articles - used by step-based processing
   */
  async generateArticlesForSection(campaignId: string, section: 'primary' | 'secondary' = 'primary', limit: number = 12) {
    return await this.generateNewsletterArticles(campaignId, section, limit)
  }

  /**
   * NEW WORKFLOW: Generate titles only (Step 1 of article generation)
   * Creates article records with headlines but no content
   */
  async generateTitlesOnly(campaignId: string, section: 'primary' | 'secondary' = 'primary', limit: number = 6) {
    const newsletterId = await this.getNewsletterIdFromCampaign(campaignId)
    const tableName = section === 'primary' ? 'articles' : 'secondary_articles'

    // Get feeds for this section
    const { data: feeds } = await supabaseAdmin
      .from('rss_feeds')
      .select('id')
      .eq('active', true)
      .eq(section === 'primary' ? 'use_for_primary_section' : 'use_for_secondary_section', true)

    if (!feeds || feeds.length === 0) {
      console.log(`[Titles] No active feeds for ${section} section`)
      return
    }

    const feedIds = feeds.map(f => f.id)

    // Get top posts assigned to this campaign
    const { data: topPosts } = await supabaseAdmin
      .from('rss_posts')
      .select('*, post_ratings(*)')
      .eq('campaign_id', campaignId)
      .in('feed_id', feedIds)

    if (!topPosts || topPosts.length === 0) {
      console.log(`[Titles] No posts assigned to campaign for ${section} section`)
      return
    }

    // Get duplicate post IDs to exclude
    const { data: duplicateGroups } = await supabaseAdmin
      .from('duplicate_groups')
      .select('id')
      .eq('campaign_id', campaignId)

    const groupIds = duplicateGroups?.map(g => g.id) || []
    let duplicatePostIds = new Set<string>()

    if (groupIds.length > 0) {
      const { data: duplicatePosts } = await supabaseAdmin
        .from('duplicate_posts')
        .select('post_id')
        .in('group_id', groupIds)
      duplicatePostIds = new Set(duplicatePosts?.map(d => d.post_id) || [])
    }

    // Filter and sort posts
    const postsWithRatings = topPosts
      .filter(post =>
        post.post_ratings?.[0] &&
        !duplicatePostIds.has(post.id) &&
        post.full_article_text
      )
      .sort((a, b) => {
        const scoreA = a.post_ratings?.[0]?.total_score || 0
        const scoreB = b.post_ratings?.[0]?.total_score || 0
        return scoreB - scoreA
      })
      .slice(0, limit)

    console.log(`[Titles] Generating ${postsWithRatings.length} ${section} titles...`)

    // Generate titles in batch
    const BATCH_SIZE = 3
    for (let i = 0; i < postsWithRatings.length; i += BATCH_SIZE) {
      const batch = postsWithRatings.slice(i, i + BATCH_SIZE)

      await Promise.all(batch.map(async (post) => {
        try {
          // Check if article already exists
          const { data: existing } = await supabaseAdmin
            .from(tableName)
            .select('id')
            .eq('post_id', post.id)
            .eq('campaign_id', campaignId)
            .single()

          if (existing) {
            console.log(`[Titles] Article already exists for post ${post.id}`)
            return
          }

          const fullText = post.full_article_text || post.content || post.description || ''
          const postData = {
            title: post.title,
            description: post.description || '',
            content: fullText,
            source_url: post.source_url || ''
          }

          // Generate title
          const titleResult = section === 'primary'
            ? await AI_CALL.primaryArticleTitle(postData, newsletterId, 200, 0.7)
            : await AI_CALL.secondaryArticleTitle(postData, newsletterId, 200, 0.7)

          const headline = typeof titleResult === 'string'
            ? titleResult.trim()
            : (titleResult.raw || titleResult.headline || '').trim()

          if (!headline) {
            console.error(`[Titles] Failed to generate title for post ${post.id}`)
            return
          }

          // Create article record with title only
          const { error: insertError } = await supabaseAdmin
            .from(tableName)
            .insert([{
              post_id: post.id,
              campaign_id: campaignId,
              headline: headline,
              content: '', // Empty placeholder - will be filled by body generation step
              rank: null,
              is_active: false,
              fact_check_score: null,
              fact_check_details: null,
              word_count: 0 // Placeholder - will be updated with actual count
            }])

          if (insertError) {
            console.error(`[Titles] Database insert failed for post ${post.id}:`, insertError.message)
            throw insertError
          }

          console.log(`[Titles] Generated title for post ${post.id}: "${headline.substring(0, 50)}..."`)

        } catch (error) {
          console.error(`[Titles] Failed for post ${post.id}:`, error instanceof Error ? error.message : 'Unknown')
        }
      }))

      // Delay between batches
      if (i + BATCH_SIZE < postsWithRatings.length) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    console.log(`[Titles] ✓ Generated ${postsWithRatings.length} ${section} titles`)
  }

  /**
   * NEW WORKFLOW: Generate bodies only (Step 2 of article generation)
   * Generates content for articles that have titles but no content
   */
  async generateBodiesOnly(campaignId: string, section: 'primary' | 'secondary' = 'primary', offset: number = 0, limit: number = 3) {
    const newsletterId = await this.getNewsletterIdFromCampaign(campaignId)
    const tableName = section === 'primary' ? 'articles' : 'secondary_articles'

    // Get articles with titles but empty/placeholder content
    const { data: articles } = await supabaseAdmin
      .from(tableName)
      .select('*, rss_posts(*)')
      .eq('campaign_id', campaignId)
      .eq('content', '') // Empty placeholder from title generation step
      .not('headline', 'is', null)
      .order('post_id', { ascending: true })
      .range(offset, offset + limit - 1)

    if (!articles || articles.length === 0) {
      console.log(`[Bodies] No articles awaiting body generation (offset ${offset})`)
      return
    }

    console.log(`[Bodies] Generating ${articles.length} ${section} bodies (offset ${offset})...`)

    // Generate bodies in batch (2 at a time for safety)
    const BATCH_SIZE = 2
    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
      const batch = articles.slice(i, i + BATCH_SIZE)

      await Promise.all(batch.map(async (article: any) => {
        try {
          const post = article.rss_posts
          if (!post) {
            console.error(`[Bodies] No RSS post found for article ${article.id}`)
            return
          }

          const fullText = post.full_article_text || post.content || post.description || ''
          const postData = {
            title: post.title,
            description: post.description || '',
            content: fullText,
            source_url: post.source_url || ''
          }

          // Generate body using existing headline
          const bodyResult = section === 'primary'
            ? await AI_CALL.primaryArticleBody(postData, newsletterId, article.headline, 500, 0.7)
            : await AI_CALL.secondaryArticleBody(postData, newsletterId, article.headline, 500, 0.7)

          if (!bodyResult.content || !bodyResult.word_count) {
            console.error(`[Bodies] Invalid body response for article ${article.id}`)
            return
          }

          // Update article with body
          await supabaseAdmin
            .from(tableName)
            .update({
              content: bodyResult.content,
              word_count: bodyResult.word_count
            })
            .eq('id', article.id)

          console.log(`[Bodies] Generated body for article ${article.id} (${bodyResult.word_count} words)`)

        } catch (error) {
          console.error(`[Bodies] Failed for article ${article.id}:`, error instanceof Error ? error.message : 'Unknown')
        }
      }))

      // Delay between batches
      if (i + BATCH_SIZE < articles.length) {
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
    }

    console.log(`[Bodies] ✓ Generated ${articles.length} ${section} bodies`)
  }

  /**
   * NEW WORKFLOW: Fact-check articles (Step 3 of article generation)
   * Fact-checks all articles that have content but no fact-check score
   */
  async factCheckArticles(campaignId: string, section: 'primary' | 'secondary' = 'primary') {
    const newsletterId = await this.getNewsletterIdFromCampaign(campaignId)
    const tableName = section === 'primary' ? 'articles' : 'secondary_articles'

    // Get articles with actual content (not empty placeholder) but no fact-check
    const { data: articles } = await supabaseAdmin
      .from(tableName)
      .select('*, rss_posts(*)')
      .eq('campaign_id', campaignId)
      .neq('content', '') // Has actual content (not empty placeholder)
      .not('content', 'is', null)
      .is('fact_check_score', null)

    if (!articles || articles.length === 0) {
      console.log(`[Fact-Check] No articles awaiting fact-check for ${section}`)
      return
    }

    console.log(`[Fact-Check] Checking ${articles.length} ${section} articles...`)

    // Fact-check in batches
    const BATCH_SIZE = 3
    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
      const batch = articles.slice(i, i + BATCH_SIZE)

      await Promise.all(batch.map(async (article: any) => {
        try {
          const post = article.rss_posts
          if (!post) {
            console.error(`[Fact-Check] No RSS post found for article ${article.id}`)
            return
          }

          const originalContent = post.content || post.description || ''

          // Fact-check the content
          const factCheck = await this.factCheckContent(article.content, originalContent, newsletterId)

          // Update article with fact-check results
          await supabaseAdmin
            .from(tableName)
            .update({
              fact_check_score: factCheck.score,
              fact_check_details: factCheck.details
            })
            .eq('id', article.id)

          console.log(`[Fact-Check] Article ${article.id}: Score ${factCheck.score}/10`)

        } catch (error) {
          console.error(`[Fact-Check] Failed for article ${article.id}:`, error instanceof Error ? error.message : 'Unknown')

          // Store failed fact-check
          await supabaseAdmin
            .from(tableName)
            .update({
              fact_check_score: 0,
              fact_check_details: `Fact-check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            })
            .eq('id', article.id)
        }
      }))

      // Delay between batches
      if (i + BATCH_SIZE < articles.length) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    console.log(`[Fact-Check] ✓ Checked ${articles.length} ${section} articles`)
  }

  async processAllFeeds() {
    // Starting RSS processing (HYBRID MODE)

    try {
      // Use hybrid workflow (creates campaign and processes pre-scored posts)
      await this.processAllFeedsHybrid()
    } catch (error) {
      await this.errorHandler.handleError(error, {
        source: 'rss_processor',
        operation: 'processAllFeeds'
      })
      await this.slack.sendRSSProcessingAlert(false, undefined, error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  /**
   * Ingest and score new posts (runs every 15 minutes)
   * Does NOT generate articles or assign to campaigns
   */
  async ingestNewPosts(): Promise<{ fetched: number; scored: number }> {
    // Get first active newsletter for backward compatibility
    // (ingestion happens without campaign context)
    const { data: newsletter } = await supabaseAdmin
      .from('newsletters')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!newsletter) {
      console.log('[Ingest] No active newsletter found')
      return { fetched: 0, scored: 0 }
    }

    let totalFetched = 0
    let totalScored = 0

    // Get all active feeds
    const { data: allFeeds } = await supabaseAdmin
      .from('rss_feeds')
      .select('*')
      .eq('active', true)

    if (!allFeeds || allFeeds.length === 0) {
      return { fetched: 0, scored: 0 }
    }

    // Process each feed
    for (const feed of allFeeds) {
      try {
        const result = await this.ingestFeedPosts(feed, newsletter.id)
        totalFetched += result.fetched
        totalScored += result.scored
      } catch (error) {
        console.error(`[Ingest] Feed ${feed.name} failed:`, error instanceof Error ? error.message : 'Unknown')
      }
    }

    return { fetched: totalFetched, scored: totalScored }
  }

  /**
   * Ingest posts from a single feed
   */
  private async ingestFeedPosts(feed: any, newsletterId: string): Promise<{ fetched: number; scored: number }> {
    const rssFeed = await parser.parseURL(feed.url)

    // Filter posts from last 6 hours (safety margin)
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)

    const recentPosts = rssFeed.items.filter(item => {
      if (!item.pubDate) return true // Include if no date
      const pubDate = new Date(item.pubDate)
      return pubDate >= sixHoursAgo
    })

    const newPosts: any[] = []

    // Check which posts are actually new
    for (const item of recentPosts) {
      const externalId = item.guid || item.link || ''

      // Check if already exists (any campaign or no campaign)
      const { data: existing } = await supabaseAdmin
        .from('rss_posts')
        .select('id')
        .eq('external_id', externalId)
        .maybeSingle()

      if (existing) continue

      // Get excluded sources
      const { data: excludedSettings } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'excluded_rss_sources')
        .single()

      const excludedSources: string[] = excludedSettings?.value
        ? JSON.parse(excludedSettings.value)
        : []

      const author = item.creator || (item as any)['dc:creator'] || null
      const blockImages = excludedSources.includes(author)

      // Extract image URL
      let imageUrl = this.extractImageUrl(item)

      // Re-host Facebook images
      if (!blockImages && imageUrl && imageUrl.includes('fbcdn.net')) {
        try {
          const githubUrl = await this.githubStorage.uploadImage(imageUrl, item.title || 'Untitled')
          if (githubUrl) imageUrl = githubUrl
        } catch (error) {
          // Silent failure
        }
      }

      if (blockImages) imageUrl = null

      // Insert new post (campaign_id = null)
      const { data: newPost, error: insertError } = await supabaseAdmin
        .from('rss_posts')
        .insert([{
          feed_id: feed.id,
          campaign_id: null, // ← Not assigned to campaign yet
          external_id: externalId,
          title: item.title || '',
          description: item.contentSnippet || item.content || '',
          content: item.content || '',
          author,
          publication_date: item.pubDate,
          source_url: item.link,
          image_url: imageUrl,
        }])
        .select('id, source_url')
        .single()

      if (insertError || !newPost) continue

      newPosts.push(newPost)
    }

    // Extract full text for new posts (parallel, batch of 10)
    if (newPosts.length > 0) {
      const urls = newPosts
        .filter(p => p.source_url)
        .map(p => p.source_url)

      try {
        const extractionResults = await this.articleExtractor.extractBatch(urls, 10)

        // Update posts with full text
        for (const post of newPosts) {
          if (!post.source_url) continue

          const result = extractionResults.get(post.source_url)
          if (result?.success && result.fullText) {
            await supabaseAdmin
              .from('rss_posts')
              .update({ full_article_text: result.fullText })
              .eq('id', post.id)
          }
        }
      } catch (error) {
        console.error('[Ingest] Extraction failed:', error instanceof Error ? error.message : 'Unknown')
      }
    }

    // Score new posts (batch of 5)
    let scoredCount = 0

    if (newPosts.length > 0) {
      // Get full post data for scoring
      const { data: fullPosts } = await supabaseAdmin
        .from('rss_posts')
        .select('*')
        .in('id', newPosts.map(p => p.id))

      if (fullPosts && fullPosts.length > 0) {
        // Score in batches of 5
        const BATCH_SIZE = 5
        const BATCH_DELAY = 2000

        for (let i = 0; i < fullPosts.length; i += BATCH_SIZE) {
          const batch = fullPosts.slice(i, i + BATCH_SIZE)

          // Process batch in parallel
          const results = await Promise.allSettled(
            batch.map(post => this.scoreAndStorePost(post, newsletterId))
          )

          scoredCount += results.filter(r => r.status === 'fulfilled').length

          // Delay between batches
          if (i + BATCH_SIZE < fullPosts.length) {
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY))
          }
        }
      }
    }

    return { fetched: newPosts.length, scored: scoredCount }
  }

  /**
   * Score a single post and store rating
   */
  private async scoreAndStorePost(post: any, newsletterId: string): Promise<void> {
    const evaluation = await this.evaluatePost(post, newsletterId)

    if (typeof evaluation.interest_level !== 'number' ||
        typeof evaluation.local_relevance !== 'number' ||
        typeof evaluation.community_impact !== 'number') {
      throw new Error('Invalid score types')
    }

    const ratingRecord: any = {
      post_id: post.id,
      interest_level: evaluation.interest_level,
      local_relevance: evaluation.local_relevance,
      community_impact: evaluation.community_impact,
      ai_reasoning: evaluation.reasoning,
      total_score: (evaluation as any).total_score ||
        ((evaluation.interest_level + evaluation.local_relevance + evaluation.community_impact) / 30 * 100)
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

    const { error } = await supabaseAdmin
      .from('post_ratings')
      .insert([ratingRecord])

    if (error) {
      throw new Error(`Rating insert failed: ${error.message}`)
    }
  }

  /**
   * Helper to extract image URL from RSS item
   */
  private extractImageUrl(item: any): string | null {
    // Method 1: media:content
    if (item['media:content']) {
      if (Array.isArray(item['media:content'])) {
        const imageContent = item['media:content'].find((media: any) =>
          media.type?.startsWith('image/') || media.medium === 'image'
        )
        return imageContent?.url || imageContent?.$?.url || null
      } else {
        const mediaContent = item['media:content']
        return mediaContent.url ||
               mediaContent.$?.url ||
               (mediaContent.medium === 'image' ? mediaContent.url : null) ||
               (mediaContent.$?.medium === 'image' ? mediaContent.$?.url : null)
      }
    }

    // Method 2: enclosure
    if (item.enclosure) {
      if (Array.isArray(item.enclosure)) {
        const imageEnclosure = item.enclosure.find((enc: any) => enc.type?.startsWith('image/'))
        return imageEnclosure?.url || null
      } else if (item.enclosure.type?.startsWith('image/')) {
        return item.enclosure.url
      }
    }

    // Method 3: Look in content HTML
    if (item.content || item.contentSnippet) {
      const content = item.content || item.contentSnippet || ''
      const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
      if (imgMatch) return imgMatch[1]
    }

    // Method 4: thumbnail or image fields
    return item.thumbnail || item.image || item['media:thumbnail']?.url || null
  }

  /**
   * HYBRID WORKFLOW: Process campaign using pre-scored posts from ingestion
   * This is the main workflow for nightly batch processing
   */
  async processAllFeedsHybrid() {
    console.log('=== HYBRID RSS PROCESSING START ===')

    let campaignId = ''

    try {
      // STEP 1: Create NEW campaign
      console.log('[Step 1/10] Creating new campaign...')

      // Calculate campaign date (Central Time + 12 hours)
      const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
      const centralDate = new Date(nowCentral)
      centralDate.setHours(centralDate.getHours() + 12)
      const campaignDate = centralDate.toISOString().split('T')[0]

      // Create new campaign with processing status
      const { data: newCampaign, error: createError } = await supabaseAdmin
        .from('newsletter_campaigns')
        .insert([{ date: campaignDate, status: 'processing' }])
        .select('id')
        .single()

      if (createError || !newCampaign) {
        throw new Error('Failed to create campaign')
      }

      campaignId = newCampaign.id
      console.log(`[Step 1/10] ✓ Campaign created: ${campaignId} for ${campaignDate}`)

      // STEP 2: Select AI applications and prompts
      console.log('[Step 2/10] Selecting AI apps and prompts...')

      try {
        const { AppSelector } = await import('./app-selector')
        const { PromptSelector } = await import('./prompt-selector')
        const { data: newsletter } = await supabaseAdmin
          .from('newsletters')
          .select('id, name, slug')
          .eq('is_active', true)
          .limit(1)
          .single()

        if (newsletter) {
          await AppSelector.selectAppsForCampaign(campaignId, newsletter.id)
          await PromptSelector.selectPromptForCampaign(campaignId)
        }
      } catch (error) {
        console.log('[Step 2/10] ⚠️ AI selection failed (non-critical):', error)
      }

      console.log('[Step 2/10] ✓ AI apps and prompts selected')

      // STEP 3: Assign top 12 rated posts from pool for each section
      console.log('[Step 3/10] Assigning top 12 posts per section from pool...')
      const assignResult = await this.assignTopPostsToCampaign(campaignId)
      console.log(`[Step 3/10] ✓ Assigned ${assignResult.primary} primary, ${assignResult.secondary} secondary posts`)

      // STEP 4: Run deduplication
      console.log('[Step 4/10] Deduplicating posts...')
      await this.handleDuplicatesForCampaign(campaignId)
      const { data: duplicateGroups } = await supabaseAdmin
        .from('duplicate_groups')
        .select('id')
        .eq('campaign_id', campaignId)
      const groupsCount = duplicateGroups ? duplicateGroups.length : 0
      console.log(`[Step 4/10] ✓ Deduplicated: ${groupsCount} duplicate groups`)

      // STEP 5: Generate articles from top 6 remaining posts per section
      console.log('[Step 5/10] Generating articles from top 6 posts per section...')
      await this.generateArticlesForSection(campaignId, 'primary', 6)
      await this.generateArticlesForSection(campaignId, 'secondary', 6)
      const { data: generatedPrimary } = await supabaseAdmin
        .from('articles')
        .select('id')
        .eq('campaign_id', campaignId)
      const { data: generatedSecondary } = await supabaseAdmin
        .from('secondary_articles')
        .select('id')
        .eq('campaign_id', campaignId)
      console.log(`[Step 5/10] ✓ Generated ${generatedPrimary?.length || 0} primary, ${generatedSecondary?.length || 0} secondary`)

      // STEP 6: Auto-select top 3 articles per section
      console.log('[Step 6/10] Auto-selecting top 3 articles per section...')
      await this.selectTopArticlesForCampaign(campaignId)
      const { data: activeArticles } = await supabaseAdmin
        .from('articles')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('is_active', true)
      const { data: activeSecondary } = await supabaseAdmin
        .from('secondary_articles')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('is_active', true)
      console.log(`[Step 6/10] ✓ Selected ${activeArticles?.length || 0} primary, ${activeSecondary?.length || 0} secondary`)

      // STEP 7: Generate welcome section
      console.log('[Step 7/10] Generating welcome section...')
      await this.generateWelcomeSection(campaignId)
      console.log('[Step 7/10] ✓ Welcome section generated')

      // STEP 8: Subject line is already generated in selectTopArticlesForCampaign
      const { data: campaign } = await supabaseAdmin
        .from('newsletter_campaigns')
        .select('subject_line')
        .eq('id', campaignId)
        .single()
      console.log(`[Step 8/10] ✓ Subject line: "${campaign?.subject_line?.substring(0, 50) || 'Not found'}..."`)

      // STEP 9: Set campaign status to draft
      console.log('[Step 9/10] Setting campaign status to draft...')
      await supabaseAdmin
        .from('newsletter_campaigns')
        .update({ status: 'draft' })
        .eq('id', campaignId)
      console.log('[Step 9/10] ✓ Status: draft')

      // STEP 10: Stage 1 Unassignment (posts without articles)
      console.log('[Step 10/10] Stage 1 unassignment for unused posts...')
      const unassignResult = await this.unassignUnusedPosts(campaignId)
      console.log(`[Step 10/10] ✓ Unassigned ${unassignResult.unassigned} posts back to pool`)

      console.log('=== HYBRID RSS PROCESSING COMPLETE ===')

    } catch (error) {
      console.error('=== HYBRID RSS PROCESSING FAILED ===')
      console.error('Error:', error)

      // Mark campaign as failed (only if campaign was created)
      if (campaignId) {
        await supabaseAdmin
          .from('newsletter_campaigns')
          .update({ status: 'failed' })
          .eq('id', campaignId)
      }

      throw error
    }
  }

  /**
   * Assign top-scoring posts from pool to campaign
   */
  private async assignTopPostsToCampaign(campaignId: string): Promise<{ primary: number; secondary: number }> {
    // Get lookback window
    const { data: lookbackSetting } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'primary_article_lookback_hours')
      .single()

    const lookbackHours = lookbackSetting ? parseInt(lookbackSetting.value) : 72
    const lookbackDate = new Date()
    lookbackDate.setHours(lookbackDate.getHours() - lookbackHours)
    const lookbackTimestamp = lookbackDate.toISOString()

    // Get feeds for primary section
    const { data: primaryFeeds } = await supabaseAdmin
      .from('rss_feeds')
      .select('id')
      .eq('active', true)
      .eq('use_for_primary_section', true)

    const primaryFeedIds = primaryFeeds?.map(f => f.id) || []

    // Get feeds for secondary section
    const { data: secondaryFeeds } = await supabaseAdmin
      .from('rss_feeds')
      .select('id')
      .eq('active', true)
      .eq('use_for_secondary_section', true)

    const secondaryFeedIds = secondaryFeeds?.map(f => f.id) || []

    // Get top primary posts (unassigned, within lookback window, with ratings)
    // Get more posts initially, then sort by rating and take top 12
    const { data: allPrimaryPosts } = await supabaseAdmin
      .from('rss_posts')
      .select(`
        id,
        post_ratings(total_score)
      `)
      .in('feed_id', primaryFeedIds)
      .is('campaign_id', null)
      .gte('processed_at', lookbackTimestamp)
      .not('post_ratings', 'is', null)

    // Sort by rating score and take top 12
    const topPrimary = allPrimaryPosts
      ?.sort((a: any, b: any) => {
        const scoreA = a.post_ratings?.[0]?.total_score || 0
        const scoreB = b.post_ratings?.[0]?.total_score || 0
        return scoreB - scoreA
      })
      .slice(0, 12) || []

    // Get top secondary posts
    const { data: allSecondaryPosts } = await supabaseAdmin
      .from('rss_posts')
      .select(`
        id,
        post_ratings(total_score)
      `)
      .in('feed_id', secondaryFeedIds)
      .is('campaign_id', null)
      .gte('processed_at', lookbackTimestamp)
      .not('post_ratings', 'is', null)

    // Sort by rating score and take top 12
    const topSecondary = allSecondaryPosts
      ?.sort((a: any, b: any) => {
        const scoreA = a.post_ratings?.[0]?.total_score || 0
        const scoreB = b.post_ratings?.[0]?.total_score || 0
        return scoreB - scoreA
      })
      .slice(0, 12) || []

    // Assign to campaign
    const primaryIds = topPrimary?.map(p => p.id) || []
    const secondaryIds = topSecondary?.map(p => p.id) || []

    if (primaryIds.length > 0) {
      await supabaseAdmin
        .from('rss_posts')
        .update({ campaign_id: campaignId })
        .in('id', primaryIds)
    }

    if (secondaryIds.length > 0) {
      await supabaseAdmin
        .from('rss_posts')
        .update({ campaign_id: campaignId })
        .in('id', secondaryIds)
    }

    return { primary: primaryIds.length, secondary: secondaryIds.length }
  }

  /**
   * Stage 1 Unassignment: Unassign posts that were assigned but no articles generated
   */
  async unassignUnusedPosts(campaignId: string): Promise<{ unassigned: number }> {
    // Find all posts assigned to this campaign
    const { data: assignedPosts } = await supabaseAdmin
      .from('rss_posts')
      .select('id')
      .eq('campaign_id', campaignId)

    const assignedPostIds = assignedPosts?.map(p => p.id) || []

    if (assignedPostIds.length === 0) {
      return { unassigned: 0 }
    }

    // Find posts used in primary articles
    const { data: primaryArticles } = await supabaseAdmin
      .from('articles')
      .select('post_id')
      .eq('campaign_id', campaignId)

    // Find posts used in secondary articles
    const { data: secondaryArticles } = await supabaseAdmin
      .from('secondary_articles')
      .select('post_id')
      .eq('campaign_id', campaignId)

    const usedPostIds = [
      ...(primaryArticles?.map(a => a.post_id) || []),
      ...(secondaryArticles?.map(a => a.post_id) || [])
    ]

    // Find unused posts (assigned but no articles generated)
    const unusedPostIds = assignedPostIds.filter(id => !usedPostIds.includes(id))

    if (unusedPostIds.length === 0) {
      return { unassigned: 0 }
    }

    // Unassign unused posts back to pool
    await supabaseAdmin
      .from('rss_posts')
      .update({ campaign_id: null })
      .in('id', unusedPostIds)

    return { unassigned: unusedPostIds.length }
  }

  async processAllFeedsForCampaign(campaignId: string) {

    let archiveResult: any = null

    try {
      // STEP 0: Archive existing articles and posts before clearing (PRESERVES POSITION DATA!)

      try {
        archiveResult = await this.archiveService.archiveCampaignArticles(campaignId, 'rss_processing_clear')
      } catch (archiveError) {
        // Archive failure shouldn't block RSS processing, but we should log it
        await this.errorHandler.logInfo('Archive failed but RSS processing continuing', {
          campaignId,
          archiveError: archiveError instanceof Error ? archiveError.message : 'Unknown error'
        }, 'rss_processor')
      }

      // Clear previous articles and posts for this campaign to allow fresh processing

      // Delete existing articles for this campaign
      await supabaseAdmin
        .from('articles')
        .delete()
        .eq('campaign_id', campaignId)

      // Delete existing secondary articles for this campaign
      await supabaseAdmin
        .from('secondary_articles')
        .delete()
        .eq('campaign_id', campaignId)

      // Delete existing posts for this campaign
      await supabaseAdmin
        .from('rss_posts')
        .delete()
        .eq('campaign_id', campaignId)

      // Get active RSS feeds - separate primary and secondary
      const { data: allFeeds, error: feedsError } = await supabaseAdmin
        .from('rss_feeds')
        .select('*')
        .eq('active', true)

      if (feedsError) {
        throw new Error(`Failed to fetch feeds: ${feedsError.message}`)
      }

      if (!allFeeds || allFeeds.length === 0) {
        await this.logError('No active RSS feeds found')
        return
      }

      // Separate feeds by section
      const primaryFeeds = allFeeds.filter(feed => feed.use_for_primary_section)
      const secondaryFeeds = allFeeds.filter(feed => feed.use_for_secondary_section)


      // Process primary feeds
      for (const feed of primaryFeeds) {
        try {
          await this.processFeed(feed, campaignId, 'primary')
        } catch (error) {
          await this.logError(`Failed to process primary feed ${feed.name}`, {
            feedId: feed.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          })

          // Increment error count
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
          await this.processFeed(feed, campaignId, 'secondary')
        } catch (error) {
          await this.logError(`Failed to process secondary feed ${feed.name}`, {
            feedId: feed.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          })

          // Increment error count
          await supabaseAdmin
            .from('rss_feeds')
            .update({
              processing_errors: feed.processing_errors + 1
            })
            .eq('id', feed.id)
        }
      }

      // Extract full article text for posts from past 24 hours (before AI processing)
      try {
        await this.enrichRecentPostsWithFullContent(campaignId)
      } catch (extractionError) {
        // Don't fail the entire RSS processing if article extraction fails
      }

      // Process posts with AI for both sections (using full article text if available)
      // Generates title + content, applies scoring criteria, and fact checks
      await this.processPostsWithAI(campaignId, 'primary')
      await this.processPostsWithAI(campaignId, 'secondary')

      // Generate welcome section after all articles are processed
      await this.generateWelcomeSection(campaignId)

      // Campaign remains in 'draft' status for MailerLite cron to process
      // Status will be updated to 'in_review' by create-campaign cron after MailerLite send

      // Update campaign status from processing to draft
      await supabaseAdmin
        .from('newsletter_campaigns')
        .update({ status: 'draft' })
        .eq('id', campaignId)

      // Get final article count to report to Slack (total articles, not just active)
      const { data: finalArticles, error: countError } = await supabaseAdmin
        .from('articles')
        .select('id')
        .eq('campaign_id', campaignId)

      const articleCount = finalArticles?.length || 0

      // Get campaign date for notifications
      const { data: campaignInfo } = await supabaseAdmin
        .from('newsletter_campaigns')
        .select('date')
        .eq('id', campaignId)
        .single()

      const campaignDate = campaignInfo?.date || 'Unknown'

      await this.errorHandler.logInfo('RSS processing completed successfully', {
        campaignId,
        articleCount,
        campaignDate
      }, 'rss_processor')

      // Enhanced Slack notification with article count monitoring
      await this.slack.sendRSSProcessingCompleteAlert(
        campaignId,
        articleCount,
        campaignDate,
        archiveResult ? {
          archivedArticles: archiveResult.archivedArticlesCount,
          archivedPosts: archiveResult.archivedPostsCount,
          archivedRatings: archiveResult.archivedRatingsCount
        } : undefined
      )

    } catch (error) {
      // Determine which steps were completed before failure
      const completedSteps = []
      const failedStep = 'Unknown step'

      // Check what got completed by examining campaign state
      const { data: campaignCheck } = await supabaseAdmin
        .from('newsletter_campaigns')
        .select('status')
        .eq('id', campaignId)
        .single()

      // Check if articles exist
      const { data: articlesCheck } = await supabaseAdmin
        .from('articles')
        .select('id')
        .eq('campaign_id', campaignId)
        .limit(1)

      // Check if posts exist
      const { data: postsCheck } = await supabaseAdmin
        .from('rss_posts')
        .select('id')
        .eq('campaign_id', campaignId)
        .limit(1)

      // Determine what was completed
      if (archiveResult) completedSteps.push('Archive')
      if (postsCheck?.length) completedSteps.push('RSS Feed Processing')
      if (articlesCheck?.length) completedSteps.push('Article Generation')
      if (campaignCheck?.status === 'draft') completedSteps.push('Status Update')

      // Determine likely failure point
      let failedStepGuess = 'RSS Processing Start'
      if (postsCheck?.length && !articlesCheck?.length) failedStepGuess = 'AI Article Processing'
      else if (articlesCheck?.length && campaignCheck?.status !== 'draft') failedStepGuess = 'Campaign Status Update'
      else if (completedSteps.length === 0) failedStepGuess = 'Archive or Initial Setup'

      await this.errorHandler.handleError(error, {
        source: 'rss_processor',
        operation: 'processAllFeedsForCampaign',
        campaignId,
        completedSteps,
        failedStep: failedStepGuess
      })

      // Enhanced failure notification
      await this.slack.sendRSSIncompleteAlert(
        campaignId,
        completedSteps,
        failedStepGuess,
        error instanceof Error ? error.message : 'Unknown error'
      )

      // Also send the traditional alert
      await this.slack.sendRSSProcessingAlert(false, campaignId, error instanceof Error ? error.message : 'Unknown error')

      throw error
    }
  }

  private async getOrCreateTodaysCampaign(): Promise<string> {
    // Use Central Time + 12 hours for consistent date calculations
    // This ensures evening runs (8pm+) create campaigns for tomorrow
    const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
    const centralDate = new Date(nowCentral)
    // Add 12 hours to determine campaign date
    centralDate.setHours(centralDate.getHours() + 12)
    const campaignDate = centralDate.toISOString().split('T')[0]


    // Check if campaign exists for this date that is NOT sent or in_review
    // Only process campaigns in 'draft' or 'processing' status
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, status')
      .eq('date', campaignDate)
      .in('status', ['draft', 'processing'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (existingError) {
      const errorMsg = existingError instanceof Error
        ? existingError.message
        : typeof existingError === 'object' && existingError !== null
          ? JSON.stringify(existingError, null, 2)
          : String(existingError)
      console.error('Error checking for existing campaign:', errorMsg)
    }

    let campaignId: string
    let isNewCampaign = false

    if (existing) {
      // Found a draft/processing campaign for this date
      campaignId = existing.id
      console.log(`Using existing campaign ${campaignId} (status: ${existing.status})`)
    } else {
      // Create new campaign with processing status
      const { data: newCampaign, error } = await supabaseAdmin
        .from('newsletter_campaigns')
        .insert([{ date: campaignDate, status: 'processing' }])
        .select('id')
        .single()

      if (error || !newCampaign) {
        throw new Error('Failed to create campaign')
      }

      campaignId = newCampaign.id
      isNewCampaign = true
      console.log(`Created new campaign ${campaignId} for date ${campaignDate}`)
    }

    // Initialize AI Applications and Prompt Ideas if not already done
    try {
      const { AppSelector } = await import('./app-selector')
      const { PromptSelector } = await import('./prompt-selector')

      // Check if AI Apps already selected
      const { data: existingApps } = await supabaseAdmin
        .from('campaign_ai_app_selections')
        .select('id')
        .eq('campaign_id', campaignId)
        .limit(1)

      // Check if Prompt already selected
      const { data: existingPrompt } = await supabaseAdmin
        .from('campaign_prompt_selections')
        .select('id')
        .eq('campaign_id', campaignId)
        .limit(1)

      const needsApps = !existingApps || existingApps.length === 0
      const needsPrompt = !existingPrompt || existingPrompt.length === 0

      if (needsApps || needsPrompt) {
        const { data: newsletter } = await supabaseAdmin
          .from('newsletters')
          .select('id, name, slug')
          .eq('is_active', true)
          .limit(1)
          .single()

        if (newsletter) {
          if (needsApps) {
            await AppSelector.selectAppsForCampaign(campaignId, newsletter.id)
          }
          if (needsPrompt) {
            await PromptSelector.selectPromptForCampaign(campaignId)
          }
        }
      }
    } catch (initError) {
      const errorMsg = initError instanceof Error 
        ? initError.message 
        : typeof initError === 'object' && initError !== null
          ? JSON.stringify(initError, null, 2)
          : String(initError)
      console.error('Error initializing campaign content:', errorMsg)
      // Don't throw - continue with RSS processing even if initialization fails
    }

    return campaignId
  }

  private async processFeed(feed: RssFeed, campaignId: string, section: 'primary' | 'secondary' = 'primary') {
    try {
      // Get excluded RSS sources from settings
      const { data: excludedSettings } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'excluded_rss_sources')
        .single()

      const excludedSources: string[] = excludedSettings?.value
        ? JSON.parse(excludedSettings.value)
        : []

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
          // Check if author's images should be blocked
          const author = item.creator || (item as any)['dc:creator'] || '(No Author)'
          const blockImages = excludedSources.includes(author)

          // Extract image URL with comprehensive methods
          let imageUrl = null

          // Method 1: media:content (multiple formats)
          if (item['media:content']) {
            if (Array.isArray(item['media:content'])) {
              // Sometimes it's an array, take the first image
              const imageContent = item['media:content'].find((media: any) =>
                media.type?.startsWith('image/') || media.medium === 'image'
              )
              imageUrl = imageContent?.url || imageContent?.$?.url
            } else {
              // Single media:content - try different access patterns
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

          // Method 2: enclosure with image type
          if (!imageUrl && item.enclosure) {
            if (Array.isArray(item.enclosure)) {
              const imageEnclosure = item.enclosure.find((enc: any) => enc.type?.startsWith('image/'))
              imageUrl = imageEnclosure?.url
            } else if (item.enclosure.type?.startsWith('image/')) {
              imageUrl = item.enclosure.url
            }
          }

          // Method 3: Look for images in content HTML
          if (!imageUrl && (item.content || item.contentSnippet)) {
            const content = item.content || item.contentSnippet || ''
            const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
            if (imgMatch) {
              imageUrl = imgMatch[1]
            }
          }

          // Method 4: Look for thumbnail or image fields
          if (!imageUrl) {
            const itemAny = item as any
            imageUrl = itemAny.thumbnail || itemAny.image || itemAny['media:thumbnail']?.url || null
          }

          // Check if post already exists FOR THIS CAMPAIGN
          // This allows the same RSS post to be used by multiple campaigns
          const { data: existingPost } = await supabaseAdmin
            .from('rss_posts')
            .select('id')
            .eq('feed_id', feed.id)
            .eq('campaign_id', campaignId)
            .eq('external_id', item.guid || item.link || '')
            .maybeSingle()

          if (existingPost) {
            continue // Skip if already processed for this campaign
          }

          // Attempt to download and re-host image immediately if it's a Facebook URL
          // But only if images are not blocked for this source
          let finalImageUrl = imageUrl
          if (!blockImages && imageUrl && imageUrl.includes('fbcdn.net')) {
            try {
              const githubUrl = await this.githubStorage.uploadImage(imageUrl, item.title || 'Untitled')
              if (githubUrl) {
                finalImageUrl = githubUrl
              }
            } catch (error) {
              // Silent failure
            }
          }

          // Block image if source is in excluded list
          if (blockImages) {
            finalImageUrl = null
          }

          // Insert new post
          const { data: newPost, error: postError } = await supabaseAdmin
            .from('rss_posts')
            .insert([{
              feed_id: feed.id,
              campaign_id: campaignId,
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

      // Update feed last processed time
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

  private async processPostsWithAI(campaignId: string, section: 'primary' | 'secondary' = 'primary') {
    // Get newsletter_id from campaign
    const newsletterId = await this.getNewsletterIdFromCampaign(campaignId)

    // Get feeds for this section
    const { data: feeds, error: feedsError } = await supabaseAdmin
      .from('rss_feeds')
      .select('id')
      .eq('active', true)
      .eq(section === 'primary' ? 'use_for_primary_section' : 'use_for_secondary_section', true)

    if (feedsError || !feeds || feeds.length === 0) {
      return
    }

    const feedIds = feeds.map(f => f.id)

    // Get posts for this campaign from feeds in this section
    const { data: posts, error } = await supabaseAdmin
      .from('rss_posts')
      .select('*')
      .eq('campaign_id', campaignId)
      .in('feed_id', feedIds)

    if (error || !posts) {
      throw new Error(`Failed to fetch ${section} posts for AI processing`)
    }


    // Step 1: Evaluate posts in batches
    const BATCH_SIZE = 3 // Process 3 posts at a time
    let successCount = 0
    let errorCount = 0

    // Split posts into batches
    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
      const batch = posts.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(posts.length / BATCH_SIZE)


      // Process batch concurrently
      const batchPromises = batch.map(async (post, index) => {
        try {
          const evaluation = await this.evaluatePost(post, newsletterId)

          // Basic validation: ensure scores exist and are numbers
          if (typeof evaluation.interest_level !== 'number' ||
              typeof evaluation.local_relevance !== 'number' ||
              typeof evaluation.community_impact !== 'number') {
            throw new Error(`Invalid score types returned by AI`)
          }

          // Prepare database record with both legacy and new multi-criteria fields
          const ratingRecord: any = {
            post_id: post.id,
            interest_level: evaluation.interest_level,
            local_relevance: evaluation.local_relevance,
            community_impact: evaluation.community_impact,
            ai_reasoning: evaluation.reasoning,
            total_score: (evaluation as any).total_score || ((evaluation.interest_level + evaluation.local_relevance + evaluation.community_impact) / 30 * 100)
          }

          // Add individual criteria scores and reasons if available
          const criteriaScores = (evaluation as any).criteria_scores
          if (criteriaScores && Array.isArray(criteriaScores)) {
            for (let i = 0; i < criteriaScores.length && i < 5; i++) {
              const criterionNum = i + 1
              ratingRecord[`criteria_${criterionNum}_score`] = criteriaScores[i].score
              ratingRecord[`criteria_${criterionNum}_reason`] = criteriaScores[i].reason
              ratingRecord[`criteria_${criterionNum}_weight`] = criteriaScores[i].weight
            }
          }

          // Store evaluation with error handling
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

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises)

      // Count results
      const batchSuccess = batchResults.filter(r => r.success).length
      const batchErrors = batchResults.filter(r => !r.success).length

      successCount += batchSuccess
      errorCount += batchErrors

      // Add delay between batches to respect rate limits
      if (i + BATCH_SIZE < posts.length) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    // Step 2: Detect and handle duplicates
    await this.handleDuplicates(posts, campaignId)

    // Step 3: Generate newsletter articles for top posts
    await this.logInfo(`Starting ${section} newsletter article generation...`, { campaignId, section })
    await this.generateNewsletterArticles(campaignId, section)
  }

  private async evaluatePost(post: RssPost, newsletterId: string): Promise<ContentEvaluation> {
    // Fetch enabled criteria configuration from database
    const { data: criteriaConfig, error: configError } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .eq('newsletter_id', newsletterId)
      .or('key.eq.criteria_enabled_count,key.like.criteria_%_name,key.like.criteria_%_weight')

    if (configError) {
      const errorMsg = configError instanceof Error 
        ? configError.message 
        : typeof configError === 'object' && configError !== null
          ? JSON.stringify(configError, null, 2)
          : String(configError)
      console.error('Failed to fetch criteria configuration:', errorMsg)
      throw new Error('Failed to fetch criteria configuration')
    }

    // Parse criteria configuration
    const enabledCountSetting = criteriaConfig?.find(s => s.key === 'criteria_enabled_count')
    const enabledCount = enabledCountSetting?.value ? parseInt(enabledCountSetting.value) : 3

    // Collect enabled criteria with their weights
    const criteria: Array<{ number: number; name: string; weight: number }> = []
    for (let i = 1; i <= enabledCount; i++) {
      const nameSetting = criteriaConfig?.find(s => s.key === `criteria_${i}_name`)
      const weightSetting = criteriaConfig?.find(s => s.key === `criteria_${i}_weight`)

      criteria.push({
        number: i,
        name: nameSetting?.value || `Criteria ${i}`,
        weight: weightSetting?.value ? parseFloat(weightSetting.value) : 1.0
      })
    }

    // Evaluate post against each enabled criterion
    const criteriaScores: Array<{ score: number; reason: string; weight: number }> = []

    for (const criterion of criteria) {
      try {
        // Use full article text if available, otherwise fall back to RSS content/description
        const fullText = post.full_article_text || post.content || post.description || ''

        // Call AI with structured prompt from database (includes all parameters)
        const promptKey = `ai_prompt_criteria_${criterion.number}`
        
        let result
        try {
          result = await callAIWithPrompt(promptKey, newsletterId, {
            title: post.title,
            description: post.description || '',
            content: fullText
          })
        } catch (callError) {
          throw new Error(`AI call failed for criterion ${criterion.number}: ${callError instanceof Error ? callError.message : 'Unknown error'}`)
        }

        if (!result || typeof result !== 'object') {
          throw new Error(`Invalid AI response type for criterion ${criterion.number}: expected object, got ${typeof result}`)
        }

        const score = result.score
        const reason = result.reason || ''

        if (typeof score !== 'number' || score < 0 || score > 10) {
          throw new Error(`Criterion ${criterion.number} score must be between 0-10, got ${score} (type: ${typeof score})`)
        }

        criteriaScores.push({
          score,
          reason,
          weight: criterion.weight
        })

      } catch (error) {
        throw error
      }
    }

    // Calculate weighted total score
    let totalWeightedScore = 0
    let totalWeight = 0

    criteriaScores.forEach(({ score, weight }) => {
      totalWeightedScore += score * weight
      totalWeight += weight
    })

    // For reference: normalized would be (totalWeightedScore / (totalWeight * 10)) * 100
    // But we want the raw weighted sum, not normalized

    // Return evaluation in legacy format for backward compatibility
    // Store individual criteria scores in post_ratings table
    return {
      interest_level: criteriaScores[0]?.score || 0,
      local_relevance: criteriaScores[1]?.score || 0,
      community_impact: criteriaScores[2]?.score || 0,
      reasoning: criteriaScores.map((c, i) => `${criteria[i]?.name}: ${c.reason}`).join('\n\n'),
      // Include new fields for multi-criteria system
      criteria_scores: criteriaScores,
      total_score: totalWeightedScore  // Return raw weighted sum, not normalized
    } as any
  }

  async handleDuplicatesForCampaign(campaignId: string) {
    const { data: allPosts, error } = await supabaseAdmin
      .from('rss_posts')
      .select('*')
      .eq('campaign_id', campaignId)

    if (error || !allPosts || allPosts.length === 0) {
      return { groups: 0, duplicates: 0 }
    }

    await this.handleDuplicates(allPosts, campaignId)
    
    const { data: duplicateGroups } = await supabaseAdmin
      .from('duplicate_groups')
      .select('id')
      .eq('campaign_id', campaignId)

    const { data: duplicatePosts } = await supabaseAdmin
      .from('duplicate_posts')
      .select('id')
      .in('group_id', duplicateGroups?.map(g => g.id) || [])

    return { 
      groups: duplicateGroups ? duplicateGroups.length : 0, 
      duplicates: duplicatePosts ? duplicatePosts.length : 0 
    }
  }

  private async handleDuplicates(posts: RssPost[], campaignId: string) {
    try {
      // Check if already deduplicated for this campaign
      const { data: existingGroups } = await supabaseAdmin
        .from('duplicate_groups')
        .select('id')
        .eq('campaign_id', campaignId)
        .limit(1)

      if (existingGroups && existingGroups.length > 0) {
        return
      }

      const { data: allPosts, error } = await supabaseAdmin
        .from('rss_posts')
        .select('*')
        .eq('campaign_id', campaignId)

      if (error || !allPosts || allPosts.length === 0) {
        return
      }

      // Get newsletter_id from campaign for multi-tenant filtering
      const newsletterId = await this.getNewsletterIdFromCampaign(campaignId)

      // Load deduplication settings
      const { data: settings } = await supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .eq('newsletter_id', newsletterId)
        .in('key', ['dedup_historical_lookback_days', 'dedup_strictness_threshold'])

      const settingsMap = new Map(settings?.map(s => [s.key, s.value]) || [])
      const historicalLookbackDays = parseInt(settingsMap.get('dedup_historical_lookback_days') || '3')
      const strictnessThreshold = parseFloat(settingsMap.get('dedup_strictness_threshold') || '0.80')


      // Run 4-stage deduplication with config
      const deduplicator = new Deduplicator({
        historicalLookbackDays,
        strictnessThreshold
      })
      const result = await deduplicator.detectAllDuplicates(allPosts, campaignId)

      console.log(`[Dedup] AI found ${result.groups?.length || 0} duplicate groups`)
      console.log(`[Dedup] Full result:`, JSON.stringify(result, null, 2))

      if (!result || !result.groups || !Array.isArray(result.groups)) {
        console.log('[Dedup] No duplicate groups to store')
        return
      }

      // Store results in database
      let storedGroups = 0
      let storedDuplicates = 0

      for (const group of result.groups) {
        const primaryPost = allPosts[group.primary_post_index]
        if (!primaryPost) {
          console.error(`[Dedup] Primary post not found at index ${group.primary_post_index}`)
          continue
        }

        console.log(`[Dedup] Storing group: "${group.topic_signature?.substring(0, 50)}..." - Primary: ${primaryPost.id}`)

        // Create duplicate group
        const { data: duplicateGroup, error: groupError } = await supabaseAdmin
          .from('duplicate_groups')
          .insert([{
            campaign_id: campaignId,
            primary_post_id: primaryPost.id,
            topic_signature: group.topic_signature
          }])
          .select('id')
          .single()

        if (groupError) {
          console.error(`[Dedup] Failed to create group:`, groupError.message)
          continue
        }

        storedGroups++

        if (duplicateGroup) {
          // Add duplicate posts to group with metadata
          if (!Array.isArray(group.duplicate_indices)) {
            console.error(`[Dedup] Invalid duplicate_indices for group ${duplicateGroup.id}`)
            continue
          }

          console.log(`[Dedup] Marking ${group.duplicate_indices.length} posts as duplicates`)

          for (const dupIndex of group.duplicate_indices) {
            const dupPost = allPosts[dupIndex]
            if (!dupPost) {
              console.error(`[Dedup] Duplicate post not found at index ${dupIndex}`)
              continue
            }

            if (dupPost.id === primaryPost.id) {
              console.log(`[Dedup] Skipping primary post ${dupPost.id} from duplicate list`)
              continue
            }

            const { error: dupError } = await supabaseAdmin
              .from('duplicate_posts')
              .insert([{
                group_id: duplicateGroup.id,
                post_id: dupPost.id,
                similarity_score: group.similarity_score,
                detection_method: group.detection_method,
                actual_similarity_score: group.similarity_score
              }])

            if (dupError) {
              console.error(`[Dedup] Failed to mark post ${dupPost.id} as duplicate:`, dupError.message)
            } else {
              console.log(`[Dedup] Marked post ${dupPost.id} as duplicate`)
              storedDuplicates++
            }
          }
        }
      }

      console.log(`[Dedup] Stored ${storedGroups} groups with ${storedDuplicates} duplicate posts total`)

    } catch (error: any) {
      console.error(`[Dedup] CRITICAL ERROR - Deduplication failed completely:`, error.message)
      console.error(`[Dedup] Stack trace:`, error.stack)
      // Don't throw - allow workflow to continue, but log the failure prominently
    }
  }

  private async generateNewsletterArticles(campaignId: string, section: 'primary' | 'secondary' = 'primary', limit: number = 12) {

    // Get feeds for this section
    const { data: feeds, error: feedsError } = await supabaseAdmin
      .from('rss_feeds')
      .select('id')
      .eq('active', true)
      .eq(section === 'primary' ? 'use_for_primary_section' : 'use_for_secondary_section', true)

    if (feedsError || !feeds || feeds.length === 0) {
      return
    }

    const feedIds = feeds.map(f => f.id)

    // Get posts with ratings and check for duplicates
    const { data: topPosts, error: queryError} = await supabaseAdmin
      .from('rss_posts')
      .select(`
        *,
        post_ratings(*)
      `)
      .eq('campaign_id', campaignId)
      .in('feed_id', feedIds)
      // NO LIMIT - Get ALL posts for this campaign section

    // Get duplicate post IDs to exclude (two-step query for proper filtering)
    // Step 1: Get duplicate groups for this campaign
    const { data: duplicateGroups } = await supabaseAdmin
      .from('duplicate_groups')
      .select('id')
      .eq('campaign_id', campaignId)

    const groupIds = duplicateGroups?.map(g => g.id) || []

    // Step 2: Get duplicate posts for those groups
    let duplicatePostIds = new Set<string>()
    if (groupIds.length > 0) {
      const { data: duplicatePosts } = await supabaseAdmin
        .from('duplicate_posts')
        .select('post_id')
        .in('group_id', groupIds)

      duplicatePostIds = new Set(duplicatePosts?.map(d => d.post_id) || [])
    }

    if (queryError) {
      return
    }

    if (!topPosts || topPosts.length === 0) {
      return
    }

    const postsWithRatings = topPosts
      .filter(post =>
        post.post_ratings?.[0] &&
        !duplicatePostIds.has(post.id) &&
        post.full_article_text  // Exclude posts without full text
      )
      .sort((a, b) => {
        const scoreA = a.post_ratings?.[0]?.total_score || 0
        const scoreB = b.post_ratings?.[0]?.total_score || 0
        return scoreB - scoreA
      })
      .slice(0, limit) // Use configurable limit (hybrid: 6, old: 12)

    if (postsWithRatings.length === 0) {
      // Try a simpler query to get posts with ratings
      const { data: allRatedPosts } = await supabaseAdmin
        .from('rss_posts')
        .select(`
          *,
          post_ratings(*)
        `)
        .eq('campaign_id', campaignId)
        .not('post_ratings', 'is', null)

      if (allRatedPosts && allRatedPosts.length > 0) {
        // Use these posts instead, excluding duplicates and posts without full text
        const filteredPosts = allRatedPosts
          .filter(post =>
            !duplicatePostIds.has(post.id) &&
            post.full_article_text
          )
          .sort((a, b) => {
            const scoreA = a.post_ratings?.[0]?.total_score || 0
            const scoreB = b.post_ratings?.[0]?.total_score || 0
            return scoreB - scoreA
          })
          .slice(0, limit) // Use configurable limit (hybrid: 6, old: 12)
        
        // Process articles in batches (limit to top 12 to prevent timeout)
        const limitedPosts = filteredPosts
        const BATCH_SIZE = 2
        for (let i = 0; i < limitedPosts.length; i += BATCH_SIZE) {
          const batch = limitedPosts.slice(i, i + BATCH_SIZE)
          const batchPromises = batch.map(async (post) => {
            try {
              await this.processPostIntoArticle(post, campaignId, section)
            } catch (error) {
              // Silent failure
            }
          })
          await Promise.all(batchPromises)
          
          if (i + BATCH_SIZE < limitedPosts.length) {
            await new Promise(resolve => setTimeout(resolve, 3000))
          }
        }
      }
      return
    }

    // Process articles in batches to avoid overwhelming AI API and prevent timeouts
    // Each article = 3 AI calls (headline + body + fact-check), so smaller batches
    const BATCH_SIZE = 2 // Process 2 articles at a time (6 AI calls per batch)
    let processedCount = 0
    let errorCount = 0

    for (let i = 0; i < postsWithRatings.length; i += BATCH_SIZE) {
      const batch = postsWithRatings.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(postsWithRatings.length / BATCH_SIZE)

      // Process batch concurrently (headline → body → fact check is sequential within each post)
      const batchPromises = batch.map(async (post) => {
        try {
          await this.processPostIntoArticle(post, campaignId, section)
          processedCount++
        } catch (error) {
          errorCount++
        }
      })

      await Promise.all(batchPromises)

      // Longer delay between batches to prevent rate limits and reduce load
      // This also helps spread work over time to stay under 10-minute limit
      if (i + BATCH_SIZE < postsWithRatings.length) {
        await new Promise(resolve => setTimeout(resolve, 3000)) // Increased from 2s to 3s
      }
    }

    // Note: Article selection and subject line generation moved to separate steps
    // Download and store images for articles
    await this.processArticleImages(campaignId)
  }

  /**
   * Public method to select top articles - used by step-based processing
   */
  async selectTopArticlesForCampaign(campaignId: string) {
    await this.selectTop5Articles(campaignId)
    await this.selectTopSecondaryArticles(campaignId)
  }

  private async selectTop5Articles(campaignId: string) {
    try {
      // Get newsletter_id from campaign for multi-tenant filtering
      const newsletterId = await this.getNewsletterIdFromCampaign(campaignId)

      // Get max_top_articles setting (defaults to 3)
      const { data: maxTopArticlesSetting } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('newsletter_id', newsletterId)
        .eq('key', 'max_top_articles')
        .single()

      const finalArticleCount = maxTopArticlesSetting ? parseInt(maxTopArticlesSetting.value) : 3

      // Get lookback hours setting (defaults to 72 hours)
      const { data: lookbackSetting } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('newsletter_id', newsletterId)
        .eq('key', 'primary_article_lookback_hours')
        .single()

      const lookbackHours = lookbackSetting ? parseInt(lookbackSetting.value) : 72
      const lookbackDate = new Date()
      lookbackDate.setHours(lookbackDate.getHours() - lookbackHours)
      const lookbackTimestamp = lookbackDate.toISOString()

      // Query ALL articles from the lookback window that haven't been used in sent newsletters
      // This gives us the best articles regardless of which campaign they were originally processed for
      const { data: availableArticles, error } = await supabaseAdmin
        .from('articles')
        .select(`
          id,
          campaign_id,
          fact_check_score,
          created_at,
          final_position,
          rss_post:rss_posts(
            post_rating:post_ratings(total_score)
          )
        `)
        .gte('created_at', lookbackTimestamp)
        .gte('fact_check_score', 15)
        .is('final_position', null)  // Only articles NOT used in sent newsletters

      console.log(`[Primary Selection] Target: ${finalArticleCount} articles`)
      console.log(`[Primary Selection] Lookback: ${lookbackHours} hours (since ${lookbackTimestamp})`)

      if (error) {
        console.error(`[Primary Selection] Query error:`, error.message)
        return
      }

      if (!availableArticles || availableArticles.length === 0) {
        console.log(`[Primary Selection] No articles found matching criteria`)
        return
      }

      console.log(`[Primary Selection] Found ${availableArticles.length} articles meeting criteria (fact_check_score >= 15, not used in sent newsletters)`)

      // Sort ALL available articles by rating (highest first) and take the top N
      const sortedArticles = availableArticles
        .map((article: any) => ({
          id: article.id,
          current_campaign_id: article.campaign_id,
          score: article.rss_post?.post_rating?.[0]?.total_score || 0,
          created_at: article.created_at
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, finalArticleCount)

      console.log(`[Primary Selection] Selected ${sortedArticles.length} articles (sorted by score):`)
      sortedArticles.forEach((a, idx) => {
        console.log(`  ${idx + 1}. Article ${a.id} - Score: ${a.score}`)
      })

      if (sortedArticles.length === 0) {
        console.log(`[Primary Selection] No articles to activate after sorting`)
        return
      }

      // Update all selected articles to belong to current campaign and activate them
      for (let i = 0; i < sortedArticles.length; i++) {
        const article = sortedArticles[i]

        await supabaseAdmin
          .from('articles')
          .update({
            campaign_id: campaignId,
            is_active: true,
            rank: i + 1  // Rank 1, 2, 3...
          })
          .eq('id', article.id)
      }

      console.log(`[Primary Selection] ✓ Activated ${sortedArticles.length} primary articles for campaign`)

      // Generate subject line using the top-ranked article
      await this.generateSubjectLineForCampaign(campaignId)

    } catch (error) {
      const errorMsg = error instanceof Error 
        ? error.message 
        : typeof error === 'object' && error !== null
          ? JSON.stringify(error, null, 2)
          : String(error)
      console.error('Error selecting top articles:', errorMsg)
    }
  }


  private async selectTopSecondaryArticles(campaignId: string) {
    try {
      // Get newsletter_id from campaign for multi-tenant filtering
      const newsletterId = await this.getNewsletterIdFromCampaign(campaignId)

      // Get max_secondary_articles setting (defaults to 3)
      const { data: maxSecondaryArticlesSetting } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('newsletter_id', newsletterId)
        .eq('key', 'max_secondary_articles')
        .single()

      const finalArticleCount = maxSecondaryArticlesSetting ? parseInt(maxSecondaryArticlesSetting.value) : 3

      // Get lookback hours setting (defaults to 36 hours for secondary)
      const { data: lookbackSetting } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('newsletter_id', newsletterId)
        .eq('key', 'secondary_article_lookback_hours')
        .single()

      const lookbackHours = lookbackSetting ? parseInt(lookbackSetting.value) : 36
      const lookbackDate = new Date()
      lookbackDate.setHours(lookbackDate.getHours() - lookbackHours)
      const lookbackTimestamp = lookbackDate.toISOString()

      // Query ALL secondary articles from the lookback window that haven't been used in sent newsletters
      const { data: availableArticles, error } = await supabaseAdmin
        .from('secondary_articles')
        .select(`
          id,
          campaign_id,
          fact_check_score,
          created_at,
          final_position,
          rss_post:rss_posts(
            post_rating:post_ratings(total_score)
          )
        `)
        .gte('created_at', lookbackTimestamp)
        .gte('fact_check_score', 15)
        .is('final_position', null)  // Only articles NOT used in sent newsletters

      console.log(`[Secondary Selection] Target: ${finalArticleCount} articles`)
      console.log(`[Secondary Selection] Lookback: ${lookbackHours} hours (since ${lookbackTimestamp})`)

      if (error) {
        console.error(`[Secondary Selection] Query error:`, error.message)
        return
      }

      if (!availableArticles || availableArticles.length === 0) {
        console.log(`[Secondary Selection] No articles found matching criteria`)
        return
      }

      console.log(`[Secondary Selection] Found ${availableArticles.length} articles meeting criteria (fact_check_score >= 15, not used in sent newsletters)`)

      // Sort ALL available articles by rating (highest first) and take the top N
      const sortedArticles = availableArticles
        .map((article: any) => ({
          id: article.id,
          current_campaign_id: article.campaign_id,
          score: article.rss_post?.post_rating?.[0]?.total_score || 0,
          created_at: article.created_at
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, finalArticleCount)

      console.log(`[Secondary Selection] Selected ${sortedArticles.length} articles (sorted by score):`)
      sortedArticles.forEach((a, idx) => {
        console.log(`  ${idx + 1}. Article ${a.id} - Score: ${a.score}`)
      })

      if (sortedArticles.length === 0) {
        console.log(`[Secondary Selection] No articles to activate after sorting`)
        return
      }

      // Update all selected articles to belong to current campaign and activate them
      for (let i = 0; i < sortedArticles.length; i++) {
        const article = sortedArticles[i]

        await supabaseAdmin
          .from('secondary_articles')
          .update({
            campaign_id: campaignId,
            is_active: true,
            rank: i + 1  // Rank 1, 2, 3...
          })
          .eq('id', article.id)
      }

      console.log(`[Secondary Selection] ✓ Activated ${sortedArticles.length} secondary articles for campaign`)

    } catch (error) {
      const errorMsg = error instanceof Error 
        ? error.message 
        : typeof error === 'object' && error !== null
          ? JSON.stringify(error, null, 2)
          : String(error)
      console.error('Error selecting top secondary articles:', errorMsg)
    }
  }
  private async processArticleImages(campaignId: string) {
    try {
      // Get active articles with their RSS post image URLs
      const { data: articles, error } = await supabaseAdmin
        .from('articles')
        .select(`
          id,
          rss_post:rss_posts(
            id,
            image_url,
            title
          )
        `)
        .eq('campaign_id', campaignId)
        .eq('is_active', true)

      if (error || !articles) {
        return
      }

      // Process images for each article
      for (const article of articles) {
        try {
          const rssPost = Array.isArray(article.rss_post) ? article.rss_post[0] : article.rss_post

          if (!rssPost?.image_url) {
            continue
          }

          const originalImageUrl = rssPost.image_url

          // Skip if already a GitHub URL
          if (originalImageUrl.includes('github.com') || originalImageUrl.includes('githubusercontent.com')) {
            continue
          }

          // Upload image to GitHub
          const githubUrl = await this.githubStorage.uploadImage(originalImageUrl, rssPost.title)

          if (githubUrl) {
            // Update the RSS post with GitHub URL
            await supabaseAdmin
              .from('rss_posts')
              .update({ image_url: githubUrl })
              .eq('id', rssPost.id)
          }

        } catch (error) {
          // Silent failure
        }
      }

    } catch (error) {
      // Silent failure
    }
  }


  private async processPostIntoArticle(post: any, campaignId: string, section: 'primary' | 'secondary' = 'primary') {
    // Get newsletter_id from campaign
    const newsletterId = await this.getNewsletterIdFromCampaign(campaignId)

    // Check if article already exists for this post (prevents duplicates when running in batches)
    const tableName = section === 'primary' ? 'articles' : 'secondary_articles'
    const { data: existingArticle } = await supabaseAdmin
      .from(tableName)
      .select('id')
      .eq('post_id', post.id)
      .eq('campaign_id', campaignId)
      .single()

    if (existingArticle) {
      console.log(`[Article] Skipping post ${post.id} - article already exists`)
      return
    }

    let content: NewsletterContent | null = null

    try {
      // Generate newsletter content
      content = await this.generateNewsletterContent(post, newsletterId, section)
    } catch (error) {
      const errorMsg = error instanceof Error 
        ? error.message 
        : typeof error === 'object' && error !== null
          ? JSON.stringify(error, null, 2)
          : String(error)
      console.error(`[Article] Failed to generate content for post ${post.id}:`, errorMsg)
      return // Can't proceed without content
    }

    // Fact-check the content (but don't fail if fact-check fails)
    let factCheckScore: number | null = null
    let factCheckDetails: string | null = null

    try {
      const factCheck = await this.factCheckContent(content.content, post.content || post.description || '', newsletterId)
      factCheckScore = factCheck.score
      factCheckDetails = factCheck.details
    } catch (error) {
      // Fact-check failed, but we'll still store the article
      const errorMsg = error instanceof Error 
        ? error.message 
        : typeof error === 'object' && error !== null
          ? JSON.stringify(error, null, 2)
          : String(error)
      console.error(`[Fact-Check] Failed for post ${post.id}, storing article anyway:`, errorMsg)
      factCheckDetails = `Fact-check failed: ${errorMsg}`
      // Set score to 0 to indicate fact-check failed
      factCheckScore = 0
    }

    // Store ALL articles (even if fact-check failed) so we can review them
    // tableName already declared above for duplicate check
    try {
      const { error } = await supabaseAdmin
        .from(tableName)
        .insert([{
          post_id: post.id,
          campaign_id: campaignId,
          headline: content.headline,
          content: content.content,
          rank: null, // Will be set by ranking algorithm
          is_active: false, // Only passed articles can be activated (will be set based on fact_check_score later)
          fact_check_score: factCheckScore,
          fact_check_details: factCheckDetails,
          word_count: content.word_count
        }])

      if (error) {
        console.error(`[Article] Failed to insert article for post ${post.id}:`, error.message)
      }
    } catch (insertError) {
      const errorMsg = insertError instanceof Error 
        ? insertError.message 
        : typeof insertError === 'object' && insertError !== null
          ? JSON.stringify(insertError, null, 2)
          : String(insertError)
      console.error(`[Article] Database insert failed for post ${post.id}:`, errorMsg)
    }
  }

  private async generateNewsletterContent(post: RssPost, newsletterId: string, section: 'primary' | 'secondary' = 'primary'): Promise<NewsletterContent> {
    // Use full article text if available, otherwise fall back to RSS content/description
    const fullText = post.full_article_text || post.content || post.description || ''

    const postData = {
      title: post.title,
      description: post.description || '',
      content: fullText, // Use full article text when available
      source_url: post.source_url || ''
    }

    // Step 1: Generate title using AI_CALL (handles prompt + provider + call)
    const titleResult = section === 'primary'
      ? await AI_CALL.primaryArticleTitle(postData, newsletterId, 200, 0.7)
      : await AI_CALL.secondaryArticleTitle(postData, newsletterId, 200, 0.7)

    // Handle both string and object responses
    const headline = typeof titleResult === 'string'
      ? titleResult.trim()
      : (titleResult.raw || titleResult.headline || '').trim()

    if (!headline) {
      throw new Error('Failed to generate article title')
    }

    // Step 2: Generate body using AI_CALL with the generated title
    const bodyResult = section === 'primary'
      ? await AI_CALL.primaryArticleBody(postData, newsletterId, headline, 500, 0.7)
      : await AI_CALL.secondaryArticleBody(postData, newsletterId, headline, 500, 0.7)

    if (!bodyResult.content || !bodyResult.word_count) {
      throw new Error('Invalid article body response')
    }

    return {
      headline,
      content: bodyResult.content,
      word_count: bodyResult.word_count
    }
  }

  private async factCheckContent(newsletterContent: string, originalContent: string, newsletterId: string): Promise<FactCheckResult> {
    // Use callAIWithPrompt to handle structured prompts the same way as other AI calls
    let result
    try {
      result = await callAIWithPrompt('ai_prompt_fact_checker', newsletterId, {
        newsletter_content: newsletterContent,
        original_content: originalContent
      })
    } catch (callError) {
      throw new Error(`AI call failed for fact-checker: ${callError instanceof Error ? callError.message : 'Unknown error'}`)
    }

    // If result has 'raw' property, try to parse it (JSON parsing failed in callWithStructuredPrompt)
    if (result && typeof result === 'object' && 'raw' in result && typeof result.raw === 'string') {
      try {
        // Try to parse the raw string content
        const parsed = JSON.parse(result.raw)
        result = parsed
      } catch (parseError) {
        // If parsing fails, try extracting JSON from markdown code fences
        try {
          const codeFenceMatch = result.raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
          const cleanedContent = codeFenceMatch && codeFenceMatch[1] ? codeFenceMatch[1] : result.raw
          const objectMatch = cleanedContent.match(/\{[\s\S]*\}/)
          if (objectMatch && objectMatch[0]) {
            result = JSON.parse(objectMatch[0])
          } else {
            result = JSON.parse(cleanedContent.trim())
          }
        } catch (fallbackError) {
          // If it's not valid JSON at all (like an error message), return a structured error
          // Check if the raw content looks like an error message (starts with common error phrases)
          const rawText = result.raw.trim()
          const isErrorMessage = rawText.startsWith('It looks like') || 
                                  rawText.startsWith('I\'m sorry') ||
                                  rawText.startsWith('Error') ||
                                  rawText.startsWith('There was an issue') ||
                                  !rawText.includes('{') // No JSON structure at all
          
          if (isErrorMessage) {
            throw new Error(`AI returned error message instead of fact-check JSON: ${rawText.substring(0, 200)}`)
          }
          
          throw new Error(`Failed to parse fact-check response: ${JSON.stringify({ raw: result.raw.substring(0, 200), parseError: parseError instanceof Error ? parseError.message : String(parseError) })}`)
        }
      }
    }

    if (!result || typeof result !== 'object') {
      throw new Error(`Invalid fact-check response type: expected object, got ${typeof result}`)
    }

    if (typeof result.score !== 'number' || typeof result.details !== 'string') {
      throw new Error(`Invalid fact-check response: ${JSON.stringify({ score: result.score, details: result.details, resultKeys: Object.keys(result || {}), resultType: typeof result })}`)
    }

    return result as FactCheckResult
  }

  async generateWelcomeSection(campaignId: string): Promise<string> {
    try {
      // Get newsletter_id from campaign
      const newsletterId = await this.getNewsletterIdFromCampaign(campaignId)

      // Fetch ALL active PRIMARY articles for this campaign
      const { data: primaryArticles, error: primaryError } = await supabaseAdmin
        .from('articles')
        .select('headline, content')
        .eq('campaign_id', campaignId)
        .eq('is_active', true)
        .order('rank', { ascending: true })

      if (primaryError) {
        throw primaryError
      }

      // Fetch ALL active SECONDARY articles for this campaign
      const { data: secondaryArticles, error: secondaryError } = await supabaseAdmin
        .from('secondary_articles')
        .select('headline, content')
        .eq('campaign_id', campaignId)
        .eq('is_active', true)
        .order('rank', { ascending: true })

      if (secondaryError) {
        throw secondaryError
      }

      // Combine ALL articles (primary first, then secondary)
      const allArticles = [
        ...(primaryArticles || []),
        ...(secondaryArticles || [])
      ]

      if (allArticles.length === 0) {
        return ''
      }

      // Generate welcome text using AI_CALL (uses callAIWithPrompt like other prompts)
      let result
      try {
        result = await AI_CALL.welcomeSection(allArticles, newsletterId, 500, 0.8)
      } catch (callError) {
        throw new Error(`AI call failed for welcome section: ${callError instanceof Error ? callError.message : 'Unknown error'}`)
      }

      // Parse JSON response to extract intro, tagline, and summary
      let welcomeIntro = ''
      let welcomeTagline = ''
      let welcomeSummary = ''

      try {
        // If result has 'raw' property, try to parse it (JSON parsing failed in callWithStructuredPrompt)
        if (result && typeof result === 'object' && 'raw' in result && typeof result.raw === 'string') {
          try {
            // Try to parse the raw string content
            const parsed = JSON.parse(result.raw)
            result = parsed
          } catch (parseError) {
            // If parsing fails, try extracting JSON from markdown code fences
            try {
              const codeFenceMatch = result.raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
              const cleanedContent = codeFenceMatch && codeFenceMatch[1] ? codeFenceMatch[1] : result.raw
              const objectMatch = cleanedContent.match(/\{[\s\S]*\}/)
              if (objectMatch && objectMatch[0]) {
                result = JSON.parse(objectMatch[0])
              } else {
                result = JSON.parse(cleanedContent.trim())
              }
            } catch (fallbackError) {
              throw new Error(`Failed to parse welcome section response: ${JSON.stringify({ raw: result.raw.substring(0, 200), parseError: parseError instanceof Error ? parseError.message : String(parseError) })}`)
            }
          }
        }

        // Check if result is already a parsed JSON object with intro/tagline/summary
        if (typeof result === 'object' && result !== null &&
            ('intro' in result || 'tagline' in result || 'summary' in result)) {
          welcomeIntro = (result as any).intro || ''
          welcomeTagline = (result as any).tagline || ''
          welcomeSummary = (result as any).summary || ''
        } else {
          throw new Error(`Invalid welcome section response: expected object with intro/tagline/summary, got ${typeof result}`)
        }
      } catch (parseError) {
        throw new Error(`Failed to parse welcome section response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
      }

      // Save all 3 parts to campaign
      const { error: updateError } = await supabaseAdmin
        .from('newsletter_campaigns')
        .update({
          welcome_intro: welcomeIntro,
          welcome_tagline: welcomeTagline,
          welcome_summary: welcomeSummary
        })
        .eq('id', campaignId)

      if (updateError) {
        throw updateError
      }

      return `${welcomeIntro} ${welcomeTagline} ${welcomeSummary}`.trim()
    } catch (error) {
      return ''
    }
  }

  private async logInfo(message: string, context: Record<string, any> = {}) {
    await supabaseAdmin
      .from('system_logs')
      .insert([{
        level: 'info',
        message,
        context,
        source: 'rss_processor'
      }])
  }

  private async logError(message: string, context: Record<string, any> = {}) {
    await supabaseAdmin
      .from('system_logs')
      .insert([{
        level: 'error',
        message,
        context,
        source: 'rss_processor'
      }])
  }

  async generateSubjectLineForCampaign(campaignId: string) {
    try {
      // Get newsletter_id from campaign
      const newsletterId = await this.getNewsletterIdFromCampaign(campaignId)

      // Get the campaign with its articles for subject line generation
      const { data: campaignWithArticles, error: campaignError } = await supabaseAdmin
        .from('newsletter_campaigns')
        .select(`
          id,
          date,
          status,
          subject_line,
          articles:articles(
            headline,
            content,
            is_active,
            rss_post:rss_posts(
              post_rating:post_ratings(total_score)
            )
          )
        `)
        .eq('id', campaignId)
        .single()

      if (campaignError || !campaignWithArticles) {
        throw new Error(`Campaign not found: ${campaignError?.message}`)
      }

      // Check if subject line already exists
      if (campaignWithArticles.subject_line && campaignWithArticles.subject_line.trim()) {
        return
      }

      // Get active articles sorted by AI score
      const activeArticles = campaignWithArticles.articles
        ?.filter((article: any) => article.is_active)
        ?.sort((a: any, b: any) => {
          const scoreA = a.rss_post?.post_rating?.[0]?.total_score || 0
          const scoreB = b.rss_post?.post_rating?.[0]?.total_score || 0
          return scoreB - scoreA
        }) || []

      if (activeArticles.length === 0) {
        return
      }

      // Use the highest scored article for subject line generation
      const topArticle = activeArticles[0] as any

      // Generate subject line using AI_CALL (uses callAIWithPrompt and respects provider setting)
      let result
      try {
        result = await AI_CALL.subjectLineGenerator(topArticle, newsletterId, 100, 0.8)
      } catch (callError) {
        throw new Error(`AI call failed for subject line: ${callError instanceof Error ? callError.message : 'Unknown error'}`)
      }

      // Handle response - subject line should be plain text
      let generatedSubject = ''

      if (typeof result === 'string') {
        generatedSubject = result.trim()
      } else if (typeof result === 'object' && result !== null) {
        // If result has 'raw' property, try to parse it
        if ('raw' in result && typeof result.raw === 'string') {
          generatedSubject = result.raw.trim()
        } else if ('subject_line' in result) {
          generatedSubject = String(result.subject_line).trim()
        } else {
          // Fallback: convert to string
          generatedSubject = JSON.stringify(result)
        }
      } else {
        generatedSubject = String(result).trim()
      }

      if (generatedSubject && generatedSubject.trim()) {
        generatedSubject = generatedSubject.trim()

        // Update campaign with generated subject line
        const { error: updateError } = await supabaseAdmin
          .from('newsletter_campaigns')
          .update({
            subject_line: generatedSubject,
            updated_at: new Date().toISOString()
          })
          .eq('id', campaignId)

        if (updateError) {
          throw updateError
        }
      } else {
        throw new Error('AI returned empty subject line')
      }

    } catch (error) {
      // Don't throw error - continue with RSS processing even if subject generation fails
    }
  }

  async populateEventsForCampaignSmart(campaignId: string) {
    try {

      // Get campaign info to determine the date
      const { data: campaign, error: campaignError } = await supabaseAdmin
        .from('newsletter_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single()

        if (campaignError || !campaign) {
          const errorMsg = campaignError instanceof Error 
            ? campaignError.message 
            : typeof campaignError === 'object' && campaignError !== null
              ? JSON.stringify(campaignError, null, 2)
              : String(campaignError)
          console.error('Failed to fetch campaign for event population:', errorMsg)
        return
      }

      const campaignDate = campaign.date

      // Calculate 3-day range starting from campaign date
      const baseDate = new Date(campaignDate)
      const dates: string[] = []
      for (let i = 0; i <= 2; i++) {
        const date = new Date(baseDate)
        date.setDate(baseDate.getDate() + i)
        dates.push(date.toISOString().split('T')[0])
      }


      // Check if events already exist for this campaign
      const { data: existingEvents, error: existingError } = await supabaseAdmin
        .from('campaign_events')
        .select('*, event:events(*)')
        .eq('campaign_id', campaignId)

      if (existingError) {
        const errorMsg = existingError instanceof Error 
          ? existingError.message 
          : typeof existingError === 'object' && existingError !== null
            ? JSON.stringify(existingError, null, 2)
            : String(existingError)
        console.error('Error checking existing events:', errorMsg)
      }

      const existingEventsByDate: Record<string, any[]> = {}
      if (existingEvents) {
        existingEvents.forEach(ce => {
          const eventDate = ce.event_date
          if (!existingEventsByDate[eventDate]) {
            existingEventsByDate[eventDate] = []
          }
          existingEventsByDate[eventDate].push(ce)
        })
      }

      // Get all available events for the date range
      const startDate = dates[0]
      const endDate = dates[dates.length - 1]

      const { data: availableEvents, error: eventsError } = await supabaseAdmin
        .from('events')
        .select('*')
        .gte('start_date', startDate)
        .lte('start_date', endDate + 'T23:59:59')
        .eq('active', true)
        .order('start_date', { ascending: true })

      if (eventsError) {
        const errorMsg = eventsError instanceof Error 
          ? eventsError.message 
          : typeof eventsError === 'object' && eventsError !== null
            ? JSON.stringify(eventsError, null, 2)
            : String(eventsError)
        console.error('Failed to fetch available events:', errorMsg)
        return
      }

      if (!availableEvents || availableEvents.length === 0) {
        return
      }


      // Group events by date
      const eventsByDate: Record<string, any[]> = {}
      availableEvents.forEach(event => {
        const eventDate = event.start_date.split('T')[0]
        if (dates.includes(eventDate)) {
          if (!eventsByDate[eventDate]) {
            eventsByDate[eventDate] = []
          }
          eventsByDate[eventDate].push(event)
        }
      })

      // Process each date
      const newCampaignEvents: any[] = []

      for (const date of dates) {
        const eventsForDate = eventsByDate[date] || []
        const existingForDate = existingEventsByDate[date] || []


        if (eventsForDate.length === 0) {
          continue
        }

        // Get event IDs already selected for this date
        const alreadySelectedIds = existingForDate.map(ce => ce.event_id)

        // Filter out already selected events AND ensure only active events
        // Double-check active status as a safety measure
        const availableForSelection = eventsForDate.filter(event =>
          !alreadySelectedIds.includes(event.id) && event.active === true
        )

        if (availableForSelection.length === 0) {
          continue
        }

        // Remove duplicate titles by keeping only the earliest created event
        // This prevents selecting test submissions or rejected duplicates
        const seenTitles = new Set<string>()
        const uniqueEvents = availableForSelection.filter(event => {
          const titleKey = event.title.toLowerCase().trim()
          if (seenTitles.has(titleKey)) {
            return false
          }
          seenTitles.add(titleKey)
          return true
        })


        // Separate events by priority:
        // 1. Featured events (from events.featured=true) - MUST be included and featured
        // 2. Paid placement events (from events.paid_placement=true) - MUST be included but NOT featured
        // 3. Regular events - fill remaining spots randomly
        const featuredEvents = uniqueEvents.filter(e => e.featured)
        const paidPlacementEvents = uniqueEvents.filter(e => e.paid_placement && !e.featured)
        const regularEvents = uniqueEvents.filter(e => !e.featured && !e.paid_placement)


        // Determine how many events we can still add (up to 8 total)
        const maxEventsPerDay = 8
        const alreadySelected = existingForDate.length
        let remainingSlots = maxEventsPerDay - alreadySelected

        if (remainingSlots <= 0) {
          continue
        }

        const selectedForDate: any[] = []
        let displayOrder = alreadySelected + 1

        // PRIORITY 1: Add ALL featured events (must be included and featured)
        featuredEvents.forEach(event => {
          if (remainingSlots > 0) {
            selectedForDate.push({
              event,
              is_featured: true,
              display_order: displayOrder++
            })
            remainingSlots--
          }
        })

        // PRIORITY 2: Add ALL paid placement events (must be included but NOT featured)
        paidPlacementEvents.forEach(event => {
          if (remainingSlots > 0) {
            selectedForDate.push({
              event,
              is_featured: false,
              display_order: displayOrder++
            })
            remainingSlots--
          }
        })

        // PRIORITY 3: Fill remaining slots with random regular events
        if (remainingSlots > 0 && regularEvents.length > 0) {
          const shuffled = [...regularEvents].sort(() => Math.random() - 0.5)
          const selectedRegular = shuffled.slice(0, remainingSlots)

          // If NO database-featured events exist for this day, mark the first regular event as featured
          const shouldAutoFeature = featuredEvents.length === 0 && selectedRegular.length > 0

          selectedRegular.forEach((event, index) => {
            selectedForDate.push({
              event,
              is_featured: shouldAutoFeature && index === 0, // First regular event becomes featured if no database-featured exists
              display_order: displayOrder++
            })
          })

        }

        // Add all selected events to campaign_events
        selectedForDate.forEach(({ event, is_featured, display_order }) => {
          newCampaignEvents.push({
            campaign_id: campaignId,
            event_id: event.id,
            event_date: date,
            is_selected: true,
            is_featured,
            display_order
          })
        })

      }

      if (newCampaignEvents.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from('campaign_events')
          .insert(newCampaignEvents)

        if (insertError) {
          throw insertError
        }
      }


    } catch (error) {
      const errorMsg = error instanceof Error 
        ? error.message 
        : typeof error === 'object' && error !== null
          ? JSON.stringify(error, null, 2)
          : String(error)
      console.error('Error in populateEventsForCampaignSmart:', errorMsg)
      await this.logError('Failed to populate events for campaign (smart)', {
        campaignId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  async populateEventsForCampaign(campaignId: string) {
    try {

      // Get campaign info
      const { data: campaign, error: campaignError } = await supabaseAdmin
        .from('newsletter_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single()

        if (campaignError || !campaign) {
          const errorMsg = campaignError instanceof Error 
            ? campaignError.message 
            : typeof campaignError === 'object' && campaignError !== null
              ? JSON.stringify(campaignError, null, 2)
              : String(campaignError)
          console.error('Failed to fetch campaign for event population:', errorMsg)
        return
      }

      // Calculate 3-day range starting from the newsletter date (campaign.date)
      // Day 1: Newsletter date, Day 2: Next day, Day 3: Day after that
      const newsletterDate = new Date(campaign.date + 'T00:00:00') // Parse as local date

      const dates = []
      for (let i = 0; i <= 2; i++) {
        const date = new Date(newsletterDate)
        date.setDate(newsletterDate.getDate() + i)
        dates.push(date.toISOString().split('T')[0])
      }


      // Get available events for the date range
      const startDate = dates[0]
      const endDate = dates[dates.length - 1]

      const { data: availableEvents, error: eventsError } = await supabaseAdmin
        .from('events')
        .select('*')
        .gte('start_date', startDate)
        .lte('start_date', endDate + 'T23:59:59')
        .eq('active', true)
        .order('start_date', { ascending: true })

      if (eventsError) {
        const errorMsg = eventsError instanceof Error 
          ? eventsError.message 
          : typeof eventsError === 'object' && eventsError !== null
            ? JSON.stringify(eventsError, null, 2)
            : String(eventsError)
        console.error('Failed to fetch available events:', errorMsg)
        return
      }

      if (!availableEvents || availableEvents.length === 0) {
        return
      }


      // Clear existing campaign events
      const { error: deleteError } = await supabaseAdmin
        .from('campaign_events')
        .delete()
        .eq('campaign_id', campaignId)

      if (deleteError) {
      }

      // Group events by date and auto-select events per day
      const eventsByDate: { [key: string]: any[] } = {}

      dates.forEach(date => {
        const dateStart = new Date(date + 'T00:00:00-05:00')
        const dateEnd = new Date(date + 'T23:59:59-05:00')

        const eventsForDate = availableEvents.filter(event => {
          const eventStart = new Date(event.start_date)
          const eventEnd = event.end_date ? new Date(event.end_date) : eventStart
          return (eventStart <= dateEnd && eventEnd >= dateStart)
        })

        if (eventsForDate.length > 0) {
          // Separate by priority:
          // 1. Featured events (events.featured=true) - MUST be included and featured
          // 2. Paid placement only (paid_placement=true BUT featured=false) - MUST be included but NOT featured
          // 3. Regular events - fill remaining spots randomly
          const featuredEvents = eventsForDate.filter(e => e.featured)
          const paidPlacementEvents = eventsForDate.filter(e => e.paid_placement && !e.featured)
          const regularEvents = eventsForDate.filter(e => !e.featured && !e.paid_placement)


          // Calculate available slots for regular events (target 8 total)
          const guaranteedEvents = [...featuredEvents, ...paidPlacementEvents]
          const baseSlots = 8
          const remainingSlots = Math.max(0, baseSlots - guaranteedEvents.length)

          // Randomly select regular events to fill remaining slots
          const shuffledRegular = [...regularEvents].sort(() => Math.random() - 0.5)
          const selectedRegular = shuffledRegular.slice(0, remainingSlots)

          // Combine: featured first, then paid placements, then regular
          const selectedEvents = [
            ...featuredEvents,
            ...paidPlacementEvents,
            ...selectedRegular
          ]


          eventsByDate[date] = selectedEvents
        }
      })

      // Insert campaign events
      const campaignEventsData: any[] = []
      let totalSelected = 0

      Object.entries(eventsByDate).forEach(([date, events]) => {
        // Count how many events are marked as featured in the database for this day
        const dbFeaturedCount = events.filter(e => e.featured).length

        events.forEach((event, index) => {
          // Determine if this should be featured in the campaign:
          // - MUST be featured: event.featured=true in database
          // - MUST NOT be featured: event.paid_placement=true (unless also featured=true)
          // - If no featured events exist, first regular event becomes featured (not paid placement)
          let isFeatured = false

          if (event.featured) {
            // Database-marked featured events are ALWAYS featured (even if paid_placement=true)
            isFeatured = true
          } else if (dbFeaturedCount === 0 && !event.paid_placement) {
            // No database featured events - first NON-paid event becomes featured
            // Find if this is the first non-paid event
            const nonPaidIndex = events.filter(e => !e.paid_placement).indexOf(event)
            if (nonPaidIndex === 0) {
              isFeatured = true
            }
          }
          // Note: paid_placement events without featured=true will NEVER be featured

          campaignEventsData.push({
            campaign_id: campaignId,
            event_id: event.id,
            event_date: date,
            is_selected: true,
            is_featured: isFeatured,
            display_order: index + 1
          })
          totalSelected++
        })
      })

      if (campaignEventsData.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from('campaign_events')
          .insert(campaignEventsData)

        if (insertError) {
          return
        }
      }
      await this.logInfo(`Auto-populated ${totalSelected} events for campaign`, {
        campaignId,
        totalSelected,
        daysWithEvents: Object.keys(eventsByDate).length,
        dateRange: dates
      })

    } catch (error) {
      const errorMsg = error instanceof Error 
        ? error.message 
        : typeof error === 'object' && error !== null
          ? JSON.stringify(error, null, 2)
          : String(error)
      console.error('Error in populateEventsForCampaign:', errorMsg)
      await this.logError('Failed to auto-populate events for campaign', {
        campaignId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Extract full article text ONLY for posts from past 24 hours
   * This is much faster than processing all posts (typically 5-10 vs 30-50)
   */
  private async enrichRecentPostsWithFullContent(campaignId: string) {
    try {
      // Calculate 24 hours ago
      const yesterday = new Date()
      yesterday.setHours(yesterday.getHours() - 24)
      const yesterdayTimestamp = yesterday.toISOString()

      // Get posts from past 24 hours that have source URLs and no full_article_text yet
      const { data: posts, error } = await supabaseAdmin
        .from('rss_posts')
        .select('id, source_url, title, full_article_text, processed_at')
        .eq('campaign_id', campaignId)
        .not('source_url', 'is', null)
        .gte('processed_at', yesterdayTimestamp)

      if (error) {
        throw new Error(`Failed to fetch recent posts for extraction: ${error.message}`)
      }

      if (!posts || posts.length === 0) {
        return
      }

      // Filter posts that need extraction (don't have full_article_text yet)
      const postsNeedingExtraction = posts.filter(post => !post.full_article_text)

      if (postsNeedingExtraction.length === 0) {
        return
      }

      // Build URL to post ID mapping
      const urlToPostMap = new Map<string, string>()
      postsNeedingExtraction.forEach(post => {
        if (post.source_url) {
          urlToPostMap.set(post.source_url, post.id)
        }
      })

      const urls = Array.from(urlToPostMap.keys())

      // Extract articles in batches (10 concurrent)
      let extractionResults: Map<string, any>
      try {
        extractionResults = await this.articleExtractor.extractBatch(urls, 10)
      } catch (extractError) {
        return
      }

      // Update database with extracted content
      let successCount = 0

      for (const [url, result] of Array.from(extractionResults.entries())) {
        const postId = urlToPostMap.get(url)
        if (!postId) continue

        if (result.success && result.fullText) {
          const { error: updateError } = await supabaseAdmin
            .from('rss_posts')
            .update({
              full_article_text: result.fullText
            })
            .eq('id', postId)

          if (!updateError) {
            successCount++
          }
        }
      }

    } catch (error) {
      // Don't throw - article extraction is optional
    }
  }

  /**
   * Extract full article text from RSS posts using Readability.js
   * Runs in parallel batches to improve performance
   */
  private async enrichPostsWithFullContent(campaignId: string) {
    try {

      // Get all posts for this campaign that have source URLs
      const { data: posts, error } = await supabaseAdmin
        .from('rss_posts')
        .select('id, source_url, title, full_article_text')
        .eq('campaign_id', campaignId)
        .not('source_url', 'is', null)

      if (error) {
        throw new Error(`Failed to fetch posts for extraction: ${error.message}`)
      }

      if (!posts || posts.length === 0) {
        return
      }


      // Filter posts that need extraction (don't have full_article_text yet)
      const postsNeedingExtraction = posts.filter(post => !post.full_article_text)
      const postsAlreadyExtracted = posts.length - postsNeedingExtraction.length

      if (postsAlreadyExtracted > 0) {
      }

      if (postsNeedingExtraction.length === 0) {
        return
      }

      // Build URL to post ID mapping
      const urlToPostMap = new Map<string, string>()
      postsNeedingExtraction.forEach(post => {
        if (post.source_url) {
          urlToPostMap.set(post.source_url, post.id)
        }
      })

      const urls = Array.from(urlToPostMap.keys())

      // Extract articles in batches (5 concurrent)
      let extractionResults: Map<string, any>
      try {
        extractionResults = await this.articleExtractor.extractBatch(urls, 5)
      } catch {
        return
      }

      // Update database with extracted content
      let successCount = 0
      let failureCount = 0

      for (const [url, result] of Array.from(extractionResults.entries())) {
        const postId = urlToPostMap.get(url)
        if (!postId) continue

        if (result.success && result.fullText) {
          // Update post with full article text
          const { error: updateError } = await supabaseAdmin
            .from('rss_posts')
            .update({
              full_article_text: result.fullText
            })
            .eq('id', postId)

          if (!updateError) {
            successCount++
          } else {
            failureCount++
          }
        } else {
          failureCount++
        }
      }

      await this.logInfo(`Article extraction complete`, {
        campaignId,
        totalPosts: posts.length,
        alreadyExtracted: postsAlreadyExtracted,
        successfulExtractions: successCount,
        failedExtractions: failureCount
      })

    } catch (error) {
      await this.logError('Failed to enrich posts with full article text', {
        campaignId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      // Don't throw - article extraction is optional, RSS processing should continue
    }
  }
}
