import { supabaseAdmin } from '../supabase'
import type { RSSProcessorContext } from './shared-context'
import { logInfo, logError } from './shared-context'

/**
 * Article text extraction module.
 * Handles extracting full article text from source URLs using Readability.js.
 */
export class ArticleExtraction {
  private ctx: RSSProcessorContext

  constructor(ctx: RSSProcessorContext) {
    this.ctx = ctx
  }

  /**
   * Extract full article text ONLY for posts from past 24 hours
   * This is much faster than processing all posts (typically 5-10 vs 30-50)
   */
  async enrichRecentPostsWithFullContent(issueId: string) {
    try {
      const yesterday = new Date()
      yesterday.setHours(yesterday.getHours() - 24)
      const yesterdayTimestamp = yesterday.toISOString()

      const { data: posts, error } = await supabaseAdmin
        .from('rss_posts')
        .select('id, source_url, title, full_article_text, processed_at')
        .eq('issue_id', issueId)
        .not('source_url', 'is', null)
        .gte('processed_at', yesterdayTimestamp)

      if (error) {
        throw new Error(`Failed to fetch recent posts for extraction: ${error.message}`)
      }

      if (!posts || posts.length === 0) {
        return
      }

      const postsNeedingExtraction = posts.filter(post => !post.full_article_text)

      if (postsNeedingExtraction.length === 0) {
        return
      }

      const urlToPostMap = new Map<string, string>()
      postsNeedingExtraction.forEach(post => {
        if (post.source_url) {
          urlToPostMap.set(post.source_url, post.id)
        }
      })

      const urls = Array.from(urlToPostMap.keys())

      let extractionResults: Map<string, any>
      try {
        extractionResults = await this.ctx.articleExtractor.extractBatch(urls, 10)
      } catch (extractError) {
        return
      }

      let successCount = 0
      let paywallCount = 0
      let loginCount = 0

      for (const [url, result] of Array.from(extractionResults.entries())) {
        const postId = urlToPostMap.get(url)
        if (!postId) continue

        if (result.success && result.fullText) {
          const { error: updateError } = await supabaseAdmin
            .from('rss_posts')
            .update({
              full_article_text: result.fullText,
              extraction_status: 'success',
              extraction_error: null
            })
            .eq('id', postId)

          if (!updateError) {
            successCount++
          }
        } else {
          const status = result.status || 'failed'
          if (status === 'paywall') paywallCount++
          if (status === 'login_required') loginCount++

          await supabaseAdmin
            .from('rss_posts')
            .update({
              extraction_status: status,
              extraction_error: result.error?.substring(0, 500) || null
            })
            .eq('id', postId)
        }
      }

      if (paywallCount > 0 || loginCount > 0) {
        console.log(`[Extract] Access restrictions: ${paywallCount} paywall, ${loginCount} login required`)
      }

    } catch (error) {
      // Don't throw - article extraction is optional
    }
  }

  /**
   * Extract full article text from RSS posts using Readability.js
   * Runs in parallel batches to improve performance
   */
  async enrichPostsWithFullContent(issueId: string) {
    try {
      const { data: posts, error } = await supabaseAdmin
        .from('rss_posts')
        .select('id, source_url, title, full_article_text')
        .eq('issue_id', issueId)
        .not('source_url', 'is', null)

      if (error) {
        throw new Error(`Failed to fetch posts for extraction: ${error.message}`)
      }

      if (!posts || posts.length === 0) {
        return
      }

      const postsNeedingExtraction = posts.filter(post => !post.full_article_text)
      const postsAlreadyExtracted = posts.length - postsNeedingExtraction.length

      if (postsNeedingExtraction.length === 0) {
        return
      }

      const urlToPostMap = new Map<string, string>()
      postsNeedingExtraction.forEach(post => {
        if (post.source_url) {
          urlToPostMap.set(post.source_url, post.id)
        }
      })

      const urls = Array.from(urlToPostMap.keys())

      let extractionResults: Map<string, any>
      try {
        extractionResults = await this.ctx.articleExtractor.extractBatch(urls, 5)
      } catch {
        return
      }

      let successCount = 0
      let failureCount = 0
      let paywallCount = 0
      let loginCount = 0
      let blockedCount = 0

      for (const [url, result] of Array.from(extractionResults.entries())) {
        const postId = urlToPostMap.get(url)
        if (!postId) continue

        if (result.success && result.fullText) {
          const { error: updateError } = await supabaseAdmin
            .from('rss_posts')
            .update({
              full_article_text: result.fullText,
              extraction_status: 'success',
              extraction_error: null
            })
            .eq('id', postId)

          if (!updateError) {
            successCount++
          } else {
            failureCount++
          }
        } else {
          const status = result.status || 'failed'
          if (status === 'paywall') paywallCount++
          if (status === 'login_required') loginCount++
          if (status === 'blocked') blockedCount++
          failureCount++

          await supabaseAdmin
            .from('rss_posts')
            .update({
              extraction_status: status,
              extraction_error: result.error?.substring(0, 500) || null
            })
            .eq('id', postId)
        }
      }

      await logInfo(`Article extraction complete`, {
        issueId,
        totalPosts: posts.length,
        alreadyExtracted: postsAlreadyExtracted,
        successfulExtractions: successCount,
        failedExtractions: failureCount,
        paywallDetected: paywallCount,
        loginRequired: loginCount,
        accessBlocked: blockedCount
      })

    } catch (error) {
      await logError('Failed to enrich posts with full article text', {
        issueId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      // Don't throw - article extraction is optional, RSS processing should continue
    }
  }
}
