import { Feed } from 'feed'
import { htmlToText } from 'html-to-text'
import { supabaseAdmin } from '../supabase'
import { wrapTrackingUrl } from '../url-tracking'

// Module-level cache per moduleId
const feedCache = new Map<string, { xml: string; cachedAt: number }>()
const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

/**
 * Generates RSS 2.0 feeds from module articles for use with
 * Beehiiv's RSS-to-Send feature or other RSS consumers.
 */
export class ModuleFeedGenerator {
  /**
   * Generate RSS 2.0 XML for a module's latest issue articles.
   * Uses in-memory cache with 15-minute TTL.
   */
  static async generateFeed(
    moduleId: string,
    publicationId: string,
    forceRefresh = false
  ): Promise<string> {
    // Check cache
    if (!forceRefresh) {
      const cached = feedCache.get(moduleId)
      if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
        return cached.xml
      }
    }

    // Get module config
    const { data: mod } = await supabaseAdmin
      .from('article_modules')
      .select('id, name, publication_id, config')
      .eq('id', moduleId)
      .eq('publication_id', publicationId)
      .single()

    if (!mod) {
      throw new Error(`Module ${moduleId} not found for publication ${publicationId}`)
    }

    const config = (mod.config as Record<string, any>) || {}
    const rssConfig = config.rss_output || {}
    const itemsCount = rssConfig.items_count || 5
    const includeImages = rssConfig.include_images !== false
    const includeFullContent = rssConfig.include_full_content !== false

    // Get publication info for feed metadata
    const { data: pub } = await supabaseAdmin
      .from('newsletters')
      .select('name, slug')
      .eq('id', publicationId)
      .single()

    const pubName = pub?.name || 'Newsletter'

    // Find the most recent issue with articles for this module
    const { data: recentIssue } = await supabaseAdmin
      .from('publication_issues')
      .select('id, date, status, mailerlite_issue_id')
      .eq('publication_id', publicationId)
      .in('status', ['draft', 'in_review', 'approved', 'sent'])
      .order('date', { ascending: false })
      .limit(1)
      .single()

    if (!recentIssue) {
      // Return empty but valid RSS feed
      return ModuleFeedGenerator.buildEmptyFeed(mod.name, pubName)
    }

    // Get active module articles for this issue, ordered by rank
    const { data: articles } = await supabaseAdmin
      .from('module_articles')
      .select(`
        id, headline, content, rank, trade_image_url, trade_image_alt, ticker,
        rss_post:rss_posts(
          source_url, title, metadata
        )
      `)
      .eq('issue_id', recentIssue.id)
      .eq('article_module_id', moduleId)
      .eq('is_active', true)
      .order('rank', { ascending: true })
      .limit(itemsCount)

    if (!articles || articles.length === 0) {
      return ModuleFeedGenerator.buildEmptyFeed(mod.name, pubName)
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
      const tradeMeta = (rssPost?.metadata as Record<string, any>) || {}

      // Wrap source URL with tracking
      const trackedUrl = sourceUrl !== '#'
        ? wrapTrackingUrl(sourceUrl, mod.name, recentIssue.date, recentIssue.mailerlite_issue_id, recentIssue.id)
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

      // Author: congress member name from trade metadata
      if (tradeMeta.member) {
        itemData.author = [{ name: tradeMeta.member }]
      }

      // Category: transaction type
      const categories: { name: string }[] = []
      if (tradeMeta.transaction) {
        categories.push({ name: tradeMeta.transaction })
      }
      if (article.ticker) {
        categories.push({ name: article.ticker })
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

    const xml = feed.rss2()

    // Cache the result
    feedCache.set(moduleId, { xml, cachedAt: Date.now() })

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
   * Invalidate the cache for a specific module.
   */
  static invalidateCache(moduleId?: string): void {
    if (moduleId) {
      feedCache.delete(moduleId)
    } else {
      feedCache.clear()
    }
  }

  /**
   * Validate a feed token against the module's stored token.
   */
  static async validateFeedToken(
    moduleId: string,
    token: string
  ): Promise<{ valid: boolean; publicationId: string | null }> {
    const { data: mod } = await supabaseAdmin
      .from('article_modules')
      .select('publication_id, config')
      .eq('id', moduleId)
      .single()

    if (!mod) {
      return { valid: false, publicationId: null }
    }

    const config = (mod.config as Record<string, any>) || {}
    const rssConfig = config.rss_output || {}

    if (!rssConfig.enabled || !rssConfig.feed_token) {
      return { valid: false, publicationId: null }
    }

    return {
      valid: rssConfig.feed_token === token,
      publicationId: mod.publication_id
    }
  }
}
