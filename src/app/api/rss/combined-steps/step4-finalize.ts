import { supabaseAdmin } from '@/lib/supabase'
import { SlackNotificationService } from '@/lib/slack'
import { RSSProcessor } from '@/lib/rss-processor'

/**
 * Combined Step 4: Finalize
 * - Generate welcome section
 * - Update issue status to draft
 * - Send completion notifications
 */
export async function executeStep4(issueId: string) {

  // Generate welcome section (after articles are ready)
  const processor = new RSSProcessor()
  await processor.generateWelcomeSection(issueId)

  // Update issue status
  await supabaseAdmin
    .from('publication_issues')
    .update({ status: 'draft' })
    .eq('id', issueId)

  // Get article count
  const { data: articles } = await supabaseAdmin
    .from('articles')
    .select('id')
    .eq('issue_id', issueId)

  const articleCount = articles ? articles.length : 0

  // Get issue date
  const { data: issue } = await supabaseAdmin
    .from('publication_issues')
    .select('date')
    .eq('id', issueId)
    .single()

  const issueDate = issue ? issue.date : 'Unknown'

  // Send Slack notification
  try {
    const slack = new SlackNotificationService()
    await slack.sendRSSProcessingCompleteAlert(issueId, articleCount, issueDate)
  } catch (error) {
    // Don't fail if Slack fails
  }

  console.log(`[Step 4/4] Complete: ${articleCount} articles`)
  return { articleCount, issueDate }
}
