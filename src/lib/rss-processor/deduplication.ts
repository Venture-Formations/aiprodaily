import { supabaseAdmin } from '../supabase'
import { Deduplicator } from '../deduplicator'
import type { RssPost } from '@/types/database'
import { getNewsletterIdFromIssue } from './shared-context'

/**
 * Duplicate detection and handling module.
 */
export class Deduplication {
  async handleDuplicatesForIssue(issueId: string) {
    const { data: allPosts, error } = await supabaseAdmin
      .from('rss_posts')
      .select('*')
      .eq('issue_id', issueId)

    if (error || !allPosts || allPosts.length === 0) {
      return { groups: 0, duplicates: 0 }
    }

    await this.handleDuplicates(allPosts, issueId)

    const { data: duplicateGroups } = await supabaseAdmin
      .from('duplicate_groups')
      .select('id')
      .eq('issue_id', issueId)

    const { data: duplicatePosts } = await supabaseAdmin
      .from('duplicate_posts')
      .select('id')
      .in('group_id', duplicateGroups?.map(g => g.id) || [])

    return {
      groups: duplicateGroups ? duplicateGroups.length : 0,
      duplicates: duplicatePosts ? duplicatePosts.length : 0
    }
  }

  async handleDuplicates(posts: RssPost[], issueId: string) {
    try {
      // Check if already deduplicated for this issue
      const { data: existingGroups } = await supabaseAdmin
        .from('duplicate_groups')
        .select('id')
        .eq('issue_id', issueId)
        .limit(1)

      if (existingGroups && existingGroups.length > 0) {
        return
      }

      const { data: allPosts, error } = await supabaseAdmin
        .from('rss_posts')
        .select('*')
        .eq('issue_id', issueId)

      if (error || !allPosts || allPosts.length === 0) {
        return
      }

      // Get publication_id from issue for multi-tenant filtering
      const newsletterId = await getNewsletterIdFromIssue(issueId)

      // Load deduplication settings
      const { data: settings } = await supabaseAdmin
        .from('publication_settings')
        .select('key, value')
        .eq('publication_id', newsletterId)
        .in('key', ['dedup_historical_lookback_days', 'dedup_strictness_threshold'])

      const settingsMap = new Map(settings?.map(s => [s.key, s.value]) || [])
      const historicalLookbackDays = parseInt(settingsMap.get('dedup_historical_lookback_days') || '3')
      const strictnessThreshold = parseFloat(settingsMap.get('dedup_strictness_threshold') || '0.80')

      // Run 4-stage deduplication with config
      const deduplicator = new Deduplicator({
        historicalLookbackDays,
        strictnessThreshold
      })
      const result = await deduplicator.detectAllDuplicates(allPosts, issueId)

      console.log(`[Dedup] AI found ${result.groups?.length || 0} duplicate groups`)
      console.log(`[Dedup] Full result:`, JSON.stringify(result, null, 2))

      if (!result || !result.groups || !Array.isArray(result.groups)) {
        console.log('[Dedup] No duplicate groups to store')
        return
      }

      // Store results in database
      let storedGroups = 0
      let storedDuplicates = 0

      for (const group of result.groups) {
        if (!group.primary_post_id || !Array.isArray(group.duplicate_post_ids)) {
          console.error(`[Dedup] Invalid group structure:`, group)
          continue
        }

        console.log(`[Dedup] Storing group: "${group.topic_signature?.substring(0, 50)}..." - Primary: ${group.primary_post_id}`)

        // Create duplicate group
        const { data: duplicateGroup, error: groupError } = await supabaseAdmin
          .from('duplicate_groups')
          .insert([{
            issue_id: issueId,
            primary_post_id: group.primary_post_id,
            topic_signature: group.topic_signature
          }])
          .select('id')
          .single()

        if (groupError) {
          console.error(`[Dedup] Failed to create group:`, groupError.message)
          continue
        }

        storedGroups++

        if (duplicateGroup) {
          console.log(`[Dedup] Marking ${group.duplicate_post_ids.length} posts as duplicates`)

          const isHistoricalMatch = group.detection_method === 'historical_match' ||
                                   (group.detection_method === 'title_similarity' &&
                                    group.explanation?.includes('previously published')) ||
                                   (group.detection_method === 'ai_semantic' &&
                                    group.explanation?.includes('previously published')) ||
                                   group.topic_signature?.startsWith('Historical AI match:')

          for (const postId of group.duplicate_post_ids) {
            if (postId === group.primary_post_id && !isHistoricalMatch) {
              console.log(`[Dedup] Skipping primary post ${postId} from duplicate list`)
              continue
            }

            const { error: dupError } = await supabaseAdmin
              .from('duplicate_posts')
              .insert([{
                group_id: duplicateGroup.id,
                post_id: postId,
                similarity_score: group.similarity_score,
                detection_method: group.detection_method,
                actual_similarity_score: group.similarity_score
              }])

            if (dupError) {
              console.error(`[Dedup] Failed to mark post ${postId} as duplicate:`, dupError.message)
            } else {
              console.log(`[Dedup] Marked post ${postId} as duplicate (${group.detection_method})`)
              storedDuplicates++
            }
          }
        }
      }

      console.log(`[Dedup] Stored ${storedGroups} groups with ${storedDuplicates} duplicate posts total`)

    } catch (error: any) {
      console.error(`[Dedup] CRITICAL ERROR - Deduplication failed completely:`, error.message)
      console.error(`[Dedup] Stack trace:`, error.stack)
      // Don't throw - allow workflow to continue, but log the failure prominently
    }
  }
}
