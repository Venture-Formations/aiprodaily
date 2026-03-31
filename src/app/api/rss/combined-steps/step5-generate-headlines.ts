import { supabaseAdmin } from '@/lib/supabase'
import { RSSProcessor } from '@/lib/rss-processor'

/**
 * Step 5: Generate Headlines/Bodies
 * - Generate newsletter article headlines and bodies from scored posts
 */
export async function executeStep5(issueId: string) {
  const processor = new RSSProcessor()

  // Generate articles for both sections
  await processor.generateArticlesForSection(issueId, 'primary')
  await processor.generateArticlesForSection(issueId, 'secondary')

  const { data: moduleArticles } = await supabaseAdmin
    .from('module_articles')
    .select('id')
    .eq('issue_id', issueId)

  const articlesCount = moduleArticles ? moduleArticles.length : 0

  // Log batch stats if available from processor
  console.log(`[Step 5/8] Complete: ${articlesCount} module articles`)
  return { articlesCount }
}

