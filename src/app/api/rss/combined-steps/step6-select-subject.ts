import { supabaseAdmin } from '@/lib/supabase'
import { RSSProcessor } from '@/lib/rss-processor'

/**
 * Step 6: Select Articles and Generate Subject Line
 * - Select top articles from lookback window
 * - Generate subject line based on top article
 */
export async function executeStep6(issueId: string) {
  const processor = new RSSProcessor()

  // Select top articles (primary and secondary)
  await processor.selectTopArticlesForissue(issueId)

  // Get selected article counts
  const { data: activeArticles } = await supabaseAdmin
    .from('module_articles')
    .select('id')
    .eq('issue_id', issueId)
    .eq('is_active', true)

  const { data: issue } = await supabaseAdmin
    .from('publication_issues')
    .select('subject_line')
    .eq('id', issueId)
    .single()

  const articleCount = activeArticles ? activeArticles.length : 0
  const subjectLine = issue?.subject_line || 'Not generated'
  console.log(`[Step 6/8] Complete: ${articleCount} articles selected, subject: "${subjectLine.substring(0, 50)}${subjectLine.length > 50 ? '...' : ''}"`)
  return { articleCount, subjectLine }
}

