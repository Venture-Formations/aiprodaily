import Parser from 'rss-parser'
import { supabaseAdmin } from '../supabase'
import { getExcludedRssSources, getBlockedDomains } from '../publication-settings'
import type { RSSProcessorContext } from './shared-context'
import { isFbcdnUrl } from './shared-context'
import { Scoring } from './scoring'

const parser = new Parser({
  customFields: {
    item: ['media:content', 'enclosure']
  }
})

/**
 * Feed ingestion module.
 * Handles fetching RSS feeds, extracting posts, and initial scoring.
 */
export class FeedIngestion {
  private ctx: RSSProcessorContext
  private scoring: Scoring

  constructor(ctx: RSSProcessorContext, scoring: Scoring) {
    this.ctx = ctx
    this.scoring = scoring
  }

  /**
   * Ingest and score new posts (runs every 15 minutes)
   * Does NOT generate articles or assign to issues
   * Loops through all active publications and processes each pub's feeds independently.
   */
  async ingestNewPosts(): Promise<{ fetched: number; scored: number }> {
    const { data: newsletters } = await supabaseAdmin
      .from('publications')
      .select('id, name, slug')
      .eq('is_active', true)

    if (!newsletters || newsletters.length === 0) {
      console.log('[Ingest] No active publications found')
      return { fetched: 0, scored: 0 }
    }

    let totalFetched = 0
    let totalScored = 0

    for (const pub of newsletters) {
      try {
        const { data: allFeeds } = await supabaseAdmin
          .from('rss_feeds')
          .select('*')
          .eq('active', true)
          .eq('publication_id', pub.id)

        if (!allFeeds || allFeeds.length === 0) {
          console.log(`[Ingest] No active feeds for ${pub.slug}`)
          continue
        }

        console.log(`[Ingest] ${pub.slug}: Fetched ${allFeeds.length} active feeds:`, allFeeds.map(f => ({
          name: f.name,
          id: f.id,
          article_module_id: f.article_module_id || 'NULL'
        })))

        for (const feed of allFeeds) {
          try {
            const result = await this.ingestFeedPosts(feed, pub.id)
            totalFetched += result.fetched
            totalScored += result.scored
          } catch (error) {
            console.error(`[Ingest] Feed ${feed.name} (${pub.slug}) failed:`, error instanceof Error ? error.message : 'Unknown')
          }
        }
      } catch (error) {
        console.error(`[Ingest] Error processing publication ${pub.slug}:`, error instanceof Error ? error.message : 'Unknown')
      }
    }

    return { fetched: totalFetched, scored: totalScored }
  }

  /**
   * Ingest posts from a single feed
   */
  private async ingestFeedPosts(feed: any, newsletterId: string): Promise<{ fetched: number; scored: number }> {
    try {
      const rssFeed = await parser.parseURL(feed.url)

      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)

      const recentPosts = rssFeed.items.filter(item => {
        if (!item.pubDate) return true
        const pubDate = new Date(item.pubDate)
        return pubDate >= sixHoursAgo
      })

      const newPosts: any[] = []

      const blockedDomains = await getBlockedDomains(newsletterId)

      for (const item of recentPosts) {
        const externalId = item.guid || item.link || ''
        const sourceUrl = item.link || ''

        if (sourceUrl && blockedDomains.length > 0) {
          try {
            const hostname = new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, '')
            const isBlocked = blockedDomains.some(domain =>
              hostname === domain || hostname.endsWith('.' + domain)
            )
            if (isBlocked) {
              continue
            }
          } catch {
            // Invalid URL, continue processing
          }
        }

        const { data: existing } = await supabaseAdmin
          .from('rss_posts')
          .select('id')
          .eq('external_id', externalId)
          .maybeSingle()

        if (existing) continue

        const excludedSources = await getExcludedRssSources(newsletterId)
        const author = item.creator || (item as any)['dc:creator'] || null
        const blockImages = excludedSources.includes(author)

        let imageUrl = this.extractImageUrl(item)

        if (!blockImages && imageUrl && isFbcdnUrl(imageUrl)) {
          try {
            const hostedUrl = await this.ctx.imageStorage.uploadImage(imageUrl, item.title || 'Untitled')
            if (hostedUrl) imageUrl = hostedUrl
          } catch (error) {
            // Silent failure
          }
        }

        if (blockImages) imageUrl = null

        console.log(`[Ingest] Inserting post from feed ${feed.name} (${feed.id}), article_module_id: ${feed.article_module_id || 'NULL'}`)

        const { data: newPost, error: insertError } = await supabaseAdmin
          .from('rss_posts')
          .insert([{
            feed_id: feed.id,
            issue_id: null,
            article_module_id: feed.article_module_id || null,
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
          const extractionResults = await this.ctx.articleExtractor.extractBatch(urls, 10)

          for (const post of newPosts) {
            if (!post.source_url) continue

            const result = extractionResults.get(post.source_url)
            if (result?.success && result.fullText) {
              await supabaseAdmin
                .from('rss_posts')
                .update({
                  full_article_text: result.fullText,
                  extraction_status: 'success',
                  extraction_error: null
                })
                .eq('id', post.id)
            } else if (result) {
              await supabaseAdmin
                .from('rss_posts')
                .update({
                  extraction_status: result.status || 'failed',
                  extraction_error: result.error?.substring(0, 500) || null
                })
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
        const { data: fullPosts } = await supabaseAdmin
          .from('rss_posts')
          .select('*')
          .in('id', newPosts.map(p => p.id))

        if (fullPosts && fullPosts.length > 0) {
          const BATCH_SIZE = 5
          const BATCH_DELAY = 2000

          for (let i = 0; i < fullPosts.length; i += BATCH_SIZE) {
            const batch = fullPosts.slice(i, i + BATCH_SIZE)

            const results = await Promise.allSettled(
              batch.map(post => this.scoreAndStorePost(post, newsletterId))
            )

            scoredCount += results.filter(r => r.status === 'fulfilled').length

            if (i + BATCH_SIZE < fullPosts.length) {
              await new Promise(resolve => setTimeout(resolve, BATCH_DELAY))
            }
          }
        }
      }

      // Update feed last processed time on success
      await supabaseAdmin
        .from('rss_feeds')
        .update({
          last_processed: new Date().toISOString(),
          processing_errors: 0,
          last_error: null
        })
        .eq('id', feed.id)

      return { fetched: newPosts.length, scored: scoredCount }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      const { data: feedData } = await supabaseAdmin
        .from('rss_feeds')
        .select('processing_errors')
        .eq('id', feed.id)
        .single()

      const currentErrors = feedData?.processing_errors || 0

      await supabaseAdmin
        .from('rss_feeds')
        .update({
          processing_errors: currentErrors + 1,
          last_error: errorMessage
        })
        .eq('id', feed.id)

      throw error
    }
  }

  /**
   * Score a single post and store rating
   */
  private async scoreAndStorePost(post: any, newsletterId: string): Promise<void> {
    const evaluation = await this.scoring.evaluatePost(post, newsletterId, 'primary', post.article_module_id)

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
  extractImageUrl(item: any): string | null {
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
}
