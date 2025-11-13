import { supabaseAdmin } from '@/lib/supabase'
import { RSSProcessor } from '@/lib/rss-processor'

/**
 * Combined Step 2: Extract + Score
 * - Extract full article text
 * - Score posts with AI
 */
export async function executeStep2(issueId: string) {
  const processor = new RSSProcessor()

  // Extract article text
  await processor.extractFullArticleText(issueId)

  // Score posts for both sections
  await processor.scorePostsForSection(issueId, 'primary')
  await processor.scorePostsForSection(issueId, 'secondary')

  const { data: scoredPosts } = await supabaseAdmin
    .from('rss_posts')
    .select('id, post_ratings(total_score)')
    .eq('issue_id', issueId)

  const scoredCount = scoredPosts ? scoredPosts.filter(p => p.post_ratings && p.post_ratings.length > 0).length : 0
  console.log(`[Step 2/4] Complete: ${scoredCount} posts scored`)
  return { scoredCount }
}
