import { supabaseAdmin } from '@/lib/supabase'
import { RSSProcessor } from '@/lib/rss-processor'

/**
 * Step 2: Fetch RSS Feeds and Extract Full Text
 * - Fetch RSS feeds from all sources
 * - Extract full article text from URLs
 */
export async function executeStep2(campaignId: string) {
  const processor = new RSSProcessor()

  // Fetch RSS feeds
  const { data: allFeeds } = await supabaseAdmin
    .from('rss_feeds')
    .select('*')
    .eq('active', true)

  if (!allFeeds || allFeeds.length === 0) {
    throw new Error('No active RSS feeds found')
  }

  const primaryFeeds = allFeeds.filter(f => f.use_for_primary_section)
  const secondaryFeeds = allFeeds.filter(f => f.use_for_secondary_section)

  // Process feeds
  for (const feed of primaryFeeds) {
    try {
      await processor.processSingleFeed(feed, campaignId, 'primary')
    } catch (error) {
      console.error(`Feed ${feed.name} failed`)
    }
  }

  for (const feed of secondaryFeeds) {
    try {
      await processor.processSingleFeed(feed, campaignId, 'secondary')
    } catch (error) {
      console.error(`Feed ${feed.name} failed`)
    }
  }

  // Extract full article text
  await processor.extractFullArticleText(campaignId)

  const { data: posts } = await supabaseAdmin
    .from('rss_posts')
    .select('id, full_article_text')
    .eq('campaign_id', campaignId)

  const postsCount = posts ? posts.length : 0
  const extractedCount = posts ? posts.filter((p: any) => p.full_article_text).length : 0
  console.log(`[Step 2/8] Complete: ${postsCount} posts fetched, ${extractedCount} extracted`)
  return { postsCount, extractedCount }
}

