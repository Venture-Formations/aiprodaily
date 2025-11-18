import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Deduplicator } from '@/lib/deduplicator'

export const maxDuration = 60

/**
 * Test the new deduplication fix with real issues
 * Tests Nov 17 and Nov 18 issues to verify historical checking works
 */
export async function GET(request: NextRequest) {
  const issueId1 = 'f546382b-54e6-4d3f-8edf-79bc20541b85' // Nov 17
  const issueId2 = 'd8679cfd-c2a2-42c0-aa1a-ca6a612ba0af' // Nov 18

  console.log('========== DEDUP FIX TEST ==========')

  const results: any = {
    test_description: 'Simulating Nov 18 deduplication with Nov 17 as historical',
    step1_fetch_historical: {},
    step2_fetch_current: {},
    step3_run_deduplication: {},
    step4_analysis: {}
  }

  // STEP 1: Get Nov 17 posts (these will be "historical")
  const { data: nov17Articles } = await supabaseAdmin
    .from('articles')
    .select('post_id')
    .eq('issue_id', issueId1)
    .eq('is_active', true)
    .eq('skipped', false)

  const nov17PostIds = nov17Articles?.map(a => a.post_id).filter(Boolean) || []

  const { data: nov17Posts } = await supabaseAdmin
    .from('rss_posts')
    .select('*')
    .in('id', nov17PostIds)

  results.step1_fetch_historical = {
    count: nov17Posts?.length || 0,
    posts: nov17Posts?.map(p => ({
      id: p.id,
      title: p.title,
      feed_id: p.feed_id
    }))
  }

  console.log(`[TEST] Fetched ${nov17Posts?.length || 0} historical posts from Nov 17`)

  // STEP 2: Get Nov 18 posts (these are "current")
  const { data: nov18Articles } = await supabaseAdmin
    .from('articles')
    .select('post_id')
    .eq('issue_id', issueId2)
    .eq('is_active', true)
    .eq('skipped', false)

  const nov18PostIds = nov18Articles?.map(a => a.post_id).filter(Boolean) || []

  const { data: nov18Posts } = await supabaseAdmin
    .from('rss_posts')
    .select('*')
    .in('id', nov18PostIds)

  results.step2_fetch_current = {
    count: nov18Posts?.length || 0,
    posts: nov18Posts?.map(p => ({
      id: p.id,
      title: p.title,
      feed_id: p.feed_id
    }))
  }

  console.log(`[TEST] Fetched ${nov18Posts?.length || 0} current posts from Nov 18`)

  if (!nov17Posts || !nov18Posts || nov17Posts.length === 0 || nov18Posts.length === 0) {
    return NextResponse.json({
      error: 'Could not fetch posts for testing',
      results
    }, { status: 400 })
  }

  // STEP 3: Run new deduplicator logic
  // We need to manually simulate the historical fetch and pass to detectAllDuplicates

  // Create a test class that exposes the new logic
  const deduplicator = new Deduplicator({
    historicalLookbackDays: 3,
    strictnessThreshold: 0.80
  })

  console.log('[TEST] Running deduplication with new logic...')

  try {
    // Run the new detectAllDuplicates which will fetch historical posts
    // But we need to trick it to use Nov 17 as historical
    // Actually, let's just call it normally and see if it would catch Nov 17 if it was marked as sent

    const result = await deduplicator.detectAllDuplicates(nov18Posts, issueId2)

    results.step3_run_deduplication = {
      total_posts: result.stats.total_posts,
      unique_posts: result.stats.unique_posts,
      duplicate_posts: result.stats.duplicate_posts,
      historical_duplicates: result.stats.historical_duplicates,
      exact_duplicates: result.stats.exact_duplicates,
      title_duplicates: result.stats.title_duplicates,
      semantic_duplicates: result.stats.semantic_duplicates,
      groups_found: result.groups.length,
      groups: result.groups.map(g => ({
        topic_signature: g.topic_signature,
        detection_method: g.detection_method,
        similarity_score: g.similarity_score,
        explanation: g.explanation,
        primary_post_id: g.primary_post_id,
        duplicate_count: g.duplicate_post_ids.length,
        duplicate_post_ids: g.duplicate_post_ids
      }))
    }

    console.log('[TEST] Deduplication complete')
    console.log(`[TEST] Found ${result.groups.length} duplicate groups`)
    console.log(`[TEST] Historical: ${result.stats.historical_duplicates}, Title: ${result.stats.title_duplicates}, Semantic: ${result.stats.semantic_duplicates}`)

  } catch (error) {
    console.error('[TEST] Error running deduplication:', error)
    results.step3_run_deduplication = {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }
  }

  // STEP 4: Analysis - check if "AI Tax" article would be caught
  const aiTaxNov17 = nov17Posts.find(p => p.title.includes('AI Tax'))
  const aiTaxNov18 = nov18Posts.find(p => p.title.includes('AI Tax'))

  results.step4_analysis = {
    ai_tax_article_check: {
      nov17_present: !!aiTaxNov17,
      nov18_present: !!aiTaxNov18,
      nov17_title: aiTaxNov17?.title,
      nov18_title: aiTaxNov18?.title,
      titles_identical: aiTaxNov17?.title === aiTaxNov18?.title,
      would_stage2_catch: aiTaxNov17?.title === aiTaxNov18?.title ? 'YES - Titles are identical, Stage 2 would catch this' : 'NO'
    },
    nov17_status_check: {
      note: 'Nov 17 issue status determines if it appears in historical check',
      check_query: `SELECT status FROM publication_issues WHERE id = '${issueId1}'`
    }
  }

  // Check Nov 17 status
  const { data: nov17Issue } = await supabaseAdmin
    .from('publication_issues')
    .select('status, date')
    .eq('id', issueId1)
    .single()

  results.step4_analysis.nov17_status_check.status = nov17Issue?.status
  results.step4_analysis.nov17_status_check.included_in_historical = nov17Issue?.status === 'sent' ? 'YES' : 'NO - not sent yet'

  return NextResponse.json({
    success: true,
    test_summary: {
      historical_posts_available: nov17Posts.length,
      current_posts_tested: nov18Posts.length,
      duplicates_found: results.step3_run_deduplication.groups_found || 0,
      nov17_was_sent: nov17Issue?.status === 'sent',
      fix_would_work: results.step4_analysis.ai_tax_article_check.would_stage2_catch
    },
    detailed_results: results
  }, { status: 200 })
}
