import { supabaseAdmin } from '@/lib/supabase'
import { RSSProcessor } from '@/lib/rss-processor'

/**
 * Combined Step 2: Extract + Score
 * - Extract full article text
 * - Score posts with AI
 */
export async function executeStep2(campaignId: string) {
  const processor = new RSSProcessor()

  // Extract article text
  await processor.extractFullArticleText(campaignId)

  // Score posts for both sections
  await processor.scorePostsForSection(campaignId, 'primary')
  await processor.scorePostsForSection(campaignId, 'secondary')

  const { data: scoredPosts } = await supabaseAdmin
    .from('rss_posts')
    .select('id, post_ratings(total_score)')
    .eq('campaign_id', campaignId)

  const scoredCount = scoredPosts ? scoredPosts.filter(p => p.post_ratings && p.post_ratings.length > 0).length : 0
  console.log(`[Step 2/4] Complete: ${scoredCount} posts scored`)
  return { scoredCount }
}
