import { RSSProcessor } from '@/lib/rss-processor'

/**
 * Step 4: Deduplicate
 * - Run 4-stage deduplication to identify duplicate posts
 */
export async function executeStep4(issueId: string) {
  const processor = new RSSProcessor()

  await processor.handleDuplicatesForissue(issueId)

  const { supabaseAdmin } = await import('@/lib/supabase')
  const { data: duplicateGroups } = await supabaseAdmin
    .from('duplicate_groups')
    .select('id')
    .eq('issue_id', issueId)

  const { data: duplicatePosts } = await supabaseAdmin
    .from('duplicate_posts')
    .select('id')
    .in('group_id', duplicateGroups?.map(g => g.id) || [])

  const groupsCount = duplicateGroups ? duplicateGroups.length : 0
  const duplicatesCount = duplicatePosts ? duplicatePosts.length : 0
  console.log(`[Step 4/8] Complete: ${groupsCount} duplicate groups, ${duplicatesCount} duplicate posts`)
  return { groupsCount, duplicatesCount }
}

