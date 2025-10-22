import { supabaseAdmin } from '@/lib/supabase'
import { ArticleArchiveService } from '@/lib/article-archive'
import { RSSProcessor } from '@/lib/rss-processor'

/**
 * Combined Step 1: Archive + Fetch
 * - Archive old campaign data
 * - Fetch RSS feeds from all sources
 */
export async function executeStep1(campaignId: string) {
  console.log(`[Step 1/4] Archive + Fetch for campaign ${campaignId}`)

  const archiveService = new ArticleArchiveService()
  const processor = new RSSProcessor()

  // Archive existing data
  try {
    await archiveService.archiveCampaignArticles(campaignId, 'rss_processing_clear')
  } catch (error) {
    console.warn('Archive failed, continuing')
  }

  // Clear previous data
  await supabaseAdmin.from('articles').delete().eq('campaign_id', campaignId)
  await supabaseAdmin.from('secondary_articles').delete().eq('campaign_id', campaignId)
  await supabaseAdmin.from('rss_posts').delete().eq('campaign_id', campaignId)

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

  const { data: posts } = await supabaseAdmin
    .from('rss_posts')
    .select('id')
    .eq('campaign_id', campaignId)

  const postsCount = posts ? posts.length : 0
  console.log(`[Step 1/4] Complete: ${postsCount} posts fetched`)
  return { postsCount }
}
