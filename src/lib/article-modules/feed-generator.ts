import { timingSafeEqual } from 'crypto'
import { Feed } from 'feed'
import { htmlToText } from 'html-to-text'
import { supabaseAdmin } from '../supabase'
import { normalizeTransactionType } from '../transaction-type'
import { wrapTrackingUrl } from '../url-tracking'
import type { IssueStatus } from '@/types/database'

// Module-level cache keyed by moduleId:publicationId:variant
const feedCache = new Map<string, { xml: string; cachedAt: number }>()
const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes
const MAX_CACHE_ENTRIES = 100

export type FeedVariant = 'draft' | 'sent'

// Statuses considered "in-flight" for the draft feed (not yet sent)
const DRAFT_STATUSES: readonly IssueStatus[] = ['draft', 'in_review']

/**
 * Generates RSS 2.0 feeds from module articles for use with
 * Beehiiv's RSS-to-Send feature or other RSS consumers.
 */
export class ModuleFeedGenerator {
  /**
   * Generate RSS 2.0 XML for a module's latest issue articles.
   * Uses in-memory cache with 15-minute TTL.
   *
   * @param variant - 'draft' for the most recent in-flight issue
   *   (statuses in `DRAFT_STATUSES`), 'sent' for the most recent issue
   *   that has been sent.
   */
  static async generateFeed(
    moduleId: string,
    publicationId: string,
    forceRefresh = false,
    variant: FeedVariant = 'draft'
  ): Promise<string> {
    const cacheKey = `${moduleId}:${publicationId}:${variant}`

    // Check cache
    if (!forceRefresh) {
      const cached = feedCache.get(cacheKey)
      if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
        return cached.xml
      }
    }

    // Get module config
    const { data: mod, error: modError } = await supabaseAdmin
      .from('article_modules')
      .select('id, name, publication_id, config')
      .eq('id', moduleId)
      .eq('publication_id', publicationId)
      .single()

    if (modError) {
      console.error(`[ModuleFeed] Failed to fetch module ${moduleId}: ${modError.message}`)
    }

    if (!mod) {
      throw new Error(`Module ${moduleId} not found for publication ${publicationId}`)
    }

    const config = (mod.config as Record<string, any>) || {}
    const rssConfig = config.rss_output || {}
    const includeImages = rssConfig.include_images !== false
    const includeFullContent = rssConfig.include_full_content !== false

    // Find the most recent issue with articles for this module
    let issueQuery = supabaseAdmin
      .from('publication_issues')
      .select('id, date, status')
      .eq('publication_id', publicationId)

    if (variant === 'sent') {
      issueQuery = issueQuery.eq('status', 'sent')
    } else {
      issueQuery = issueQuery.in('status', DRAFT_STATUSES)
    }

    // Publication and issue lookups are independent — run in parallel.
    // maybeSingle() on the issue query returns null (not an error) when no
    // matching issue exists — a normal state for the 'sent' variant on a
    // publication that hasn't sent anything yet.
    const [pubResult, issueResult] = await Promise.all([
      supabaseAdmin
        .from('publications')
        .select('name, slug')
        .eq('id', publicationId)
        .single(),
      issueQuery
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const { data: pub, error: pubError } = pubResult
    const { data: recentIssue, error: issueError } = issueResult

    if (pubError) {
      console.error(`[ModuleFeed] Failed to fetch publication ${publicationId}: ${pubError.message}`)
    }

    if (issueError) {
      console.error(`[ModuleFeed] Failed to fetch recent ${variant} issue for publication ${publicationId}: ${issueError.message}`)
    }

    const pubName = pub?.name || 'Newsletter'

    if (!recentIssue) {
      return ModuleFeedGenerator.cacheAndReturn(cacheKey, ModuleFeedGenerator.buildEmptyFeed(mod.name, pubName))
    }

    // Get active module articles for this issue, ordered by rank
    const { data: articles, error: articlesError } = await supabaseAdmin
      .from('module_articles')
      .select(`
        id, headline, content, rank, trade_image_url, trade_image_alt, ticker, member_name, transaction_type,
        rss_post:rss_posts(
          source_url, title
        )
      `)
      .eq('issue_id', recentIssue.id)
      .eq('article_module_id', moduleId)
      .eq('is_active', true)
      .order('rank', { ascending: true })

    if (articlesError) {
      console.error(`[ModuleFeed] Failed to fetch articles for issue ${recentIssue.id}, module ${moduleId}: ${articlesError.message}`)
    }

    if (!articles || articles.length === 0) {
      return ModuleFeedGenerator.cacheAndReturn(cacheKey, ModuleFeedGenerator.buildEmptyFeed(mod.name, pubName))
    }

    // Build RSS feed
    const feed = new Feed({
      title: `${pubName} - ${mod.name}`,
      description: `${mod.name} articles from ${pubName}`,
      id: `module-feed-${moduleId}`,
      link: `https://aiprodaily.com`,
      copyright: '',
      updated: new Date(),
      generator: 'AIProDaily Module Feed',
    })

    for (const article of articles) {
      const rssPost = Array.isArray(article.rss_post)
        ? article.rss_post[0]
        : article.rss_post

      const sourceUrl = rssPost?.source_url || '#'

      // Wrap source URL with tracking
      const trackedUrl = sourceUrl !== '#'
        ? wrapTrackingUrl(sourceUrl, mod.name, recentIssue.date, undefined, recentIssue.id)
        : '#'

      const itemData: any = {
        title: article.headline || 'Untitled',
        id: article.id,
        link: trackedUrl,
        date: new Date(recentIssue.date),
      }

      // Description: full HTML content or truncated
      if (includeFullContent && article.content) {
        itemData.description = article.content.replace(/\n/g, '<br>')
      } else if (article.content) {
        // Truncate to ~200 chars; convert HTML to plain text safely
        const plain = htmlToText(article.content, { wordwrap: false })
        itemData.description = plain.length > 200
          ? plain.substring(0, 200) + '...'
          : plain
      }

      // Categories: ticker, member, transaction type
      const categories: { name: string }[] = []
      if (article.ticker) {
        categories.push({ name: article.ticker })
      }
      if (article.member_name) {
        categories.push({ name: article.member_name })
      }
      const normalizedTransactionType = normalizeTransactionType(article.transaction_type)
      if (normalizedTransactionType) {
        categories.push({ name: normalizedTransactionType })
      }
      if (categories.length > 0) {
        itemData.category = categories
      }

      // Image: trade_image_url as enclosure (Beehiiv "Display Thumbnail")
      if (includeImages && article.trade_image_url) {
        itemData.image = article.trade_image_url
      }

      feed.addItem(itemData)
    }

    return ModuleFeedGenerator.cacheAndReturn(cacheKey, feed.rss2())
  }

  /**
   * Cache an XML payload under `cacheKey`, evicting the oldest entry if
   * the cache is full, then return the XML. Used for every return path
   * in `generateFeed` so empty and populated feeds are cached uniformly.
   */
  private static cacheAndReturn(cacheKey: string, xml: string): string {
    if (feedCache.size >= MAX_CACHE_ENTRIES && !feedCache.has(cacheKey)) {
      const oldestKey = feedCache.keys().next().value
      if (oldestKey) feedCache.delete(oldestKey)
    }
    feedCache.set(cacheKey, { xml, cachedAt: Date.now() })
    return xml
  }

  /**
   * Build a valid but empty RSS feed.
   */
  private static buildEmptyFeed(moduleName: string, pubName: string): string {
    const feed = new Feed({
      title: `${pubName} - ${moduleName}`,
      description: `${moduleName} articles from ${pubName}`,
      id: `module-feed-empty`,
      link: 'https://aiprodaily.com',
      copyright: '',
      updated: new Date(),
      generator: 'AIProDaily Module Feed',
    })
    return feed.rss2()
  }

  /**
   * Invalidate the cache for a specific module (across all publications),
   * a specific module+publication pair (both variants), or the entire cache.
   */
  static invalidateCache(moduleId?: string, publicationId?: string): void {
    if (moduleId && publicationId) {
      feedCache.delete(`${moduleId}:${publicationId}:draft`)
      feedCache.delete(`${moduleId}:${publicationId}:sent`)
    } else if (moduleId) {
      // Clear all entries for this module (any publication, any variant)
      for (const key of Array.from(feedCache.keys())) {
        if (key.startsWith(`${moduleId}:`)) {
          feedCache.delete(key)
        }
      }
    } else {
      feedCache.clear()
    }
  }

  /**
   * Validate a feed token against the module's stored token.
   * The token is shared across variants; the variant-specific enabled flag
   * (`enabled` for draft, `enabled_sent` for sent) must also be true.
   */
  static async validateFeedToken(
    moduleId: string,
    token: string,
    variant: FeedVariant = 'draft'
  ): Promise<{ valid: boolean; publicationId: string | null }> {
    const { data: mod, error: modError } = await supabaseAdmin
      .from('article_modules')
      .select('publication_id, config')
      .eq('id', moduleId)
      .single()

    if (modError) {
      console.error(`[ModuleFeed] Failed to fetch module for token validation ${moduleId}: ${modError.message}`)
    }

    if (!mod) {
      return { valid: false, publicationId: null }
    }

    const config = (mod.config as Record<string, any>) || {}
    const rssConfig = config.rss_output || {}

    const variantEnabled = variant === 'sent' ? !!rssConfig.enabled_sent : !!rssConfig.enabled
    if (!variantEnabled || !rssConfig.feed_token || rssConfig.feed_token.length < 16) {
      return { valid: false, publicationId: null }
    }

    return {
      valid: rssConfig.feed_token.length === token.length &&
        timingSafeEqual(Buffer.from(rssConfig.feed_token, 'utf8'), Buffer.from(token, 'utf8')),
      publicationId: mod.publication_id
    }
  }
}
