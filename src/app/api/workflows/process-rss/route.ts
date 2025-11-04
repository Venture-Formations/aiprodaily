import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { RSSProcessor } from '@/lib/rss-processor'

/**
 * RSS Processing Workflow
 * Each step gets its own 800-second timeout
 * Handles GPT-5's longer processing times
 */
export async function processRSSWorkflow(input: { trigger: 'cron' | 'manual' }) {
  "use workflow"

  let campaignId: string

  // STEP 1: Setup - Create campaign and assign posts
  campaignId = await setupCampaign()

  // STEP 2-3: Generate primary articles in 2 batches (3 articles each)
  await generatePrimaryArticlesBatch1(campaignId)
  await generatePrimaryArticlesBatch2(campaignId)

  // STEP 4: Generate primary titles (placeholder for now)
  await generatePrimaryTitles(campaignId)

  // STEP 5-6: Generate secondary articles in 2 batches
  await generateSecondaryArticlesBatch1(campaignId)
  await generateSecondaryArticlesBatch2(campaignId)

  // STEP 7: Generate secondary titles (placeholder for now)
  await generateSecondaryTitles(campaignId)

  // STEP 8: Finalize
  await finalizeCampaign(campaignId)

  console.log('=== WORKFLOW COMPLETE ===')

  return { campaignId, success: true }
}

// Step functions
async function setupCampaign() {
  "use step"

  console.log('[Workflow Step 1/8] Setting up campaign...')

  const processor = new RSSProcessor()

  // Calculate campaign date (Central Time + 12 hours)
  const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
  const centralDate = new Date(nowCentral)
  centralDate.setHours(centralDate.getHours() + 12)
  const campaignDate = centralDate.toISOString().split('T')[0]

  // Create new campaign
  const { data: newCampaign, error: createError } = await supabaseAdmin
    .from('newsletter_campaigns')
    .insert([{ date: campaignDate, status: 'processing' }])
    .select('id')
    .single()

  if (createError || !newCampaign) {
    throw new Error('Failed to create campaign')
  }

  const id = newCampaign.id
  console.log(`[Workflow Step 1/8] Campaign created: ${id} for ${campaignDate}`)

  // Select AI apps and prompts
  try {
    const { AppSelector } = await import('@/lib/app-selector')
    const { PromptSelector } = await import('@/lib/prompt-selector')
    const { data: newsletter } = await supabaseAdmin
      .from('newsletters')
      .select('id, name, slug')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (newsletter) {
      await AppSelector.selectAppsForCampaign(id, newsletter.id)
      await PromptSelector.selectPromptForCampaign(id)
    }
  } catch (error) {
    console.log('[Workflow Step 1/8] AI selection failed (non-critical)')
  }

  // Assign top 12 posts per section
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
    .eq('key', 'primary_article_lookback_hours')
    .single()

  const lookbackHours = lookbackSetting ? parseInt(lookbackSetting.value) : 72
  const lookbackDate = new Date()
  lookbackDate.setHours(lookbackDate.getHours() - lookbackHours)
  const lookbackTimestamp = lookbackDate.toISOString()

  // Get and assign top primary posts
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

  // Get and assign top secondary posts
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
      .update({ campaign_id: id })
      .in('id', topPrimary.map(p => p.id))
  }

  if (topSecondary.length > 0) {
    await supabaseAdmin
      .from('rss_posts')
      .update({ campaign_id: id })
      .in('id', topSecondary.map(p => p.id))
  }

  console.log(`[Workflow Step 1/8] Assigned ${topPrimary.length} primary, ${topSecondary.length} secondary posts`)

  // Deduplicate
  await processor.handleDuplicatesForCampaign(id)
  console.log('[Workflow Step 1/8] ✓ Setup complete')

  return id
}

async function generatePrimaryArticlesBatch1(campaignId: string) {
  "use step"

  console.log('[Workflow Step 2/8] Generating 3 primary articles (batch 1)...')
  const processor = new RSSProcessor()
  await processor.generateArticlesForSection(campaignId, 'primary', 3)

  const { data: articles } = await supabaseAdmin
    .from('articles')
    .select('id')
    .eq('campaign_id', campaignId)

  console.log(`[Workflow Step 2/8] ✓ Generated ${articles?.length || 0} primary articles so far`)
}

async function generatePrimaryArticlesBatch2(campaignId: string) {
  "use step"

  console.log('[Workflow Step 3/8] Generating 3 more primary articles (batch 2)...')
  const processor = new RSSProcessor()
  await processor.generateArticlesForSection(campaignId, 'primary', 6)

  const { data: articles } = await supabaseAdmin
    .from('articles')
    .select('id')
    .eq('campaign_id', campaignId)

  console.log(`[Workflow Step 3/8] ✓ Total primary articles: ${articles?.length || 0}`)
}

async function generatePrimaryTitles(campaignId: string) {
  "use step"

  console.log('[Workflow Step 4/8] Checking primary article titles...')
  const processor = new RSSProcessor()
  await processor.generateTitlesForArticles(campaignId, 'primary')
  console.log('[Workflow Step 4/8] ✓ Primary titles complete')
}

async function generateSecondaryArticlesBatch1(campaignId: string) {
  "use step"

  console.log('[Workflow Step 5/8] Generating 3 secondary articles (batch 1)...')
  const processor = new RSSProcessor()
  await processor.generateArticlesForSection(campaignId, 'secondary', 3)

  const { data: articles } = await supabaseAdmin
    .from('secondary_articles')
    .select('id')
    .eq('campaign_id', campaignId)

  console.log(`[Workflow Step 5/8] ✓ Generated ${articles?.length || 0} secondary articles so far`)
}

async function generateSecondaryArticlesBatch2(campaignId: string) {
  "use step"

  console.log('[Workflow Step 6/8] Generating 3 more secondary articles (batch 2)...')
  const processor = new RSSProcessor()
  await processor.generateArticlesForSection(campaignId, 'secondary', 6)

  const { data: articles } = await supabaseAdmin
    .from('secondary_articles')
    .select('id')
    .eq('campaign_id', campaignId)

  console.log(`[Workflow Step 6/8] ✓ Total secondary articles: ${articles?.length || 0}`)
}

async function generateSecondaryTitles(campaignId: string) {
  "use step"

  console.log('[Workflow Step 7/8] Checking secondary article titles...')
  const processor = new RSSProcessor()
  await processor.generateTitlesForArticles(campaignId, 'secondary')
  console.log('[Workflow Step 7/8] ✓ Secondary titles complete')
}

async function finalizeCampaign(campaignId: string) {
  "use step"

  console.log('[Workflow Step 8/8] Finalizing campaign...')
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

  console.log(`Selected ${activeArticles?.length || 0} primary, ${activeSecondary?.length || 0} secondary`)

  // Generate welcome section
  await processor.generateWelcomeSection(campaignId)

  // Subject line (generated in selectTopArticlesForCampaign)
  const { data: campaign } = await supabaseAdmin
    .from('newsletter_campaigns')
    .select('subject_line')
    .eq('id', campaignId)
    .single()

  console.log(`Subject line: "${campaign?.subject_line?.substring(0, 50) || 'Not found'}..."`)

  // Set status to draft
  await supabaseAdmin
    .from('newsletter_campaigns')
    .update({ status: 'draft' })
    .eq('id', campaignId)

  // Stage 1 unassignment
  const unassignResult = await processor.unassignUnusedPosts(campaignId)
  console.log(`[Workflow Step 8/8] ✓ Finalized. Unassigned ${unassignResult.unassigned} unused posts`)
}

// Route handler for workflow trigger
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processRSSWorkflow({ trigger: 'cron' })

    return NextResponse.json({
      success: true,
      campaignId: result.campaignId,
      message: 'Workflow completed',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Workflow] Failed:', error)
    return NextResponse.json({
      error: 'Workflow failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export const maxDuration = 800
