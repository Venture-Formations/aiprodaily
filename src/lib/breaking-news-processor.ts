import Parser from 'rss-parser'
import { supabaseAdmin } from './supabase'
import { AI_PROMPTS, callOpenAI } from './openai'
import { ErrorHandler, SlackNotificationService } from './slack'
import type { RssFeed, RssPost } from '@/types/database'

const parser = new Parser({
  customFields: {
    item: ['media:content', 'enclosure']
  }
})

interface BreakingNewsScore {
  score: number
  category: 'breaking' | 'beyond_feed'
  reasoning: string
  key_topics: string[]
  urgency: 'high' | 'medium' | 'low'
  actionable: boolean
}

interface BreakingNewsSummary {
  ai_summary: string
  ai_title: string
}

export class BreakingNewsProcessor {
  private errorHandler: ErrorHandler
  private slack: SlackNotificationService

  constructor() {
    this.errorHandler = new ErrorHandler()
    this.slack = new SlackNotificationService()
  }

  /**
   * Process Breaking News RSS feeds for a campaign
   * This fetches articles from configured RSS feeds, scores them for relevance to accounting,
   * and prepares them for selection in the Breaking News and Beyond the Feed sections
   */
  async processBreakingNewsFeeds(campaignId: string) {
    console.log('Starting Breaking News RSS processing for campaign:', campaignId)

    try {
      // Get active Breaking News RSS feeds
      const { data: feeds, error: feedsError } = await supabaseAdmin
        .from('rss_feeds')
        .select('*')
        .eq('active', true)
        .not('newsletter_id', 'is', null) // Only feeds associated with a newsletter

      if (feedsError) {
        throw new Error(`Failed to fetch Breaking News feeds: ${feedsError.message}`)
      }

      if (!feeds || feeds.length === 0) {
        console.log('No active Breaking News feeds found')
        return
      }

      console.log(`Found ${feeds.length} active Breaking News feeds`)

      // Process each feed
      for (const feed of feeds) {
        try {
          await this.processFeed(feed, campaignId)
        } catch (error) {
          console.error(`Failed to process feed ${feed.name}:`, error)
          await this.logError(`Failed to process Breaking News feed ${feed.name}`, {
            feedId: feed.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          })

          // Update error tracking
          await supabaseAdmin
            .from('rss_feeds')
            .update({
              processing_errors: feed.processing_errors + 1,
              last_error: error instanceof Error ? error.message : 'Unknown error'
            })
            .eq('id', feed.id)
        }
      }

      // Score and categorize articles
      await this.scoreAndCategorizeArticles(campaignId)

      console.log('Breaking News RSS processing completed')

    } catch (error) {
      console.error('Error in Breaking News RSS processing:', error)
      await this.errorHandler.handleError(error, {
        source: 'breaking_news_processor',
        operation: 'processBreakingNewsFeeds',
        campaignId
      })
      throw error
    }
  }

  private async processFeed(feed: RssFeed, campaignId: string) {
    console.log(`Processing Breaking News feed: ${feed.name}`)

    try {
      const rssFeed = await parser.parseURL(feed.url)
      const now = new Date()
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

      // Get posts from the last 3 days (wider window for accounting news)
      const recentPosts = rssFeed.items.filter(item => {
        if (!item.pubDate) return false
        const pubDate = new Date(item.pubDate)
        return pubDate >= threeDaysAgo && pubDate <= now
      })

      console.log(`Found ${recentPosts.length} recent posts from ${feed.name}`)

      for (const item of recentPosts) {
        try {
          // Extract image URL
          let imageUrl = null
          if (item['media:content']) {
            const mediaContent = Array.isArray(item['media:content'])
              ? item['media:content'][0]
              : item['media:content']
            imageUrl = mediaContent?.url || mediaContent?.$?.url
          } else if (item.enclosure?.type?.startsWith('image/')) {
            imageUrl = item.enclosure.url
          }

          // Check if post already exists
          const { data: existingPost } = await supabaseAdmin
            .from('rss_posts')
            .select('id')
            .eq('feed_id', feed.id)
            .eq('external_id', item.guid || item.link || '')
            .single()

          if (existingPost) {
            console.log(`Post already exists: ${item.title}`)
            continue
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
              image_url: imageUrl,
            }])
            .select('id')
            .single()

          if (postError) {
            console.error('Error inserting post:', postError)
            continue
          }

          console.log(`Inserted Breaking News post: ${item.title}`)

        } catch (error) {
          console.error(`Error processing item from ${feed.name}:`, error)
        }
      }

      // Update feed last processed time
      await supabaseAdmin
        .from('rss_feeds')
        .update({
          last_processed: now.toISOString(),
          processing_errors: 0, // Reset error count on success
          last_error: null
        })
        .eq('id', feed.id)

    } catch (error) {
      console.error(`Error parsing Breaking News RSS feed ${feed.name}:`, error)
      throw error
    }
  }

  private async scoreAndCategorizeArticles(campaignId: string) {
    console.log('Starting Breaking News scoring and categorization...')

    // Get all posts for this campaign that haven't been scored yet
    const { data: posts, error } = await supabaseAdmin
      .from('rss_posts')
      .select('*')
      .eq('campaign_id', campaignId)
      .is('breaking_news_score', null) // Only score unscored posts

    if (error || !posts) {
      throw new Error('Failed to fetch posts for Breaking News scoring')
    }

    console.log(`Found ${posts.length} posts to score`)

    // Score posts in batches
    const BATCH_SIZE = 3
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
      const batch = posts.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(posts.length / BATCH_SIZE)

      console.log(`Scoring batch ${batchNum}/${totalBatches} (${batch.length} posts)`)

      const batchPromises = batch.map(async (post, index) => {
        try {
          const overallIndex = i + index + 1
          console.log(`Scoring post ${overallIndex}/${posts.length}: ${post.title}`)

          // Score the article
          const score = await this.scoreArticle(post)

          // Generate summary and title
          const summary = await this.generateSummaryAndTitle(post)

          // Determine category based on score
          const category = score.score >= 70 ? 'breaking' :
                          score.score >= 40 ? 'beyond_feed' : null

          // Update the post with Breaking News data
          const { error: updateError } = await supabaseAdmin
            .from('rss_posts')
            .update({
              breaking_news_score: score.score,
              breaking_news_category: category,
              ai_summary: summary.ai_summary,
              ai_title: summary.ai_title
            })
            .eq('id', post.id)

          if (updateError) {
            console.error(`Failed to update post ${post.id}:`, updateError)
            throw new Error(`Update failed: ${updateError.message}`)
          }

          console.log(`Successfully scored post ${overallIndex}/${posts.length} - Score: ${score.score}, Category: ${category || 'none'}`)
          return { success: true, post }

        } catch (error) {
          console.error(`Error scoring post ${post.id}:`, error)
          await this.logError(`Failed to score post: ${post.title}`, {
            postId: post.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
          return { success: false, post, error }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      const batchSuccess = batchResults.filter(r => r.success).length
      const batchErrors = batchResults.filter(r => !r.success).length

      successCount += batchSuccess
      errorCount += batchErrors

      console.log(`Batch ${batchNum} complete: ${batchSuccess} successful, ${batchErrors} errors`)

      // Add delay between batches
      if (i + BATCH_SIZE < posts.length) {
        console.log('Waiting 2 seconds before next batch...')
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    console.log(`Breaking News scoring complete: ${successCount} successful, ${errorCount} errors`)
    await this.logInfo(`Breaking News scoring complete: ${successCount} successful, ${errorCount} errors`, {
      campaignId,
      successCount,
      errorCount
    })
  }

  private async scoreArticle(post: RssPost): Promise<BreakingNewsScore> {
    const prompt = await AI_PROMPTS.breakingNewsScorer({
      title: post.title,
      description: post.description || '',
      content: post.content || ''
    })

    const result = await callOpenAI(prompt, 1000, 0.3)

    // Validate response
    if (!result.score || typeof result.score !== 'number') {
      throw new Error('Invalid Breaking News scoring response - missing or invalid score')
    }

    return result as BreakingNewsScore
  }

  private async generateSummaryAndTitle(post: RssPost): Promise<BreakingNewsSummary> {
    // Use OpenAI to generate a concise summary and alternative title
    const prompt = `You are summarizing a news article for the AI Accounting Professionals newsletter.

Article Title: ${post.title}
Article Description: ${post.description || ''}
Article Content: ${post.content ? post.content.substring(0, 1500) : ''}

Generate:
1. A concise 2-3 sentence summary highlighting the key information for accounting professionals
2. An alternative headline that is clear, professional, and engaging (max 80 characters)

Respond with ONLY valid JSON in this format:
{
  "ai_summary": "<2-3 sentence summary>",
  "ai_title": "<alternative headline>"
}`

    const result = await callOpenAI(prompt, 500, 0.3)

    if (!result.ai_summary || !result.ai_title) {
      throw new Error('Invalid summary generation response')
    }

    return result as BreakingNewsSummary
  }

  private async logInfo(message: string, context: Record<string, any> = {}) {
    await supabaseAdmin
      .from('system_logs')
      .insert([{
        level: 'info',
        message,
        context,
        source: 'breaking_news_processor'
      }])
  }

  private async logError(message: string, context: Record<string, any> = {}) {
    await supabaseAdmin
      .from('system_logs')
      .insert([{
        level: 'error',
        message,
        context,
        source: 'breaking_news_processor'
      }])
  }
}
