import { supabaseAdmin } from '@/lib/supabase'
import { RSSProcessor } from '@/lib/rss-processor'

/**
 * Step 3: Score with AI
 * - Score posts with AI criteria (interest, relevance, impact)
 */
export async function executeStep3(campaignId: string) {
  const processor = new RSSProcessor()

  // Score posts for both sections (without deduplication)
  await processor.scorePostsForSection(campaignId, 'primary')
  await processor.scorePostsForSection(campaignId, 'secondary')

  const { data: scoredPosts } = await supabaseAdmin
    .from('rss_posts')
    .select('id, post_ratings(total_score)')
    .eq('campaign_id', campaignId)

  const scoredCount = scoredPosts ? scoredPosts.filter(p => p.post_ratings && p.post_ratings.length > 0).length : 0
  console.log(`[Step 3/8] Complete: ${scoredCount} posts scored`)
  return { scoredCount }
}

