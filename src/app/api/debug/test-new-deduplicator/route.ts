import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Deduplicator } from '@/lib/deduplicator'

export const maxDuration = 60

/**
 * Test endpoint for new 3-stage deduplication system
 *
 * Usage: GET /api/debug/test-new-deduplicator?campaign_id=XXX&dry_run=true
 *
 * Shows detailed results from each stage without persisting to database
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const campaignId = searchParams.get('campaign_id')
  const dryRun = searchParams.get('dry_run') !== 'false' // Default true

  if (!campaignId) {
    return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
  }

  try {
    console.log(`[TEST-DEDUP] Testing deduplication for campaign ${campaignId}`)

    // Fetch all posts for this campaign
    const { data: posts, error } = await supabaseAdmin
      .from('rss_posts')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('processed_at', { ascending: false })

    if (error) {
      console.error('[TEST-DEDUP] Query error:', error)
      throw error
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No posts found for this campaign'
      })
    }

    console.log(`[TEST-DEDUP] Found ${posts.length} posts`)

    // Run deduplication
    const deduplicator = new Deduplicator()
    const result = await deduplicator.detectAllDuplicates(posts)

    // Format results for display
    const groupDetails = result.groups.map(group => {
      const primaryPost = posts[group.primary_post_index]
      const duplicatePosts = group.duplicate_indices.map(idx => posts[idx])

      return {
        detection_method: group.detection_method,
        topic_signature: group.topic_signature,
        similarity_score: group.similarity_score,
        explanation: group.explanation,
        primary_post: {
          index: group.primary_post_index,
          title: primaryPost?.title,
          content_preview: (primaryPost?.full_article_text || primaryPost?.content || '').substring(0, 200)
        },
        duplicate_posts: duplicatePosts.map((post, i) => ({
          index: group.duplicate_indices[i],
          title: post?.title,
          content_preview: (post?.full_article_text || post?.content || '').substring(0, 200)
        }))
      }
    })

    // Check if campaign has already been deduplicated
    const { data: existingGroups } = await supabaseAdmin
      .from('duplicate_groups')
      .select('id, topic_signature')
      .eq('campaign_id', campaignId)

    const response = {
      success: true,
      dry_run: dryRun,
      campaign_id: campaignId,
      total_posts: posts.length,
      stats: result.stats,
      groups: groupDetails,
      already_deduplicated: existingGroups && existingGroups.length > 0,
      existing_groups: existingGroups || [],
      stage_breakdown: {
        stage_1_exact: result.stats.exact_duplicates,
        stage_2_title: result.stats.title_duplicates,
        stage_3_semantic: result.stats.semantic_duplicates
      }
    }

    // If not dry run, persist results
    if (!dryRun && (!existingGroups || existingGroups.length === 0)) {
      console.log('[TEST-DEDUP] Persisting results to database...')

      for (const group of result.groups) {
        const primaryPost = posts[group.primary_post_index]
        if (!primaryPost) continue

        // Create duplicate group
        const { data: duplicateGroup, error: groupError } = await supabaseAdmin
          .from('duplicate_groups')
          .insert([{
            campaign_id: campaignId,
            primary_post_id: primaryPost.id,
            topic_signature: group.topic_signature
          }])
          .select('id')
          .single()

        if (groupError) {
          console.error('[TEST-DEDUP] Error creating group:', groupError)
          continue
        }

        if (duplicateGroup) {
          // Add duplicate posts to group
          for (const dupIndex of group.duplicate_indices) {
            const dupPost = posts[dupIndex]
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

      console.log('[TEST-DEDUP] Results persisted')
      response.dry_run = false
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('[TEST-DEDUP] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
