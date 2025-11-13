import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Deduplicator } from '@/lib/deduplicator'

export const maxDuration = 600

/**
 * Reset deduplication for a issue and re-run with current prompt
 *
 * Usage: GET /api/debug/reset-deduplication?issueId=XXX&dry_run=true
 *
 * This will:
 * 1. Delete existing duplicate_groups and duplicate_posts for issue
 * 2. Re-run deduplication with current database prompt
 * 3. Show which posts are now marked as duplicates
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const issueId = searchParams.get('issue_id')
  const dryRun = searchParams.get('dry_run') !== 'false' // Default true

  if (!issueId) {
    return NextResponse.json({ error: 'issueId required' }, { status: 400 })
  }

  try {
    console.log(`[RESET-DEDUP] ${dryRun ? 'DRY RUN:' : ''} Resetting deduplication for issue ${issueId}`)

    // Step 1: Get existing duplicate groups
    const { data: existingGroups } = await supabaseAdmin
      .from('duplicate_groups')
      .select('id, topic_signature, primary_post_id')
      .eq('issue_id', issueId)

    const groupIds = existingGroups?.map(g => g.id) || []

    let deletedDuplicatePosts = 0
    if (groupIds.length > 0) {
      // Count duplicate posts that will be deleted
      const { data: duplicatePosts } = await supabaseAdmin
        .from('duplicate_posts')
        .select('id')
        .in('group_id', groupIds)

      deletedDuplicatePosts = duplicatePosts?.length || 0
    }

    // Step 2: Delete existing groups (if not dry run)
    if (!dryRun && groupIds.length > 0) {
      console.log(`[RESET-DEDUP] Deleting ${groupIds.length} duplicate groups...`)

      // Delete duplicate_posts first (foreign key)
      const { error: postsError } = await supabaseAdmin
        .from('duplicate_posts')
        .delete()
        .in('group_id', groupIds)

      if (postsError) {
        console.error('[RESET-DEDUP] Error deleting duplicate_posts:', postsError)
      }

      // Delete duplicate_groups
      const { error: groupsError } = await supabaseAdmin
        .from('duplicate_groups')
        .delete()
        .eq('issue_id', issueId)

      if (groupsError) {
        console.error('[RESET-DEDUP] Error deleting duplicate_groups:', groupsError)
        throw groupsError
      }

      console.log(`[RESET-DEDUP] ✓ Deleted ${groupIds.length} groups`)
    }

    // Step 3: Re-run deduplication with current prompt
    const { data: allPosts, error: postsError } = await supabaseAdmin
      .from('rss_posts')
      .select('*')
      .eq('issue_id', issueId)

    if (postsError || !allPosts || allPosts.length === 0) {
      return NextResponse.json({
        status: 'error',
        message: 'No posts found for issue'
      }, { status: 404 })
    }

    console.log(`[RESET-DEDUP] Running deduplication on ${allPosts.length} posts...`)

    // Load deduplication settings
    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .in('key', ['dedup_historical_lookback_days', 'dedup_strictness_threshold'])

    const settingsMap = new Map(settings?.map(s => [s.key, s.value]) || [])
    const historicalLookbackDays = parseInt(settingsMap.get('dedup_historical_lookback_days') || '3')
    const strictnessThreshold = parseFloat(settingsMap.get('dedup_strictness_threshold') || '0.80')

    const deduplicator = new Deduplicator({
      historicalLookbackDays,
      strictnessThreshold
    })

    const result = await deduplicator.detectAllDuplicates(allPosts, issueId)

    // Step 4: Save new results (if not dry run)
    let newGroupIds: string[] = []
    if (!dryRun) {
      console.log(`[RESET-DEDUP] Saving ${result.groups.length} new duplicate groups...`)

      for (const group of result.groups) {
        const primaryPost = allPosts[group.primary_post_index]
        if (!primaryPost) continue

        // Create duplicate group
        const { data: duplicateGroup, error: groupError } = await supabaseAdmin
          .from('duplicate_groups')
          .insert([{
            issue_id: issueId,
            primary_post_id: primaryPost.id,
            topic_signature: group.topic_signature
          }])
          .select('id')
          .single()

        if (groupError) {
          console.error('[RESET-DEDUP] Error creating group:', groupError)
          continue
        }

        if (duplicateGroup) {
          newGroupIds.push(duplicateGroup.id)

          // Add duplicate posts to group
          for (const dupIndex of group.duplicate_indices) {
            const dupPost = allPosts[dupIndex]
            if (dupPost && dupPost.id !== primaryPost.id) {
              await supabaseAdmin
                .from('duplicate_posts')
                .insert([{
                  group_id: duplicateGroup.id,
                  post_id: dupPost.id,
                  similarity_score: group.similarity_score,
                  detection_method: group.detection_method,
                  actual_similarity_score: group.similarity_score
                }])
            }
          }
        }
      }

      console.log(`[RESET-DEDUP] ✓ Created ${newGroupIds.length} new duplicate groups`)
    }

    // Format new groups for display
    const newGroups = result.groups.map(group => {
      const primaryPost = allPosts[group.primary_post_index]
      const duplicatePosts = group.duplicate_indices.map(idx => allPosts[idx])

      return {
        detection_method: group.detection_method,
        topic_signature: group.topic_signature,
        similarity_score: group.similarity_score,
        primary_post: {
          title: primaryPost?.title,
          index: group.primary_post_index
        },
        duplicate_count: group.duplicate_indices.length,
        duplicates: duplicatePosts.map(p => ({ title: p?.title }))
      }
    })

    return NextResponse.json({
      status: 'success',
      dry_run: dryRun,
      message: dryRun
        ? `Would delete ${groupIds.length} old groups and create ${result.groups.length} new groups`
        : `Deleted ${groupIds.length} old groups and created ${newGroupIds.length} new groups`,
      old_deduplication: {
        groups_count: groupIds.length,
        duplicate_posts_count: deletedDuplicatePosts,
        groups: existingGroups || []
      },
      new_deduplication: {
        total_posts: result.stats.total_posts,
        unique_posts: result.stats.unique_posts,
        duplicate_posts: result.stats.duplicate_posts,
        stage_breakdown: {
          stage_0_historical: result.stats.historical_duplicates,
          stage_1_exact: result.stats.exact_duplicates,
          stage_2_title: result.stats.title_duplicates,
          stage_3_semantic: result.stats.semantic_duplicates
        },
        groups: newGroups
      },
      config: {
        historical_lookback_days: historicalLookbackDays,
        strictness_threshold: strictnessThreshold
      }
    })

  } catch (error) {
    console.error('[RESET-DEDUP] Error:', error)
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
