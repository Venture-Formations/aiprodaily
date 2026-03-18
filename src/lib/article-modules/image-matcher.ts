import { supabaseAdmin } from '../supabase'

interface ArticleImage {
  id: string
  category: string
  lookup_key: string
  display_name: string
  image_url: string
  metadata: Record<string, unknown>
}

interface TradeMetadata {
  member?: string | null
  transaction?: string | null
  ticker?: string | null
}

/**
 * Matches articles to trade images (member photos + transaction type icons)
 * from the article_images table.
 */
export class ImageMatcher {
  /**
   * Normalize a name or label into a URL-safe lookup key.
   * "Nancy Pelosi" → "nancy-pelosi"
   * "Sale (Partial)" → "sale-partial"
   */
  static normalizeLookupKey(name: string): string {
    return name
      .toLowerCase()
      .replace(/[()]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  /**
   * Attach trade images to all active module_articles for an issue/module.
   * Reads trade metadata from the linked rss_post, matches against article_images,
   * and updates trade_image_url, trade_image_alt, and ticker on module_articles.
   */
  static async attachTradeImages(
    issueId: string,
    moduleId: string,
    publicationId: string
  ): Promise<{ matched: number; unmatched: number }> {
    // Get active articles with their rss_posts
    const { data: articles } = await supabaseAdmin
      .from('module_articles')
      .select(`
        id, post_id, headline,
        rss_post:rss_posts(
          title, metadata
        )
      `)
      .eq('issue_id', issueId)
      .eq('article_module_id', moduleId)
      .eq('is_active', true)

    if (!articles || articles.length === 0) {
      return { matched: 0, unmatched: 0 }
    }

    // Load all article images for this publication (small table, load once)
    const { data: images } = await supabaseAdmin
      .from('article_images')
      .select('id, category, lookup_key, display_name, image_url, metadata')
      .eq('publication_id', publicationId)

    if (!images || images.length === 0) {
      console.log(`[ImageMatcher] No article images configured for publication ${publicationId}`)
      return { matched: 0, unmatched: articles.length }
    }

    // Build lookup maps
    const memberImages = new Map<string, ArticleImage>()
    const transactionImages = new Map<string, ArticleImage>()

    for (const img of images) {
      if (img.category === 'member') {
        memberImages.set(img.lookup_key, img as ArticleImage)
      } else if (img.category === 'transaction') {
        transactionImages.set(img.lookup_key, img as ArticleImage)
      }
    }

    let matched = 0
    let unmatched = 0

    for (const article of articles) {
      const rssPost = Array.isArray(article.rss_post)
        ? article.rss_post[0]
        : article.rss_post

      if (!rssPost) {
        unmatched++
        continue
      }

      // Extract trade metadata from rss_post
      const tradeMeta = (rssPost.metadata as TradeMetadata) || {}
      const memberName = tradeMeta.member
      const transaction = tradeMeta.transaction
      const ticker = tradeMeta.ticker

      // Try to match member image
      let memberImage: ArticleImage | undefined
      if (memberName) {
        const memberKey = ImageMatcher.normalizeLookupKey(memberName)
        memberImage = memberImages.get(memberKey)
      }

      // Try to match transaction type image
      let transactionImage: ArticleImage | undefined
      if (transaction) {
        const txnKey = ImageMatcher.normalizeLookupKey(transaction)
        transactionImage = transactionImages.get(txnKey)
      }

      // Use the member image as primary, fall back to transaction image
      const tradeImageUrl = memberImage?.image_url || transactionImage?.image_url || null
      const tradeImageAlt = memberImage
        ? `${memberImage.display_name}${transaction ? ` - ${transaction}` : ''}`
        : transactionImage
          ? transactionImage.display_name
          : null

      if (tradeImageUrl) {
        matched++
      } else {
        unmatched++
        if (memberName) {
          console.log(`[ImageMatcher] No image found for member "${memberName}"`)
        }
      }

      // Update module_article with trade image info and ticker
      await supabaseAdmin
        .from('module_articles')
        .update({
          trade_image_url: tradeImageUrl,
          trade_image_alt: tradeImageAlt,
          ticker: ticker || null
        })
        .eq('id', article.id)
    }

    console.log(`[ImageMatcher] Matched ${matched}/${matched + unmatched} articles with trade images`)
    return { matched, unmatched }
  }
}
