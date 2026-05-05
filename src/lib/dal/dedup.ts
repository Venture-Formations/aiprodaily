/**
 * Data Access Layer — Deduplication Domain
 *
 * Centralizes queries against `duplicate_groups` and `duplicate_posts`. The
 * `storeDeduplicationResult` composite helper writes both tables in sequence;
 * Supabase JS does not expose transactions, so the two writes are NOT atomic.
 * If a process dies between them an issue will have a duplicate group with no
 * duplicate posts attached. This matches the existing inline behavior; making
 * it atomic requires a Postgres RPC. Tracked as a follow-up.
 *
 * Conventions match `dal/issues.ts`:
 *  - Reads return `T | null` for single, `T[]` for list, never throw.
 *  - Writes return `boolean` (or the inserted row when callers need the id).
 *  - Errors are logged with structured pino fields and swallowed.
 *  - Multi-tenant isolation: dedup tables are scoped via issue_id.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import type { DuplicateGroup, DuplicatePost } from '@/types/database'

const log = createLogger({ module: 'dal:dedup' })

// ==================== READ OPERATIONS ====================

/**
 * Cheap guard: does this issue already have any duplicate groups recorded?
 */
export async function isIssueDeduplicated(issueId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('duplicate_groups')
      .select('id')
      .eq('issue_id', issueId)
      .limit(1)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      log.error({ err: error, issueId }, 'isIssueDeduplicated failed')
      return false
    }
    return !!data
  } catch (err) {
    log.error({ err, issueId }, 'isIssueDeduplicated exception')
    return false
  }
}

/**
 * Return just the group IDs for an issue. Callers join to `duplicate_posts`
 * separately via `listDuplicatePostIdsByGroups`.
 */
export async function listDuplicateGroupIdsByIssue(issueId: string): Promise<string[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('duplicate_groups')
      .select('id')
      .eq('issue_id', issueId)

    if (error) {
      log.error({ err: error, issueId }, 'listDuplicateGroupIdsByIssue failed')
      return []
    }
    return (data || []).map(g => g.id)
  } catch (err) {
    log.error({ err, issueId }, 'listDuplicateGroupIdsByIssue exception')
    return []
  }
}

/**
 * Return the post IDs marked as duplicates within a set of groups.
 * Useful when filtering candidate posts for article generation.
 */
export async function listDuplicatePostIdsByGroups(groupIds: string[]): Promise<Set<string>> {
  if (groupIds.length === 0) return new Set()
  try {
    const { data, error } = await supabaseAdmin
      .from('duplicate_posts')
      .select('post_id')
      .in('group_id', groupIds)

    if (error) {
      log.error({ err: error, count: groupIds.length }, 'listDuplicatePostIdsByGroups failed')
      return new Set()
    }
    return new Set((data || []).map(d => d.post_id))
  } catch (err) {
    log.error({ err }, 'listDuplicatePostIdsByGroups exception')
    return new Set()
  }
}

/**
 * Return full duplicate-post rows for a single group (dashboard inspection).
 */
export async function listDuplicatePostsForGroup(groupId: string): Promise<DuplicatePost[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('duplicate_posts')
      .select('id, group_id, post_id, similarity_score, detection_method, actual_similarity_score')
      .eq('group_id', groupId)

    if (error) {
      log.error({ err: error, groupId }, 'listDuplicatePostsForGroup failed')
      return []
    }
    return (data || []) as DuplicatePost[]
  } catch (err) {
    log.error({ err, groupId }, 'listDuplicatePostsForGroup exception')
    return []
  }
}

// ==================== WRITE OPERATIONS ====================

/**
 * Create a duplicate group. Returns the inserted row (with id) or null.
 */
export async function createDuplicateGroup(input: {
  issueId: string
  primaryPostId: string
  topicSignature: string | null
}): Promise<DuplicateGroup | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('duplicate_groups')
      .insert([
        {
          issue_id: input.issueId,
          primary_post_id: input.primaryPostId,
          topic_signature: input.topicSignature,
        },
      ])
      .select('id, issue_id, primary_post_id, topic_signature, created_at')
      .single()

    if (error || !data) {
      log.error({ err: error, issueId: input.issueId }, 'createDuplicateGroup failed')
      return null
    }
    return data as DuplicateGroup
  } catch (err) {
    log.error({ err, issueId: input.issueId }, 'createDuplicateGroup exception')
    return null
  }
}

export type NewDuplicatePost = {
  postId: string
  similarityScore: number
  // Mirrors `DuplicatePost.detection_method` in database.ts plus
  // `'ai_cross_section'` which the Deduplicator currently emits but the
  // database type omits. String fallback covers both shipping callers.
  detectionMethod?: string
}

/**
 * Add a single duplicate-post row to an existing group.
 */
export async function addDuplicatePostToGroup(
  groupId: string,
  post: NewDuplicatePost
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('duplicate_posts')
      .insert([
        {
          group_id: groupId,
          post_id: post.postId,
          similarity_score: post.similarityScore,
          detection_method: post.detectionMethod ?? null,
          actual_similarity_score: post.similarityScore,
        },
      ])

    if (error) {
      log.error({ err: error, groupId, postId: post.postId }, 'addDuplicatePostToGroup failed')
      return false
    }
    return true
  } catch (err) {
    log.error({ err, groupId, postId: post.postId }, 'addDuplicatePostToGroup exception')
    return false
  }
}

export interface DeduplicationResultInput {
  issueId: string
  primaryPostId: string
  topicSignature: string | null
  duplicates: NewDuplicatePost[]
}

export interface DeduplicationResultOutput {
  group: DuplicateGroup | null
  storedDuplicates: number
}

/**
 * Composite write: create the group then bulk-insert all duplicate posts in a
 * single round-trip. NOT atomic across the two tables — see file-header
 * comment. Returns the group plus the count of inserted duplicate-post rows
 * (0 on bulk-insert failure; the group still exists in that case).
 */
export async function storeDeduplicationResult(
  input: DeduplicationResultInput
): Promise<DeduplicationResultOutput> {
  const group = await createDuplicateGroup({
    issueId: input.issueId,
    primaryPostId: input.primaryPostId,
    topicSignature: input.topicSignature,
  })

  if (!group) {
    return { group: null, storedDuplicates: 0 }
  }

  if (input.duplicates.length === 0) {
    return { group, storedDuplicates: 0 }
  }

  try {
    const rows = input.duplicates.map(dup => ({
      group_id: group.id,
      post_id: dup.postId,
      similarity_score: dup.similarityScore,
      detection_method: dup.detectionMethod ?? null,
      actual_similarity_score: dup.similarityScore,
    }))

    const { error } = await supabaseAdmin
      .from('duplicate_posts')
      .insert(rows)

    if (error) {
      log.error(
        { err: error, groupId: group.id, count: rows.length },
        'storeDeduplicationResult bulk insert failed'
      )
      return { group, storedDuplicates: 0 }
    }

    return { group, storedDuplicates: rows.length }
  } catch (err) {
    log.error({ err, groupId: group.id }, 'storeDeduplicationResult exception')
    return { group, storedDuplicates: 0 }
  }
}
