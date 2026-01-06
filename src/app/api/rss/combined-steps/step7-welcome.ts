import { supabaseAdmin } from '@/lib/supabase'

/**
 * Step 7: Generate Text Box Modules
 * - Initialize text box modules for the issue
 * - Generate AI content for text box blocks
 * (Replaces legacy welcome section generation)
 */
export async function executeStep7(issueId: string) {
  // Get publication_id for the issue
  const { data: issue } = await supabaseAdmin
    .from('publication_issues')
    .select('publication_id')
    .eq('id', issueId)
    .single()

  if (!issue?.publication_id) {
    console.log('[Step 7/8] Warning: Could not find publication_id for issue')
    return { textBoxGenerated: false }
  }

  try {
    const { TextBoxModuleSelector, TextBoxGenerator } = await import('@/lib/text-box-modules')
    await TextBoxModuleSelector.initializeForIssue(issueId, issue.publication_id)
    await TextBoxGenerator.generateBlocksWithTiming(issueId, 'after_articles')
    console.log('[Step 7/8] Complete: Text box modules generated')
    return { textBoxGenerated: true }
  } catch (error) {
    console.log('[Step 7/8] Text box generation skipped:', error)
    return { textBoxGenerated: false }
  }
}
