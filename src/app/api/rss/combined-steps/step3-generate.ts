import { supabaseAdmin } from '@/lib/supabase'
import { RSSProcessor } from '@/lib/rss-processor'

/**
 * Combined Step 3: Generate Articles
 * - Generate newsletter articles from scored posts
 * - MINIMAL LOGGING to prevent log overflow
 */
export async function executeStep3(issueId: string) {
  const processor = new RSSProcessor()

  // Generate articles (processor has minimal logging now)
  await processor.generateArticlesForSection(issueId, 'primary')
  await processor.generateArticlesForSection(issueId, 'secondary')

  const { data: articles } = await supabaseAdmin
    .from('articles')
    .select('id')
    .eq('issue_id', issueId)

  const articlesCount = articles ? articles.length : 0
  console.log(`[Step 3/4] Complete: ${articlesCount} articles`)
  return { articlesCount }
}
