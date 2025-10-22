import { supabaseAdmin } from '@/lib/supabase'
import { RSSProcessor } from '@/lib/rss-processor'

/**
 * Combined Step 2: Extract + Score
 * - Extract full article text
 * - Score posts with AI
 */
export async function executeStep2(campaignId: string) {
  console.log(`[Step 2/4] Extract + Score for campaign ${campaignId}`)

  const processor = new RSSProcessor()

  // Get all posts for this campaign
  const { data: posts } = await supabaseAdmin
    .from('rss_posts')
    .select('*')
    .eq('campaign_id', campaignId)
    .is('full_article_text', null)

  if (!posts || posts.length === 0) {
    console.log('[Step 2/4] No posts to extract')
  } else {
    // Extract article text (minimal logging)
    for (const post of posts) {
      try {
        await processor.extractFullArticle(post)
      } catch (error) {
        // Silent failure, continue
      }
    }
  }

  // Score all posts
  await processor.scoreAllPosts(campaignId)

  const { data: scoredPosts } = await supabaseAdmin
    .from('rss_posts')
    .select('id, post_ratings(total_score)')
    .eq('campaign_id', campaignId)

  const scoredCount = scoredPosts ? scoredPosts.filter(p => p.post_ratings && p.post_ratings.length > 0).length : 0
  console.log(`[Step 2/4] Complete: ${scoredCount} posts scored`)
  return { scoredCount }
}
