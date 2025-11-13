import { supabaseAdmin } from '@/lib/supabase'

/**
 * Step 10: Stage 1 Unassignment
 * Unassign posts that were assigned to issue but never got articles generated
 * This happens before issue goes to review
 */
export async function executeStep10(issueId: string) {
  console.log('=== STEP 10: STAGE 1 UNASSIGNMENT ===')

  // Find all posts assigned to this issue
  const { data: assignedPosts } = await supabaseAdmin
    .from('rss_posts')
    .select('id')
    .eq('issue_id', issueId)

  const assignedPostIds = assignedPosts?.map(p => p.id) || []

  if (assignedPostIds.length === 0) {
    console.log('[Step 10] No posts assigned to issue')
    return { unassigned: 0 }
  }

  // Find posts used in primary articles
  const { data: primaryArticles } = await supabaseAdmin
    .from('articles')
    .select('post_id')
    .eq('issue_id', issueId)

  // Find posts used in secondary articles
  const { data: secondaryArticles } = await supabaseAdmin
    .from('secondary_articles')
    .select('post_id')
    .eq('issue_id', issueId)

  const usedPostIds = [
    ...(primaryArticles?.map(a => a.post_id) || []),
    ...(secondaryArticles?.map(a => a.post_id) || [])
  ]

  // Find unused posts (assigned but no articles generated)
  const unusedPostIds = assignedPostIds.filter(id => !usedPostIds.includes(id))

  if (unusedPostIds.length === 0) {
    console.log('[Step 10] All assigned posts were used to generate articles')
    return { unassigned: 0 }
  }

  // Unassign unused posts back to pool
  const { error } = await supabaseAdmin
    .from('rss_posts')
    .update({ issue_id: null })
    .in('id', unusedPostIds)

  if (error) {
    console.error('[Step 10] Error unassigning posts:', error.message)
    throw error
  }

  console.log(`[Step 10] ✓ Stage 1 complete: ${unusedPostIds.length} posts unassigned (no articles generated)`)
  console.log('=== STEP 10 COMPLETE ===')

  return { unassigned: unusedPostIds.length }
}
