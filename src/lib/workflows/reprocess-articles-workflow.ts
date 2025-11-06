import { supabaseAdmin } from '@/lib/supabase'
import { RSSProcessor } from '@/lib/rss-processor'

/**
 * Reprocess Articles Workflow
 * Regenerates all articles for an existing campaign
 *
 * Steps:
 * 1. Cleanup (delete articles, null posts, set processing status)
 * 2. Select & dedupe (top 12 primary + 12 secondary)
 * 3. Generate 6 primary titles
 * 4. Generate 3 primary bodies (batch 1)
 * 5. Generate 3 primary bodies (batch 2)
 * 6. Generate 6 secondary titles
 * 7. Generate 3 secondary bodies (batch 1)
 * 8. Generate 3 secondary bodies (batch 2)
 * 9. Fact-check all articles
 * 10. Finalize (select top 3 each, regenerate welcome, set draft)
 */
export async function reprocessArticlesWorkflow(input: {
  campaign_id: string
  newsletter_id: string
}) {
  "use workflow"

  const { campaign_id, newsletter_id } = input

  console.log(`[Reprocess Workflow] Starting for campaign: ${campaign_id}`)

  // STEP 1: Cleanup
  await cleanupCampaign(campaign_id)

  // STEP 2: Select & Dedupe
  await selectAndDedupe(campaign_id, newsletter_id)

  // PRIMARY SECTION
  // STEP 3: Generate all 6 primary titles
  await generatePrimaryTitles(campaign_id)

  // STEP 4-5: Generate primary bodies in 2 batches (3 articles each)
  await generatePrimaryBodiesBatch1(campaign_id)
  await generatePrimaryBodiesBatch2(campaign_id)

  // SECONDARY SECTION
  // STEP 6: Generate all 6 secondary titles
  await generateSecondaryTitles(campaign_id)

  // STEP 7-8: Generate secondary bodies in 2 batches (3 articles each)
  await generateSecondaryBodiesBatch1(campaign_id)
  await generateSecondaryBodiesBatch2(campaign_id)

  // STEP 9: Fact-check all articles
  await factCheckAllArticles(campaign_id)

  // STEP 10: Finalize
  await finalizeCampaign(campaign_id)

  console.log('[Reprocess Workflow] ✓ Complete')

  return { campaign_id, success: true }
}

// Step 1: Cleanup
async function cleanupCampaign(campaignId: string) {
  "use step"

  console.log('[Reprocess Step 1/10] Cleaning up campaign...')

  // Delete all existing articles
  const { error: deleteArticlesError } = await supabaseAdmin
    .from('articles')
    .delete()
    .eq('campaign_id', campaignId)

  if (deleteArticlesError) {
    console.error('[Reprocess Step 1/10] Error deleting articles:', deleteArticlesError)
  }

  // Delete all existing secondary articles
  const { error: deleteSecondaryError } = await supabaseAdmin
    .from('secondary_articles')
    .delete()
    .eq('campaign_id', campaignId)

  if (deleteSecondaryError) {
    console.error('[Reprocess Step 1/10] Error deleting secondary articles:', deleteSecondaryError)
  }

  // Unassign all posts (set campaign_id to null)
  const { error: nullPostsError } = await supabaseAdmin
    .from('rss_posts')
    .update({ campaign_id: null })
    .eq('campaign_id', campaignId)

  if (nullPostsError) {
    console.error('[Reprocess Step 1/10] Error nulling posts:', nullPostsError)
  }

  // Set campaign status to processing
  const { error: updateStatusError } = await supabaseAdmin
    .from('newsletter_campaigns')
    .update({ status: 'processing' })
    .eq('id', campaignId)

  if (updateStatusError) {
    console.error('[Reprocess Step 1/10] Error updating status:', updateStatusError)
  }

  console.log('[Reprocess Step 1/10] ✓ Cleanup complete')
}

// Step 2: Select & Dedupe
async function selectAndDedupe(campaignId: string, newsletterId: string) {
  "use step"

  console.log('[Reprocess Step 2/10] Selecting and deduplicating posts...')

  // Get primary and secondary feed IDs
  const { data: primaryFeeds } = await supabaseAdmin
    .from('rss_feeds')
    .select('id')
    .eq('active', true)
    .eq('use_for_primary_section', true)

  const { data: secondaryFeeds } = await supabaseAdmin
    .from('rss_feeds')
    .select('id')
    .eq('active', true)
    .eq('use_for_secondary_section', true)

  const primaryFeedIds = primaryFeeds?.map(f => f.id) || []
  const secondaryFeedIds = secondaryFeeds?.map(f => f.id) || []

  // Get lookback window
  const { data: lookbackSetting } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('newsletter_id', newsletterId)
    .eq('key', 'primary_article_lookback_hours')
    .single()

  const lookbackHours = lookbackSetting ? parseInt(lookbackSetting.value) : 72
  const lookbackDate = new Date()
  lookbackDate.setHours(lookbackDate.getHours() - lookbackHours)
  const lookbackTimestamp = lookbackDate.toISOString()

  // Get and assign top 12 primary posts
  const { data: allPrimaryPosts } = await supabaseAdmin
    .from('rss_posts')
    .select('id, post_ratings(total_score)')
    .in('feed_id', primaryFeedIds)
    .is('campaign_id', null)
    .gte('processed_at', lookbackTimestamp)
    .not('post_ratings', 'is', null)

  const topPrimary = allPrimaryPosts
    ?.sort((a: any, b: any) => {
      const scoreA = a.post_ratings?.[0]?.total_score || 0
      const scoreB = b.post_ratings?.[0]?.total_score || 0
      return scoreB - scoreA
    })
    .slice(0, 12) || []

  // Get and assign top 12 secondary posts
  const { data: allSecondaryPosts } = await supabaseAdmin
    .from('rss_posts')
    .select('id, post_ratings(total_score)')
    .in('feed_id', secondaryFeedIds)
    .is('campaign_id', null)
    .gte('processed_at', lookbackTimestamp)
    .not('post_ratings', 'is', null)

  const topSecondary = allSecondaryPosts
    ?.sort((a: any, b: any) => {
      const scoreA = a.post_ratings?.[0]?.total_score || 0
      const scoreB = b.post_ratings?.[0]?.total_score || 0
      return scoreB - scoreA
    })
    .slice(0, 12) || []

  // Assign to campaign
  if (topPrimary.length > 0) {
    await supabaseAdmin
      .from('rss_posts')
      .update({ campaign_id: campaignId })
      .in('id', topPrimary.map(p => p.id))
  }

  if (topSecondary.length > 0) {
    await supabaseAdmin
      .from('rss_posts')
      .update({ campaign_id: campaignId })
      .in('id', topSecondary.map(p => p.id))
  }

  console.log(`[Reprocess Step 2/10] Assigned ${topPrimary.length} primary, ${topSecondary.length} secondary posts`)

  // Deduplicate
  const processor = new RSSProcessor()
  const dedupeResult = await processor.handleDuplicatesForCampaign(campaignId)
  console.log(`[Reprocess Step 2/10] Deduplication: ${dedupeResult.groups} groups, ${dedupeResult.duplicates} duplicates found`)
  console.log('[Reprocess Step 2/10] ✓ Select & dedupe complete')
}

// PRIMARY SECTION
async function generatePrimaryTitles(campaignId: string) {
  "use step"

  console.log('[Reprocess Step 3/10] Generating 6 primary titles...')
  const processor = new RSSProcessor()
  await processor.generateTitlesOnly(campaignId, 'primary', 6)

  const { data: articles } = await supabaseAdmin
    .from('articles')
    .select('id, headline')
    .eq('campaign_id', campaignId)
    .not('headline', 'is', null)

  console.log(`[Reprocess Step 3/10] ✓ Generated ${articles?.length || 0} primary titles`)
}

async function generatePrimaryBodiesBatch1(campaignId: string) {
  "use step"

  console.log('[Reprocess Step 4/10] Generating 3 primary bodies (batch 1)...')
  const processor = new RSSProcessor()
  await processor.generateBodiesOnly(campaignId, 'primary', 0, 3)

  const { data: articles } = await supabaseAdmin
    .from('articles')
    .select('id, content')
    .eq('campaign_id', campaignId)
    .not('content', 'is', null)

  console.log(`[Reprocess Step 4/10] ✓ Total bodies generated: ${articles?.length || 0}`)
}

async function generatePrimaryBodiesBatch2(campaignId: string) {
  "use step"

  console.log('[Reprocess Step 5/10] Generating 3 more primary bodies (batch 2)...')
  const processor = new RSSProcessor()
  await processor.generateBodiesOnly(campaignId, 'primary', 3, 3)

  const { data: articles } = await supabaseAdmin
    .from('articles')
    .select('id, content')
    .eq('campaign_id', campaignId)
    .not('content', 'is', null)

  console.log(`[Reprocess Step 5/10] ✓ Total primary bodies: ${articles?.length || 0}`)
}

// SECONDARY SECTION
async function generateSecondaryTitles(campaignId: string) {
  "use step"

  console.log('[Reprocess Step 6/10] Generating 6 secondary titles...')
  const processor = new RSSProcessor()
  await processor.generateTitlesOnly(campaignId, 'secondary', 6)

  const { data: articles } = await supabaseAdmin
    .from('secondary_articles')
    .select('id, headline')
    .eq('campaign_id', campaignId)
    .not('headline', 'is', null)

  console.log(`[Reprocess Step 6/10] ✓ Generated ${articles?.length || 0} secondary titles`)
}

async function generateSecondaryBodiesBatch1(campaignId: string) {
  "use step"

  console.log('[Reprocess Step 7/10] Generating 3 secondary bodies (batch 1)...')
  const processor = new RSSProcessor()
  await processor.generateBodiesOnly(campaignId, 'secondary', 0, 3)

  const { data: articles } = await supabaseAdmin
    .from('secondary_articles')
    .select('id, content')
    .eq('campaign_id', campaignId)
    .not('content', 'is', null)

  console.log(`[Reprocess Step 7/10] ✓ Total bodies generated: ${articles?.length || 0}`)
}

async function generateSecondaryBodiesBatch2(campaignId: string) {
  "use step"

  console.log('[Reprocess Step 8/10] Generating 3 more secondary bodies (batch 2)...')
  const processor = new RSSProcessor()
  await processor.generateBodiesOnly(campaignId, 'secondary', 3, 3)

  const { data: articles } = await supabaseAdmin
    .from('secondary_articles')
    .select('id, content')
    .eq('campaign_id', campaignId)
    .not('content', 'is', null)

  console.log(`[Reprocess Step 8/10] ✓ Total secondary bodies: ${articles?.length || 0}`)
}

// FACT-CHECK
async function factCheckAllArticles(campaignId: string) {
  "use step"

  console.log('[Reprocess Step 9/10] Fact-checking all articles...')
  const processor = new RSSProcessor()

  // Fact-check primary articles
  await processor.factCheckArticles(campaignId, 'primary')

  const { data: primaryArticles } = await supabaseAdmin
    .from('articles')
    .select('id, fact_check_score')
    .eq('campaign_id', campaignId)
    .not('fact_check_score', 'is', null)

  const primaryAvg = (primaryArticles?.reduce((sum, a) => sum + (a.fact_check_score || 0), 0) || 0) / (primaryArticles?.length || 1)
  console.log(`[Reprocess Step 9/10] Fact-checked ${primaryArticles?.length || 0} primary articles (avg: ${primaryAvg.toFixed(1)}/10)`)

  // Fact-check secondary articles
  await processor.factCheckArticles(campaignId, 'secondary')

  const { data: secondaryArticles } = await supabaseAdmin
    .from('secondary_articles')
    .select('id, fact_check_score')
    .eq('campaign_id', campaignId)
    .not('fact_check_score', 'is', null)

  const secondaryAvg = (secondaryArticles?.reduce((sum, a) => sum + (a.fact_check_score || 0), 0) || 0) / (secondaryArticles?.length || 1)
  console.log(`[Reprocess Step 9/10] Fact-checked ${secondaryArticles?.length || 0} secondary articles (avg: ${secondaryAvg.toFixed(1)}/10)`)
  console.log('[Reprocess Step 9/10] ✓ Fact-check complete')
}

// FINALIZE
async function finalizeCampaign(campaignId: string) {
  "use step"

  console.log('[Reprocess Step 10/10] Finalizing campaign...')
  const processor = new RSSProcessor()

  // Auto-select top 3 per section
  await processor.selectTopArticlesForCampaign(campaignId)

  const { data: activeArticles } = await supabaseAdmin
    .from('articles')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('is_active', true)

  const { data: activeSecondary } = await supabaseAdmin
    .from('secondary_articles')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('is_active', true)

  console.log(`[Reprocess Step 10/10] Selected ${activeArticles?.length || 0} primary, ${activeSecondary?.length || 0} secondary`)

  // Generate welcome section
  await processor.generateWelcomeSection(campaignId)

  // Set status to draft
  await supabaseAdmin
    .from('newsletter_campaigns')
    .update({ status: 'draft' })
    .eq('id', campaignId)

  // Unassign unused posts
  const unassignResult = await processor.unassignUnusedPosts(campaignId)
  console.log(`[Reprocess Step 10/10] ✓ Finalized. Unassigned ${unassignResult.unassigned} unused posts`)
}
