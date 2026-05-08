import { Deduplicator } from '../deduplicator'
import { getPublicationSettings } from '../publication-settings'
import type { RssPost } from '@/types/database'
import { getNewsletterIdFromIssue } from './shared-context'
import { listPostsByIssue } from '@/lib/dal/posts'
import {
  isIssueDeduplicated,
  listDuplicateGroupIdsByIssue,
  listDuplicatePostIdsByGroups,
  storeDeduplicationResult,
  type NewDuplicatePost,
} from '@/lib/dal/dedup'

/**
 * A "historical match" is a duplicate group whose primary post was published
 * in a prior issue — meaning the primary itself should also be flagged as a
 * duplicate (so we don't re-run an article on it).
 */
function isHistoricalDedupGroup(group: {
  detection_method?: string
  explanation?: string
  topic_signature?: string
}): boolean {
  if (group.detection_method === 'historical_match') return true
  if (group.topic_signature?.startsWith('Historical AI match:')) return true
  if (
    (group.detection_method === 'title_similarity' || group.detection_method === 'ai_semantic') &&
    group.explanation?.includes('previously published')
  ) {
    return true
  }
  return false
}

/**
 * Duplicate detection and handling module.
 */
export class Deduplication {
  async handleDuplicatesForIssue(issueId: string) {
    const allPosts = await listPostsByIssue(issueId)

    if (allPosts.length === 0) {
      return { groups: 0, duplicates: 0 }
    }

    await this.handleDuplicates(allPosts, issueId)

    const groupIds = await listDuplicateGroupIdsByIssue(issueId)
    const duplicatePostIds = await listDuplicatePostIdsByGroups(groupIds)

    return {
      groups: groupIds.length,
      duplicates: duplicatePostIds.size,
    }
  }

  async handleDuplicates(posts: RssPost[], issueId: string) {
    try {
      // Check if already deduplicated for this issue
      if (await isIssueDeduplicated(issueId)) {
        return
      }

      if (posts.length === 0) {
        return
      }
      const allPosts = posts

      // Get publication_id from issue for multi-tenant filtering
      const newsletterId = await getNewsletterIdFromIssue(issueId)

      const settings = await getPublicationSettings(newsletterId, [
        'dedup_historical_lookback_days',
        'dedup_strictness_threshold',
      ])
      const historicalLookbackDays = parseInt(settings.dedup_historical_lookback_days || '3', 10)
      const strictnessThreshold = parseFloat(settings.dedup_strictness_threshold || '0.80')

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

        const isHistoricalMatch = isHistoricalDedupGroup(group)

        const duplicates: NewDuplicatePost[] = group.duplicate_post_ids
          .filter((postId: string) => isHistoricalMatch || postId !== group.primary_post_id)
          .map((postId: string) => ({
            postId,
            similarityScore: group.similarity_score,
            detectionMethod: group.detection_method,
          }))

        const { group: created, storedDuplicates: insertedCount } = await storeDeduplicationResult({
          issueId,
          primaryPostId: group.primary_post_id,
          topicSignature: group.topic_signature,
          duplicates,
        })

        if (!created) {
          console.error(`[Dedup] Failed to create group for primary ${group.primary_post_id}`)
          continue
        }

        storedGroups++
        storedDuplicates += insertedCount
        console.log(`[Dedup] Stored group ${created.id}: ${insertedCount}/${duplicates.length} duplicate rows inserted`)
      }

      console.log(`[Dedup] Stored ${storedGroups} groups with ${storedDuplicates} duplicate posts total`)

    } catch (error: any) {
      console.error(`[Dedup] CRITICAL ERROR - Deduplication failed completely:`, error.message)
      console.error(`[Dedup] Stack trace:`, error.stack)
      // Don't throw - allow workflow to continue, but log the failure prominently
    }
  }
}
