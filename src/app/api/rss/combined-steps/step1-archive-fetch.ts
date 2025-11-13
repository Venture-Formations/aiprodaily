import { supabaseAdmin } from '@/lib/supabase'
import { ArticleArchiveService } from '@/lib/article-archive'
import { RSSProcessor } from '@/lib/rss-processor'

/**
 * Combined Step 1: Archive + Fetch
 * - Archive old issue data
 * - Fetch RSS feeds from all sources
 */
export async function executeStep1(issueId: string) {
  const archiveService = new ArticleArchiveService()
  const processor = new RSSProcessor()

  // Archive existing data
  try {
    await archiveService.archiveissueArticles(issueId, 'rss_processing_clear')
  } catch {
    // Archive failure is non-critical
  }

  // Clear previous data
  await supabaseAdmin.from('articles').delete().eq('issue_id', issueId)
  await supabaseAdmin.from('secondary_articles').delete().eq('issue_id', issueId)
  await supabaseAdmin.from('rss_posts').delete().eq('issue_id', issueId)

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
      await processor.processSingleFeed(feed, issueId, 'primary')
    } catch (error) {
      console.error(`Feed ${feed.name} failed`)
    }
  }

  for (const feed of secondaryFeeds) {
    try {
      await processor.processSingleFeed(feed, issueId, 'secondary')
    } catch (error) {
      console.error(`Feed ${feed.name} failed`)
    }
  }

  const { data: posts } = await supabaseAdmin
    .from('rss_posts')
    .select('id')
    .eq('issue_id', issueId)

  const postsCount = posts ? posts.length : 0
  console.log(`[Step 1/4] Complete: ${postsCount} posts`)
  return { postsCount }
}
