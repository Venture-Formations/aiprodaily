import { supabaseAdmin } from '../supabase'

/**
 * Matches module_articles to trade images from the article_images table.
 * Uses member_name + transaction_type stored directly on module_articles
 * to look up the corresponding image.
 */
export class ImageMatcher {
  /**
   * Normalize a name into a URL-safe lookup key.
   * "Nancy Pelosi Purchase" → "nancy-pelosi-purchase"
   */
  static normalizeLookupKey(name: string): string {
    return name
      .toLowerCase()
      .replace(/[()]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  static buildLookupKey(member: string, transaction: string): string {
    return ImageMatcher.normalizeLookupKey(`${member} ${transaction}`)
  }

  /**
   * Look up the trade image URL for an article based on its member_name + transaction_type.
   * Returns the image URL or null.
   */
  static async getImageForArticle(
    memberName: string,
    transactionType: string,
    publicationId: string
  ): Promise<{ image_url: string; display_name: string } | null> {
    const lookupKey = ImageMatcher.buildLookupKey(memberName, transactionType)

    const { data } = await supabaseAdmin
      .from('article_images')
      .select('image_url, display_name')
      .eq('publication_id', publicationId)
      .eq('category', 'trade')
      .eq('lookup_key', lookupKey)
      .maybeSingle()

    return data || null
  }

  /**
   * Batch-attach trade images to all active module_articles for an issue/module.
   * Reads member_name + transaction_type from module_articles, matches against
   * article_images, and updates trade_image_url + trade_image_alt.
   *
   * Also re-populates member_name/transaction_type from congress_trades if missing.
   * Safe no-op if no trade images are configured for the publication.
   */
  static async attachTradeImages(
    issueId: string,
    moduleId: string,
    publicationId: string
  ): Promise<{ matched: number; unmatched: number }> {
    // Load all trade images for this publication — early exit if none
    const { data: images } = await supabaseAdmin
      .from('article_images')
      .select('lookup_key, image_url, display_name')
      .eq('publication_id', publicationId)
      .eq('category', 'trade')

    if (!images || images.length === 0) {
      return { matched: 0, unmatched: 0 }
    }

    const imageMap = new Map(images.map(img => [img.lookup_key, img]))

    // Get active articles
    const { data: articles } = await supabaseAdmin
      .from('module_articles')
      .select('id, ticker, member_name, transaction_type')
      .eq('issue_id', issueId)
      .eq('article_module_id', moduleId)
      .eq('is_active', true)

    if (!articles || articles.length === 0) {
      return { matched: 0, unmatched: 0 }
    }

    // Re-populate missing member/transaction from congress_trades
    const needsLookup = articles.filter(a => a.ticker && (!a.member_name || !a.transaction_type))
    if (needsLookup.length > 0) {
      const tickers = Array.from(new Set(needsLookup.map(a => a.ticker!)))
      const { data: trades } = await supabaseAdmin
        .from('congress_trades')
        .select('ticker, name, transaction')
        .in('ticker', tickers)
        .order('trade_size_parsed', { ascending: false })

      if (trades) {
        const tradeMap = new Map<string, { name: string; transaction: string }>()
        for (const t of trades) {
          if (t.name && t.transaction && !tradeMap.has(t.ticker)) {
            tradeMap.set(t.ticker, { name: t.name, transaction: t.transaction })
          }
        }

        for (const article of needsLookup) {
          const trade = tradeMap.get(article.ticker!)
          if (trade) {
            article.member_name = trade.name
            article.transaction_type = trade.transaction
            await supabaseAdmin
              .from('module_articles')
              .update({ member_name: trade.name, transaction_type: trade.transaction, ticker: article.ticker })
              .eq('id', article.id)
          }
        }
      }
    }

    let matched = 0
    let unmatched = 0

    for (const article of articles) {
      if (!article.member_name || !article.transaction_type) {
        unmatched++
        continue
      }

      const key = ImageMatcher.buildLookupKey(article.member_name, article.transaction_type)
      const image = imageMap.get(key)

      await supabaseAdmin
        .from('module_articles')
        .update({
          trade_image_url: image?.image_url || null,
          trade_image_alt: image?.display_name || null
        })
        .eq('id', article.id)

      if (image) {
        matched++
      } else {
        unmatched++
        console.log(`[ImageMatcher] No image for "${article.member_name} - ${article.transaction_type}"`)
      }
    }

    console.log(`[ImageMatcher] Matched ${matched}/${matched + unmatched} articles with trade images`)
    return { matched, unmatched }
  }
}
