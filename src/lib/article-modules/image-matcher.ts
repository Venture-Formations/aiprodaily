import { supabaseAdmin } from '../supabase'

interface ArticleImage {
  id: string
  category: string
  lookup_key: string
  display_name: string
  image_url: string
}

/**
 * Matches articles to trade images from the article_images table.
 * Each image represents a specific member + transaction type combo
 * (e.g., "Nancy Pelosi - Purchase", "Nancy Pelosi - Sale").
 *
 * Looks up member/transaction from congress_trades via the article's ticker.
 */
export class ImageMatcher {
  /**
   * Normalize a name or label into a URL-safe lookup key.
   * "Nancy Pelosi Purchase" → "nancy-pelosi-purchase"
   */
  static normalizeLookupKey(name: string): string {
    return name
      .toLowerCase()
      .replace(/[()]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  /**
   * Build the combo lookup key from member name + transaction type.
   */
  static buildLookupKey(member: string, transaction: string): string {
    return ImageMatcher.normalizeLookupKey(`${member} ${transaction}`)
  }

  /**
   * Attach trade images to all active module_articles for an issue/module.
   * Looks up member + transaction from congress_trades via ticker,
   * matches against article_images, and updates trade_image_url/trade_image_alt.
   *
   * Safe no-op if no trade images are configured for the publication.
   */
  static async attachTradeImages(
    issueId: string,
    moduleId: string,
    publicationId: string
  ): Promise<{ matched: number; unmatched: number }> {
    // Load all trade images for this publication first — early exit if none
    const { data: images } = await supabaseAdmin
      .from('article_images')
      .select('id, category, lookup_key, display_name, image_url')
      .eq('publication_id', publicationId)
      .eq('category', 'trade')

    if (!images || images.length === 0) {
      return { matched: 0, unmatched: 0 }
    }

    // Get active articles with their ticker (from module_articles or rss_post)
    const { data: articles } = await supabaseAdmin
      .from('module_articles')
      .select(`
        id, ticker, headline,
        rss_post:rss_posts(ticker)
      `)
      .eq('issue_id', issueId)
      .eq('article_module_id', moduleId)
      .eq('is_active', true)

    if (!articles || articles.length === 0) {
      return { matched: 0, unmatched: 0 }
    }

    // Collect all tickers we need to look up
    const tickers = new Set<string>()
    for (const article of articles) {
      const rssPost = Array.isArray(article.rss_post) ? article.rss_post[0] : article.rss_post
      const ticker = article.ticker || rssPost?.ticker
      if (ticker) tickers.add(ticker)
    }

    if (tickers.size === 0) {
      return { matched: 0, unmatched: articles.length }
    }

    // Look up member + transaction from congress_trades for these tickers
    const { data: trades } = await supabaseAdmin
      .from('congress_trades')
      .select('ticker, name, transaction')
      .in('ticker', Array.from(tickers))
      .order('trade_size_parsed', { ascending: false })

    // Build ticker → { member, transaction } map (largest trade wins per ticker)
    const tickerTradeMap = new Map<string, { member: string; transaction: string }>()
    if (trades) {
      for (const trade of trades) {
        if (trade.name && trade.transaction && !tickerTradeMap.has(trade.ticker)) {
          tickerTradeMap.set(trade.ticker, {
            member: trade.name,
            transaction: trade.transaction
          })
        }
      }
    }

    // Build image lookup map: "nancy-pelosi-purchase" → image
    const tradeImages = new Map<string, ArticleImage>()
    for (const img of images) {
      tradeImages.set(img.lookup_key, img as ArticleImage)
    }

    let matched = 0
    let unmatched = 0

    for (const article of articles) {
      const rssPost = Array.isArray(article.rss_post) ? article.rss_post[0] : article.rss_post
      const ticker = article.ticker || rssPost?.ticker

      if (!ticker) {
        unmatched++
        continue
      }

      const tradeInfo = tickerTradeMap.get(ticker)
      let tradeImage: ArticleImage | undefined

      if (tradeInfo) {
        const comboKey = ImageMatcher.buildLookupKey(tradeInfo.member, tradeInfo.transaction)
        tradeImage = tradeImages.get(comboKey)
      }

      const tradeImageUrl = tradeImage?.image_url || null
      const tradeImageAlt = tradeImage?.display_name || null

      if (tradeImageUrl) {
        matched++
      } else {
        unmatched++
        if (tradeInfo) {
          console.log(`[ImageMatcher] No image for "${tradeInfo.member} - ${tradeInfo.transaction}" (${ticker})`)
        }
      }

      // Update module_article with trade image info and ticker
      await supabaseAdmin
        .from('module_articles')
        .update({
          trade_image_url: tradeImageUrl,
          trade_image_alt: tradeImageAlt,
          ticker: ticker
        })
        .eq('id', article.id)
    }

    console.log(`[ImageMatcher] Matched ${matched}/${matched + unmatched} articles with trade images`)
    return { matched, unmatched }
  }
}
