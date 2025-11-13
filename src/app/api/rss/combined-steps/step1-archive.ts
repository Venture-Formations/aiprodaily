import { supabaseAdmin } from '@/lib/supabase'
import { ArticleArchiveService } from '@/lib/article-archive'

/**
 * Step 1: Archive
 * - Archive old issue data before clearing
 */
export async function executeStep1(issueId: string) {
  const archiveService = new ArticleArchiveService()

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

  console.log(`[Step 1/8] Complete: Archive`)
  return { archived: true }
}

