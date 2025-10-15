import Parser from 'rss-parser'
import { supabaseAdmin } from './supabase'
import { AI_PROMPTS, callOpenAI } from './openai' // Oct 7 2025 - Cache bust for 1-20 scale
import { ErrorHandler, SlackNotificationService } from './slack'
import { GitHubImageStorage } from './github-storage'
import { ArticleArchiveService } from './article-archive'
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

  constructor() {
    this.errorHandler = new ErrorHandler()
    this.slack = new SlackNotificationService()
    this.githubStorage = new GitHubImageStorage()
    this.archiveService = new ArticleArchiveService()
  }

  async processAllFeeds() {
    console.log('Starting RSS processing for all feeds...')

    try {
      // Get today's campaign or create one
      const campaignId = await this.getOrCreateTodaysCampaign()
      await this.processAllFeedsForCampaign(campaignId)
    } catch (error) {
      await this.errorHandler.handleError(error, {
        source: 'rss_processor',
        operation: 'processAllFeeds'
      })
      await this.slack.sendRSSProcessingAlert(false, undefined, error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  async processAllFeedsForCampaign(campaignId: string) {
    console.log(`Starting RSS processing for campaign: ${campaignId}`)

    let archiveResult: any = null

    try {
      // STEP 0: Archive existing articles and posts before clearing (PRESERVES POSITION DATA!)
      console.log('Archiving existing articles and posts before clearing...')

      try {
        archiveResult = await this.archiveService.archiveCampaignArticles(campaignId, 'rss_processing_clear')
        console.log(`✅ Archive successful: ${archiveResult.archivedArticlesCount} articles, ${archiveResult.archivedPostsCount} posts, ${archiveResult.archivedRatingsCount} ratings preserved`)

        // Log specifically about position data preservation
        if (archiveResult.archivedArticlesCount > 0) {
          const { data: articlesWithPositions } = await supabaseAdmin
            .from('articles')
            .select('id, review_position, final_position')
            .eq('campaign_id', campaignId)
            .or('review_position.not.is.null,final_position.not.is.null')

          if (articlesWithPositions && articlesWithPositions.length > 0) {
            console.log(`📊 Preserved position data for ${articlesWithPositions.length} articles with tracking information`)
          }
        }
      } catch (archiveError) {
        // Archive failure shouldn't block RSS processing, but we should log it
        console.warn('⚠️ Archive failed, but continuing with RSS processing:', archiveError)
        await this.errorHandler.logInfo('Archive failed but RSS processing continuing', {
          campaignId,
          archiveError: archiveError instanceof Error ? archiveError.message : 'Unknown error'
        }, 'rss_processor')
      }

      // Clear previous articles and posts for this campaign to allow fresh processing
      console.log('Clearing previous articles and posts...')

      // Delete existing articles for this campaign
      const { error: articlesDeleteError } = await supabaseAdmin
        .from('articles')
        .delete()
        .eq('campaign_id', campaignId)

      if (articlesDeleteError) {
        console.warn('Warning: Failed to delete previous articles:', articlesDeleteError)
      } else {
        console.log('Previous articles cleared successfully')
      }

      // Delete existing posts for this campaign
      const { error: postsDeleteError } = await supabaseAdmin
        .from('rss_posts')
        .delete()
        .eq('campaign_id', campaignId)

      if (postsDeleteError) {
        console.warn('Warning: Failed to delete previous posts:', postsDeleteError)
      } else {
        console.log('Previous posts cleared successfully')
      }

      // Get active RSS feeds
      const { data: feeds, error: feedsError } = await supabaseAdmin
        .from('rss_feeds')
        .select('*')
        .eq('active', true)

      if (feedsError) {
        throw new Error(`Failed to fetch feeds: ${feedsError.message}`)
      }

      if (!feeds || feeds.length === 0) {
        await this.logError('No active RSS feeds found')
        return
      }

      // Process each feed
      for (const feed of feeds) {
        try {
          await this.processFeed(feed, campaignId)
        } catch (error) {
          await this.logError(`Failed to process feed ${feed.name}`, {
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

      // Populate events for this campaign BEFORE processing articles
      console.log('Populating events for campaign...')
      try {
        await this.populateEventsForCampaignSmart(campaignId)
        console.log('✅ Events populated successfully')
      } catch (eventError) {
        console.error('Failed to populate events, but continuing:', eventError)
        // Don't fail the entire RSS processing if event population fails
      }

      // Process posts with AI
      await this.processPostsWithAI(campaignId)

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
    // Use Central Time for consistent date calculations
    const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
    const centralDate = new Date(nowCentral)
    const today = centralDate.toISOString().split('T')[0]

    // Check if campaign exists for today
    const { data: existing } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id')
      .eq('date', today)
      .single()

    if (existing) {
      return existing.id
    }

    // Create new campaign with processing status
    const { data: newCampaign, error } = await supabaseAdmin
      .from('newsletter_campaigns')
      .insert([{ date: today, status: 'processing' }])
      .select('id')
      .single()

    if (error || !newCampaign) {
      throw new Error('Failed to create campaign')
    }

    return newCampaign.id
  }

  private async processFeed(feed: RssFeed, campaignId: string) {
    console.log(`=== PROCESSING FEED: ${feed.name} ===`)

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

      if (excludedSources.length > 0) {
        console.log(`Excluded sources: ${excludedSources.join(', ')}`)
      }

      const rssFeed = await parser.parseURL(feed.url)
      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      const recentPosts = rssFeed.items.filter(item => {
        if (!item.pubDate) return false
        const pubDate = new Date(item.pubDate)
        return pubDate >= yesterday && pubDate <= now
      })

      console.log(`Found ${recentPosts.length} recent posts from ${feed.name}`)

      for (const item of recentPosts) {
        try {
          // Check if author's images should be blocked
          const author = item.creator || (item as any)['dc:creator'] || '(No Author)'
          const blockImages = excludedSources.includes(author)
          if (blockImages) {
            console.log(`Blocking images from source: "${author}" - "${item.title}"`)
          }
          console.log(`\n=== DEBUGGING ITEM: "${item.title}" ===`)
          console.log('Raw item keys:', Object.keys(item))
          console.log('media:content:', JSON.stringify(item['media:content'], null, 2))
          console.log('Raw content preview:', (item.content || '').substring(0, 200))
          console.log('Raw contentSnippet:', (item.contentSnippet || '').substring(0, 200))

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

          console.log(`Post: "${item.title}" - Image URL: ${imageUrl || 'None found'}`)

          // Check if post already exists
          const { data: existingPost } = await supabaseAdmin
            .from('rss_posts')
            .select('id')
            .eq('feed_id', feed.id)
            .eq('external_id', item.guid || item.link || '')
            .single()

          if (existingPost) {
            continue // Skip if already processed
          }

          // Attempt to download and re-host image immediately if it's a Facebook URL
          // But only if images are not blocked for this source
          let finalImageUrl = imageUrl
          if (!blockImages && imageUrl && imageUrl.includes('fbcdn.net')) {
            console.log(`Attempting to re-host Facebook image immediately: ${imageUrl}`)
            try {
              const githubUrl = await this.githubStorage.uploadImage(imageUrl, item.title || 'Untitled')
              if (githubUrl) {
                finalImageUrl = githubUrl
                console.log(`Successfully re-hosted Facebook image: ${githubUrl}`)
              } else {
                console.warn(`Failed to re-host Facebook image, keeping original URL: ${imageUrl}`)
              }
            } catch (error) {
              console.warn(`Error re-hosting Facebook image: ${error}`)
            }
          }

          // Block image if source is in excluded list
          if (blockImages) {
            finalImageUrl = null
            console.log(`Image blocked for excluded source: ${author}`)
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
            console.error('Error inserting post:', postError)
            continue
          }

          console.log(`Inserted post: ${item.title}`)

        } catch (error) {
          console.error(`Error processing item from ${feed.name}:`, error)
        }
      }

      // Update feed last processed time
      await supabaseAdmin
        .from('rss_feeds')
        .update({
          last_processed: now.toISOString(),
          processing_errors: 0 // Reset error count on success
        })
        .eq('id', feed.id)

    } catch (error) {
      console.error(`Error parsing RSS feed ${feed.name}:`, error)
      throw error
    }
  }

  private async processPostsWithAI(campaignId: string) {
    console.log('Starting AI processing of posts...')

    // Get all posts for this campaign
    const { data: posts, error } = await supabaseAdmin
      .from('rss_posts')
      .select('*')
      .eq('campaign_id', campaignId)

    if (error || !posts) {
      throw new Error('Failed to fetch posts for AI processing')
    }

    console.log(`Processing ${posts.length} posts with AI`)

    // Step 1: Evaluate posts in batches
    const BATCH_SIZE = 3 // Process 3 posts at a time
    let successCount = 0
    let errorCount = 0

    // Split posts into batches
    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
      const batch = posts.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(posts.length / BATCH_SIZE)

      console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} posts)`)

      // Process batch concurrently
      const batchPromises = batch.map(async (post, index) => {
        try {
          const overallIndex = i + index + 1
          console.log(`Evaluating post ${overallIndex}/${posts.length}: ${post.title}`)

          const evaluation = await this.evaluatePost(post)

          // Basic validation: ensure scores exist and are numbers
          if (typeof evaluation.interest_level !== 'number' ||
              typeof evaluation.local_relevance !== 'number' ||
              typeof evaluation.community_impact !== 'number') {
            console.error(`AI returned non-numeric scores: interest=${evaluation.interest_level}, local=${evaluation.local_relevance}, impact=${evaluation.community_impact}`)
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
            console.error(`Failed to insert rating for post ${post.id}:`, ratingError)
            throw new Error(`Rating insert failed: ${ratingError.message}`)
          }

          console.log(`Successfully evaluated post ${overallIndex}/${posts.length}`)
          return { success: true, post: post }

        } catch (error) {
          console.error(`Error evaluating post ${post.id}:`, error)

          // Log error to database
          await this.logError(`Failed to evaluate post: ${post.title}`, {
            postId: post.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          })

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

      console.log(`Batch ${batchNum} complete: ${batchSuccess} successful, ${batchErrors} errors`)

      // Add delay between batches to respect rate limits
      if (i + BATCH_SIZE < posts.length) {
        console.log('Waiting 2 seconds before next batch...')
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    console.log(`AI evaluation complete: ${successCount} successful, ${errorCount} errors`)
    await this.logInfo(`AI evaluation complete: ${successCount} successful, ${errorCount} errors`, { campaignId, successCount, errorCount })

    // Step 2: Detect and handle duplicates
    await this.handleDuplicates(posts, campaignId)

    // Step 3: Generate newsletter articles for top posts
    await this.logInfo('Starting newsletter article generation...', { campaignId })
    await this.generateNewsletterArticles(campaignId)
  }

  private async evaluatePost(post: RssPost): Promise<ContentEvaluation> {
    // Fetch enabled criteria configuration from database
    const { data: criteriaConfig, error: configError } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .or('key.eq.criteria_enabled_count,key.like.criteria_%_name,key.like.criteria_%_weight')

    if (configError) {
      console.error('Failed to fetch criteria configuration:', configError)
      throw new Error('Failed to fetch criteria configuration')
    }

    // Parse criteria configuration
    const enabledCountSetting = criteriaConfig?.find(s => s.key === 'criteria_enabled_count')
    const enabledCount = enabledCountSetting?.value ? parseInt(enabledCountSetting.value) : 3

    console.log(`Evaluating post with ${enabledCount} enabled criteria`)

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
        console.log(`Evaluating criterion ${criterion.number}: ${criterion.name} (weight: ${criterion.weight})`)

        // Call the appropriate criteria evaluator
        const evaluatorKey = `criteria${criterion.number}Evaluator` as keyof typeof AI_PROMPTS
        const evaluator = AI_PROMPTS[evaluatorKey]

        if (typeof evaluator !== 'function') {
          console.error(`No evaluator found for criterion ${criterion.number}`)
          continue
        }

        // Type assertion to help TypeScript understand this is a function
        const evaluatorFn = evaluator as (post: { title: string; description: string; content?: string }) => Promise<string>
        const prompt = await evaluatorFn({
          title: post.title,
          description: post.description || '',
          content: post.content || ''
        })

        const result = await callOpenAI(prompt)

        // Parse the AI response
        let score: number
        let reason: string

        if (result.raw && typeof result.raw === 'string') {
          try {
            const parsed = JSON.parse(result.raw)
            score = parsed.score
            reason = parsed.reason || ''
          } catch (parseError) {
            console.error(`Failed to parse criterion ${criterion.number} response:`, result.raw)
            throw new Error(`Invalid criterion ${criterion.number} response format`)
          }
        } else if (typeof result.score === 'number') {
          score = result.score
          reason = result.reason || ''
        } else {
          throw new Error(`Invalid criterion ${criterion.number} response format`)
        }

        // Validate score is a number between 0-10
        if (typeof score !== 'number' || score < 0 || score > 10) {
          console.error(`Invalid score for criterion ${criterion.number}: ${score}`)
          throw new Error(`Criterion ${criterion.number} score must be between 0-10`)
        }

        criteriaScores.push({
          score,
          reason,
          weight: criterion.weight
        })

        console.log(`Criterion ${criterion.number} score: ${score}/10`)

      } catch (error) {
        console.error(`Error evaluating criterion ${criterion.number}:`, error)
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
    const maxPossibleScore = totalWeight * 10

    console.log(`Total weighted score: ${totalWeightedScore} (max possible: ${maxPossibleScore})`)

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

  private async handleDuplicates(posts: RssPost[], campaignId: string) {
    if (posts.length < 2) return

    const postSummaries = posts.map(post => ({
      title: post.title,
      description: post.description || ''
    }))

    try {
      const prompt = await AI_PROMPTS.topicDeduper(postSummaries)
      const result = await callOpenAI(prompt)

      console.log('=== TOPIC DEDUPER RESULT ===')
      console.log('Result type:', typeof result)
      console.log('Has groups?', !!result.groups)
      console.log('Groups length:', result.groups?.length || 0)
      console.log('Full result:', JSON.stringify(result, null, 2))

      if (result.groups) {
        for (const group of result.groups) {
          const primaryPost = posts[group.primary_article_index]
          if (!primaryPost) continue

          // Create duplicate group
          const { data: duplicateGroup } = await supabaseAdmin
            .from('duplicate_groups')
            .insert([{
              campaign_id: campaignId,
              primary_post_id: primaryPost.id,
              topic_signature: group.topic_signature
            }])
            .select('id')
            .single()

          if (duplicateGroup) {
            // Add duplicate posts to group
            for (const dupIndex of group.duplicate_indices) {
              const dupPost = posts[dupIndex]
              if (dupPost && dupPost.id !== primaryPost.id) {
                await supabaseAdmin
                  .from('duplicate_posts')
                  .insert([{
                    group_id: duplicateGroup.id,
                    post_id: dupPost.id,
                    similarity_score: 0.8 // Default similarity
                  }])
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error handling duplicates:', error)
    }
  }

  private async generateNewsletterArticles(campaignId: string) {
    console.log('Starting newsletter article generation...')

    // Get posts with ratings and check for duplicates
    const { data: topPosts, error: queryError } = await supabaseAdmin
      .from('rss_posts')
      .select(`
        *,
        post_ratings(*)
      `)
      .eq('campaign_id', campaignId)
      // NO LIMIT - Get ALL posts for this campaign

    // Get duplicate post IDs to exclude
    const { data: duplicatePosts } = await supabaseAdmin
      .from('duplicate_posts')
      .select(`
        post_id,
        group:duplicate_groups!inner(campaign_id)
      `)
      .eq('group.campaign_id', campaignId)

    const duplicatePostIds = new Set(duplicatePosts?.map(d => d.post_id) || [])
    console.log(`Found ${duplicatePostIds.size} duplicate posts to exclude`)

    if (queryError) {
      console.error('Error fetching top posts:', queryError)
      await this.logError('Error fetching top posts for article generation', { campaignId, queryError: queryError.message })
      return
    }

    if (!topPosts || topPosts.length === 0) {
      console.log('No top posts found for article generation')
      await this.logInfo('No top posts found for article generation', { campaignId })
      return
    }

    console.log(`Found ${topPosts.length} top posts for article generation`)
    await this.logInfo(`Found ${topPosts.length} top posts for article generation`, { campaignId, topPostsCount: topPosts.length })

    const postsWithRatings = topPosts
      .filter(post => post.post_ratings?.[0] && !duplicatePostIds.has(post.id)) // Exclude duplicates
      .sort((a, b) => {
        const scoreA = a.post_ratings?.[0]?.total_score || 0
        const scoreB = b.post_ratings?.[0]?.total_score || 0
        return scoreB - scoreA
      })
      // Generate articles for ALL non-duplicate posts, not just top 12

    console.log(`${postsWithRatings.length} posts have ratings`)
    await this.logInfo(`${postsWithRatings.length} posts have ratings`, { campaignId, postsWithRatings: postsWithRatings.length })

    if (postsWithRatings.length === 0) {
      console.log('No posts with ratings found - checking all posts with ratings')
      await this.logInfo('No posts with ratings found - checking alternative query', { campaignId })

      // Try a simpler query to get posts with ratings
      const { data: allRatedPosts } = await supabaseAdmin
        .from('rss_posts')
        .select(`
          *,
          post_ratings(*)
        `)
        .eq('campaign_id', campaignId)
        .not('post_ratings', 'is', null)

      console.log(`Alternative query found ${allRatedPosts?.length || 0} posts with ratings`)
      await this.logInfo(`Alternative query found ${allRatedPosts?.length || 0} posts with ratings`, { campaignId, alternativePostsCount: allRatedPosts?.length || 0 })

      if (allRatedPosts && allRatedPosts.length > 0) {
        // Use these posts instead, excluding duplicates
        const filteredPosts = allRatedPosts.filter(post => !duplicatePostIds.has(post.id))
        // Generate articles for ALL non-duplicate posts
        for (const post of filteredPosts) {
          await this.processPostIntoArticle(post, campaignId)
        }
      }
      return
    }

    for (const post of postsWithRatings) {
      await this.processPostIntoArticle(post, campaignId)
    }

    console.log('Newsletter article generation complete')

    // Auto-select top 5 articles based on ratings
    console.log('=== ABOUT TO SELECT TOP 5 ARTICLES ===')
    await this.selectTop5Articles(campaignId)
    console.log('=== TOP 5 ARTICLES SELECTION COMPLETE ===')

    // Download and store images for selected articles
    console.log('=== ABOUT TO PROCESS ARTICLE IMAGES ===')
    await this.processArticleImages(campaignId)
    console.log('=== ARTICLE IMAGE PROCESSING COMPLETE ===')
  }

  private async selectTop5Articles(campaignId: string) {
    try {
      console.log('Selecting top articles for campaign (dynamic count from settings):', campaignId)

      // Get max_top_articles setting (defaults to 3)
      const { data: maxTopArticlesSetting } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'max_top_articles')
        .single()

      const finalArticleCount = maxTopArticlesSetting ? parseInt(maxTopArticlesSetting.value) : 3
      console.log(`Max top articles setting: ${finalArticleCount}`)

      // Get all articles for this campaign with their ratings AND fact-check scores
      // Only select articles that PASSED the fact-check (score >= 15)
      const { data: articles, error } = await supabaseAdmin
        .from('articles')
        .select(`
          id,
          fact_check_score,
          rss_post:rss_posts(
            post_rating:post_ratings(total_score)
          )
        `)
        .eq('campaign_id', campaignId)
        .gte('fact_check_score', 15)

      if (error || !articles) {
        console.error('Failed to fetch articles for top selection:', error)
        return
      }

      // Sort articles by rating (highest first)
      const sortedArticles = articles
        .map((article: any) => ({
          id: article.id,
          score: article.rss_post?.post_rating?.[0]?.total_score || 0
        }))
        .sort((a, b) => b.score - a.score)

      console.log(`Selecting top ${finalArticleCount} articles from ${sortedArticles.length} total`)

      // Only activate the top N articles
      const topArticles = sortedArticles.slice(0, finalArticleCount)

      for (let i = 0; i < topArticles.length; i++) {
        const article = topArticles[i]
        await supabaseAdmin
          .from('articles')
          .update({
            is_active: true,
            rank: i + 1  // Rank 1, 2, 3...
          })
          .eq('id', article.id)
      }

      console.log(`Activated top ${topArticles.length} articles`)

      // Generate subject line using the top-ranked article
      console.log('=== GENERATING SUBJECT LINE (After Article Selection) ===')
      await this.generateSubjectLineForCampaign(campaignId)
      console.log('=== SUBJECT LINE GENERATION COMPLETED ===')

      console.log('Article selection complete')
    } catch (error) {
      console.error('Error selecting top articles:', error)
    }
  }

  private async processArticleImages(campaignId: string) {
    try {
      console.log('=== STARTING IMAGE PROCESSING (GitHub) ===')
      console.log('Campaign ID:', campaignId)

      // Log that image processing function is running
      console.log('Image processing function started at:', new Date().toISOString())

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
        console.error('Failed to fetch active articles for image processing:', error)
        await this.logError('Failed to fetch active articles for image processing', { campaignId, error: error?.message })
        return
      }

      console.log(`Found ${articles.length} active articles to process images for`)

      // Log details about each article
      articles.forEach((article: any, index: number) => {
        const rssPost = Array.isArray(article.rss_post) ? article.rss_post[0] : article.rss_post
        console.log(`Article ${index + 1}: ID=${article.id}, RSS Post Image URL=${rssPost?.image_url || 'None'}, Title=${rssPost?.title || 'Unknown'}`)
      })

      // Process images for each article
      let downloadCount = 0
      let skipCount = 0
      let errorCount = 0

      for (const article of articles) {
        try {
          const rssPost = Array.isArray(article.rss_post) ? article.rss_post[0] : article.rss_post

          if (!rssPost?.image_url) {
            console.log(`No image URL for article ${article.id}, skipping`)
            skipCount++
            continue
          }

          const originalImageUrl = rssPost.image_url
          console.log(`Processing image for article ${article.id}: ${originalImageUrl}`)

          // Skip if already a GitHub URL
          if (originalImageUrl.includes('github.com') || originalImageUrl.includes('githubusercontent.com')) {
            console.log(`Image already hosted on GitHub: ${originalImageUrl}`)
            skipCount++
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

            console.log(`Successfully uploaded image to GitHub: ${githubUrl}`)
            downloadCount++
          } else {
            console.error(`Failed to upload image to GitHub for article ${article.id}`)
            errorCount++
          }

        } catch (error) {
          console.error(`Error processing image for article ${article.id}:`, error)
          errorCount++
        }
      }

      console.log(`Image processing complete: ${downloadCount} uploaded to GitHub, ${skipCount} skipped (already hosted), ${errorCount} errors`)
      await this.logInfo(`Image processing complete: ${downloadCount} uploaded to GitHub, ${skipCount} skipped, ${errorCount} errors`, {
        campaignId,
        downloadCount,
        skipCount,
        errorCount
      })

    } catch (error) {
      console.error('Error in processArticleImages:', error)
      await this.logError('Error in processArticleImages', { campaignId, error: error instanceof Error ? error.message : 'Unknown error' })
    }
  }


  private async processPostIntoArticle(post: any, campaignId: string) {
    try {
      console.log(`Generating article for: ${post.title}`)

      // Generate newsletter content
      const content = await this.generateNewsletterContent(post)

      // Fact-check the content
      const factCheck = await this.factCheckContent(content.content, post.content || post.description || '')

      console.log(`Fact-check result for "${post.title}": ${factCheck.passed ? 'PASSED' : 'FAILED'} (score: ${factCheck.score})`)

      // Store ALL articles (both passed and failed) so we can review what's being rejected
      const { data, error } = await supabaseAdmin
        .from('articles')
        .insert([{
          post_id: post.id,
          campaign_id: campaignId,
          headline: content.headline,
          content: content.content,
          rank: null, // Will be set by ranking algorithm
          is_active: false, // Only passed articles can be activated
          fact_check_score: factCheck.score,
          fact_check_details: factCheck.details,
          word_count: content.word_count
        }])

      if (error) {
        console.error(`Error inserting article for post ${post.id}:`, error)
      } else {
        const status = factCheck.passed ? 'PASSED' : 'FAILED'
        console.log(`Successfully stored article (${status}): "${content.headline}"`)
        await this.logInfo(`Successfully stored article (${status}): "${content.headline}"`, {
          campaignId,
          postId: post.id,
          factCheckPassed: factCheck.passed,
          factCheckScore: factCheck.score
        })
      }

    } catch (error) {
      console.error(`Error generating article for post ${post.id}:`, error)
      await this.logError(`Error generating article for post: ${post.title}`, {
        postId: post.id,
        campaignId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
    }
  }

  private async generateNewsletterContent(post: RssPost): Promise<NewsletterContent> {
    // Check if articleWriter prompt exists in database, fallback to newsletterWriter
    let prompt: string
    try {
      // First try articleWriter for accounting newsletter
      prompt = await AI_PROMPTS.articleWriter({
        title: post.title,
        description: post.description || '',
        content: post.content || '',
        source_url: post.source_url || ''
      })
      console.log('Using articleWriter prompt for article generation')
    } catch (error) {
      // Fallback to newsletterWriter if articleWriter doesn't exist
      console.log('articleWriter not found, falling back to newsletterWriter')
      prompt = await AI_PROMPTS.newsletterWriter({
        title: post.title,
        description: post.description || '',
        content: post.content || '',
        source_url: post.source_url || ''
      })
    }

    const result = await callOpenAI(prompt)

    if (!result.headline || !result.content || !result.word_count) {
      throw new Error('Invalid newsletter content response')
    }

    return result as NewsletterContent
  }

  private async factCheckContent(newsletterContent: string, originalContent: string): Promise<FactCheckResult> {
    const prompt = await AI_PROMPTS.factChecker(newsletterContent, originalContent)
    const result = await callOpenAI(prompt)

    if (typeof result.score !== 'number' || typeof result.passed !== 'boolean') {
      throw new Error('Invalid fact-check response')
    }

    return result as FactCheckResult
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
      console.log('Starting subject line generation for campaign:', campaignId)

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
        console.error('Failed to fetch campaign for subject generation:', campaignError)
        throw new Error(`Campaign not found: ${campaignError?.message}`)
      }

      // Check if subject line already exists
      if (campaignWithArticles.subject_line && campaignWithArticles.subject_line.trim()) {
        console.log('Subject line already exists:', campaignWithArticles.subject_line)
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
        console.log('No active articles found for subject line generation')
        return
      }

      // Use the highest scored article for subject line generation
      const topArticle = activeArticles[0] as any
      console.log(`Using top article for subject line generation:`)
      console.log(`- Headline: ${topArticle.headline}`)
      console.log(`- AI Score: ${topArticle.rss_post?.post_rating?.[0]?.total_score || 0}`)

      // Generate subject line using AI
      const timestamp = new Date().toISOString()
      const subjectPrompt = await AI_PROMPTS.subjectLineGenerator([topArticle]) + `\n\nTimestamp: ${timestamp}`

      console.log('Generating AI subject line...')
      const aiResponse = await callOpenAI(subjectPrompt, 100, 0.8)

      // The AI now returns plain text, not JSON
      let generatedSubject = ''

      if (typeof aiResponse === 'string') {
        generatedSubject = aiResponse
      } else if (typeof aiResponse === 'object' && aiResponse && 'raw' in aiResponse) {
        generatedSubject = (aiResponse as any).raw
      } else if (typeof aiResponse === 'object') {
        // Fallback: convert to string
        generatedSubject = JSON.stringify(aiResponse)
      }

      if (generatedSubject && generatedSubject.trim()) {
        generatedSubject = generatedSubject.trim()
        console.log('Generated subject line:', generatedSubject)

        // Update campaign with generated subject line
        const { error: updateError } = await supabaseAdmin
          .from('newsletter_campaigns')
          .update({
            subject_line: generatedSubject,
            updated_at: new Date().toISOString()
          })
          .eq('id', campaignId)

        if (updateError) {
          console.error('Failed to update campaign with subject line:', updateError)
          throw updateError
        } else {
          console.log('Successfully updated campaign with AI-generated subject line')
        }
      } else {
        console.error('AI failed to generate subject line - empty response')
        throw new Error('AI returned empty subject line')
      }

    } catch (error) {
      console.error('Subject line generation failed:', error)
      await this.logError('Failed to generate subject line for campaign', {
        campaignId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      // Don't throw error - continue with RSS processing even if subject generation fails
    }
  }

  async populateEventsForCampaignSmart(campaignId: string) {
    try {
      console.log('Starting smart event population for campaign:', campaignId)

      // Get campaign info to determine the date
      const { data: campaign, error: campaignError } = await supabaseAdmin
        .from('newsletter_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single()

      if (campaignError || !campaign) {
        console.error('Failed to fetch campaign for event population:', campaignError)
        return
      }

      const campaignDate = campaign.date
      console.log('Populating events for campaign date:', campaignDate)

      // Calculate 3-day range starting from campaign date
      const baseDate = new Date(campaignDate)
      const dates: string[] = []
      for (let i = 0; i <= 2; i++) {
        const date = new Date(baseDate)
        date.setDate(baseDate.getDate() + i)
        dates.push(date.toISOString().split('T')[0])
      }

      console.log('Event date range:', dates)

      // Check if events already exist for this campaign
      const { data: existingEvents, error: existingError } = await supabaseAdmin
        .from('campaign_events')
        .select('*, event:events(*)')
        .eq('campaign_id', campaignId)

      if (existingError) {
        console.error('Error checking existing events:', existingError)
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
        console.error('Failed to fetch available events:', eventsError)
        return
      }

      if (!availableEvents || availableEvents.length === 0) {
        console.log('No events found for date range, skipping event population')
        return
      }

      console.log(`Found ${availableEvents.length} available events`)

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

        console.log(`Processing ${date}: ${eventsForDate.length} available events, ${existingForDate.length} already selected`)

        if (eventsForDate.length === 0) {
          console.log(`No events available for ${date}`)
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
          console.log(`No new events available for ${date}`)
          continue
        }

        // Remove duplicate titles by keeping only the earliest created event
        // This prevents selecting test submissions or rejected duplicates
        const seenTitles = new Set<string>()
        const uniqueEvents = availableForSelection.filter(event => {
          const titleKey = event.title.toLowerCase().trim()
          if (seenTitles.has(titleKey)) {
            console.log(`⚠️ Skipping duplicate event: "${event.title}" (ID: ${event.id})`)
            return false
          }
          seenTitles.add(titleKey)
          return true
        })

        console.log(`After removing duplicates: ${uniqueEvents.length} unique events available for ${date}`)

        // Separate events by priority:
        // 1. Featured events (from events.featured=true) - MUST be included and featured
        // 2. Paid placement events (from events.paid_placement=true) - MUST be included but NOT featured
        // 3. Regular events - fill remaining spots randomly
        const featuredEvents = uniqueEvents.filter(e => e.featured)
        const paidPlacementEvents = uniqueEvents.filter(e => e.paid_placement && !e.featured)
        const regularEvents = uniqueEvents.filter(e => !e.featured && !e.paid_placement)

        console.log(`Available for ${date}: ${featuredEvents.length} featured, ${paidPlacementEvents.length} paid placement, ${regularEvents.length} regular`)

        // Determine how many events we can still add (up to 8 total)
        const maxEventsPerDay = 8
        const alreadySelected = existingForDate.length
        let remainingSlots = maxEventsPerDay - alreadySelected

        if (remainingSlots <= 0) {
          console.log(`Already have enough events for ${date}`)
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
            console.log(`✨ Featured event MUST be included: "${event.title}" for ${date}`)
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
            console.log(`💰 Paid placement event MUST be included: "${event.title}" for ${date}`)
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

          console.log(`Selected ${selectedRegular.length} regular events randomly for ${date}${shouldAutoFeature ? ' (first marked as featured)' : ''}`)
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

        console.log(`Total selected for ${date}: ${selectedForDate.length} events (${selectedForDate.filter(s => s.is_featured).length} featured)`)
      }

      // Insert new campaign events
      if (newCampaignEvents.length > 0) {
        console.log(`Inserting ${newCampaignEvents.length} new campaign events`)

        const { error: insertError } = await supabaseAdmin
          .from('campaign_events')
          .insert(newCampaignEvents)

        if (insertError) {
          console.error('Error inserting campaign events:', insertError)
          throw insertError
        }

        console.log('Successfully inserted new campaign events')
      } else {
        console.log('No new events to insert')
      }

      console.log('Smart event population completed successfully')

    } catch (error) {
      console.error('Error in populateEventsForCampaignSmart:', error)
      await this.logError('Failed to populate events for campaign (smart)', {
        campaignId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  async populateEventsForCampaign(campaignId: string) {
    try {
      console.log('Starting automatic event population for campaign:', campaignId)

      // Get campaign info
      const { data: campaign, error: campaignError } = await supabaseAdmin
        .from('newsletter_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single()

      if (campaignError || !campaign) {
        console.error('Failed to fetch campaign for event population:', campaignError)
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

      console.log('Event population date range:', dates)

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
        console.error('Failed to fetch available events:', eventsError)
        return
      }

      if (!availableEvents || availableEvents.length === 0) {
        console.log('No events found for date range, skipping event population')
        return
      }

      console.log(`Found ${availableEvents.length} available events for population`)

      // Clear existing campaign events
      const { error: deleteError } = await supabaseAdmin
        .from('campaign_events')
        .delete()
        .eq('campaign_id', campaignId)

      if (deleteError) {
        console.warn('Warning: Failed to clear existing campaign events:', deleteError)
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

          console.log(`${date}: ${featuredEvents.length} featured, ${paidPlacementEvents.length} paid placement, ${regularEvents.length} regular events`)

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

          if (guaranteedEvents.length > baseSlots) {
            console.log(`Note: ${guaranteedEvents.length} featured/paid events exceed ${baseSlots} base slots for ${date}. All will be included (total: ${selectedEvents.length}).`)
          }

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
          console.error('Failed to insert campaign events:', insertError)
          return
        }
      }

      console.log(`Auto-populated ${totalSelected} events across ${Object.keys(eventsByDate).length} days`)
      await this.logInfo(`Auto-populated ${totalSelected} events for campaign`, {
        campaignId,
        totalSelected,
        daysWithEvents: Object.keys(eventsByDate).length,
        dateRange: dates
      })

    } catch (error) {
      console.error('Error in populateEventsForCampaign:', error)
      await this.logError('Failed to auto-populate events for campaign', {
        campaignId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}