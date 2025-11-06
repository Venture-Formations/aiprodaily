import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { RSSProcessor } from '@/lib/rss-processor'
import { start } from 'workflow/api'

/**
 * Create Campaign with Full Workflow
 *
 * Creates a campaign for a specific date and triggers the full RSS workflow
 * Returns after campaign is created so UI can redirect immediately
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { date, newsletter_id } = body

    if (!date || !newsletter_id) {
      return NextResponse.json({
        error: 'date and newsletter_id are required'
      }, { status: 400 })
    }

    console.log(`[Create Campaign] Creating campaign for ${date}`)

    // Step 1: Create the campaign
    const { data: newCampaign, error: createError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .insert([{
        date: date,
        status: 'processing',
        newsletter_id: newsletter_id
      }])
      .select('id')
      .single()

    if (createError || !newCampaign) {
      console.error('[Create Campaign] Failed to create campaign:', createError)
      return NextResponse.json({
        error: 'Failed to create campaign',
        details: createError?.message
      }, { status: 500 })
    }

    const campaignId = newCampaign.id
    console.log(`[Create Campaign] Created campaign: ${campaignId}`)

    // Step 2: Select AI apps and prompts (like setupCampaign does)
    try {
      const { AppSelector } = await import('@/lib/app-selector')
      const { PromptSelector } = await import('@/lib/prompt-selector')

      await AppSelector.selectAppsForCampaign(campaignId, newsletter_id)
      await PromptSelector.selectPromptForCampaign(campaignId)
      console.log('[Create Campaign] Selected AI apps and prompts')
    } catch (error) {
      console.log('[Create Campaign] AI selection failed (non-critical):', error)
    }

    // Step 3: Select advertisement
    try {
      const { AdScheduler } = await import('@/lib/ad-scheduler')
      const selectedAd = await AdScheduler.selectAdForCampaign({
        campaignId: campaignId,
        campaignDate: date
      })

      if (selectedAd) {
        await supabaseAdmin
          .from('campaign_advertisements')
          .insert({
            campaign_id: campaignId,
            advertisement_id: selectedAd.id,
            campaign_date: date,
            used_at: new Date().toISOString()
          })
        console.log('[Create Campaign] Selected advertisement')
      }
    } catch (error) {
      console.log('[Create Campaign] Ad selection failed (non-critical):', error)
    }

    // Step 4: Assign top 12 posts per section
    const processor = new RSSProcessor()

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
      .eq('newsletter_id', newsletter_id)
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
        .update({ campaign_id: campaignId })
        .in('id', topPrimary.map(p => p.id))
    }

    if (topSecondary.length > 0) {
      await supabaseAdmin
        .from('rss_posts')
        .update({ campaign_id: campaignId })
        .in('id', topSecondary.map(p => p.id))
    }

    console.log(`[Create Campaign] Assigned ${topPrimary.length} primary, ${topSecondary.length} secondary posts`)

    // Step 5: Deduplicate
    const dedupeResult = await processor.handleDuplicatesForCampaign(campaignId)
    console.log(`[Create Campaign] Deduplication: ${dedupeResult.groups} groups, ${dedupeResult.duplicates} duplicates`)

    // Step 6: Start the article generation workflow in background
    // We'll use a modified workflow that continues from article generation
    start(continueWorkflowFromArticleGeneration, [{
      campaign_id: campaignId,
      newsletter_id: newsletter_id
    }]).catch(error => {
      console.error('[Create Campaign] Failed to start workflow:', error)
    })

    console.log('[Create Campaign] Setup complete, workflow started in background')

    return NextResponse.json({
      success: true,
      campaign_id: campaignId,
      message: 'Campaign created and workflow started'
    })

  } catch (error) {
    console.error('[Create Campaign] Failed:', error)
    return NextResponse.json({
      error: 'Failed to create campaign',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export const maxDuration = 60

/**
 * Workflow continuation - runs article generation steps only
 */
async function continueWorkflowFromArticleGeneration(input: {
  campaign_id: string
  newsletter_id: string
}) {
  "use workflow"

  const { campaign_id } = input

  console.log(`[Continue Workflow] Starting for campaign: ${campaign_id}`)

  // PRIMARY SECTION
  await generatePrimaryTitles(campaign_id)
  await generatePrimaryBodiesBatch1(campaign_id)
  await generatePrimaryBodiesBatch2(campaign_id)
  await factCheckPrimary(campaign_id)

  // SECONDARY SECTION
  await generateSecondaryTitles(campaign_id)
  await generateSecondaryBodiesBatch1(campaign_id)
  await generateSecondaryBodiesBatch2(campaign_id)
  await factCheckSecondary(campaign_id)

  // FINALIZE
  await finalizeCampaign(campaign_id)

  console.log('[Continue Workflow] ✓ Complete')

  return { campaign_id, success: true }
}

// Step functions (matching process-rss-workflow.ts)
async function generatePrimaryTitles(campaignId: string) {
  "use step"

  console.log('[Workflow Step 2/10] Generating 6 primary titles...')
  const processor = new RSSProcessor()
  await processor.generateTitlesOnly(campaignId, 'primary', 6)

  const { data: articles } = await supabaseAdmin
    .from('articles')
    .select('id, headline')
    .eq('campaign_id', campaignId)
    .not('headline', 'is', null)

  console.log(`[Workflow Step 2/10] ✓ Generated ${articles?.length || 0} primary titles`)
}

async function generatePrimaryBodiesBatch1(campaignId: string) {
  "use step"

  console.log('[Workflow Step 3/10] Generating 3 primary bodies (batch 1)...')
  const processor = new RSSProcessor()
  await processor.generateBodiesOnly(campaignId, 'primary', 0, 3)

  const { data: articles } = await supabaseAdmin
    .from('articles')
    .select('id, content')
    .eq('campaign_id', campaignId)
    .not('content', 'is', null)

  console.log(`[Workflow Step 3/10] ✓ Total bodies generated: ${articles?.length || 0}`)
}

async function generatePrimaryBodiesBatch2(campaignId: string) {
  "use step"

  console.log('[Workflow Step 4/10] Generating 3 more primary bodies (batch 2)...')
  const processor = new RSSProcessor()
  await processor.generateBodiesOnly(campaignId, 'primary', 3, 3)

  const { data: articles } = await supabaseAdmin
    .from('articles')
    .select('id, content')
    .eq('campaign_id', campaignId)
    .not('content', 'is', null)

  console.log(`[Workflow Step 4/10] ✓ Total primary bodies: ${articles?.length || 0}`)
}

async function factCheckPrimary(campaignId: string) {
  "use step"

  console.log('[Workflow Step 5/10] Fact-checking all primary articles...')
  const processor = new RSSProcessor()
  await processor.factCheckArticles(campaignId, 'primary')

  const { data: articles } = await supabaseAdmin
    .from('articles')
    .select('id, fact_check_score')
    .eq('campaign_id', campaignId)
    .not('fact_check_score', 'is', null)

  const avgScore = (articles?.reduce((sum, a) => sum + (a.fact_check_score || 0), 0) || 0) / (articles?.length || 1)
  console.log(`[Workflow Step 5/10] ✓ Fact-checked ${articles?.length || 0} articles (avg score: ${avgScore.toFixed(1)}/10)`)
}

async function generateSecondaryTitles(campaignId: string) {
  "use step"

  console.log('[Workflow Step 6/10] Generating 6 secondary titles...')
  const processor = new RSSProcessor()
  await processor.generateTitlesOnly(campaignId, 'secondary', 6)

  const { data: articles } = await supabaseAdmin
    .from('secondary_articles')
    .select('id, headline')
    .eq('campaign_id', campaignId)
    .not('headline', 'is', null)

  console.log(`[Workflow Step 6/10] ✓ Generated ${articles?.length || 0} secondary titles`)
}

async function generateSecondaryBodiesBatch1(campaignId: string) {
  "use step"

  console.log('[Workflow Step 7/10] Generating 3 secondary bodies (batch 1)...')
  const processor = new RSSProcessor()
  await processor.generateBodiesOnly(campaignId, 'secondary', 0, 3)

  const { data: articles } = await supabaseAdmin
    .from('secondary_articles')
    .select('id, content')
    .eq('campaign_id', campaignId)
    .not('content', 'is', null)

  console.log(`[Workflow Step 7/10] ✓ Total bodies generated: ${articles?.length || 0}`)
}

async function generateSecondaryBodiesBatch2(campaignId: string) {
  "use step"

  console.log('[Workflow Step 8/10] Generating 3 more secondary bodies (batch 2)...')
  const processor = new RSSProcessor()
  await processor.generateBodiesOnly(campaignId, 'secondary', 3, 3)

  const { data: articles } = await supabaseAdmin
    .from('secondary_articles')
    .select('id, content')
    .eq('campaign_id', campaignId)
    .not('content', 'is', null)

  console.log(`[Workflow Step 8/10] ✓ Total secondary bodies: ${articles?.length || 0}`)
}

async function factCheckSecondary(campaignId: string) {
  "use step"

  console.log('[Workflow Step 9/10] Fact-checking all secondary articles...')
  const processor = new RSSProcessor()
  await processor.factCheckArticles(campaignId, 'secondary')

  const { data: articles } = await supabaseAdmin
    .from('secondary_articles')
    .select('id, fact_check_score')
    .eq('campaign_id', campaignId)
    .not('fact_check_score', 'is', null)

  const avgScore = (articles?.reduce((sum, a) => sum + (a.fact_check_score || 0), 0) || 0) / (articles?.length || 1)
  console.log(`[Workflow Step 9/10] ✓ Fact-checked ${articles?.length || 0} articles (avg score: ${avgScore.toFixed(1)}/10)`)
}

async function finalizeCampaign(campaignId: string) {
  "use step"

  console.log('[Workflow Step 10/10] Finalizing campaign...')
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
    .eq('campaign_id', campaignId)
    .single()

  console.log(`Subject line: "${campaign?.subject_line?.substring(0, 50) || 'Not found'}..."`)

  // Set status to draft
  await supabaseAdmin
    .from('newsletter_campaigns')
    .update({ status: 'draft' })
    .eq('id', campaignId)

  // Stage 1 unassignment
  const unassignResult = await processor.unassignUnusedPosts(campaignId)
  console.log(`[Workflow Step 10/10] ✓ Finalized. Unassigned ${unassignResult.unassigned} unused posts`)
}
