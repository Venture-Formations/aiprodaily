import { supabaseAdmin } from '@/lib/supabase'
import { SlackNotificationService } from '@/lib/slack'

/**
 * Combined Step 4: Finalize
 * - Generate text box modules (replaces legacy welcome section)
 * - Update issue status to draft
 * - Send completion notifications
 */
export async function executeStep4(issueId: string) {

  // Get publication_id for the issue
  const { data: issueData } = await supabaseAdmin
    .from('publication_issues')
    .select('publication_id')
    .eq('id', issueId)
    .single()

  // Generate text box modules (replaces legacy welcome section)
  if (issueData?.publication_id) {
    try {
      const { TextBoxModuleSelector, TextBoxGenerator } = await import('@/lib/text-box-modules')
      await TextBoxModuleSelector.initializeForIssue(issueId, issueData.publication_id)
      await TextBoxGenerator.generateBlocksWithTiming(issueId, 'after_articles')
      console.log('[Step 4/4] Text box modules generated')
    } catch (error) {
      console.log('[Step 4/4] Text box generation skipped:', error)
    }
  }

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
