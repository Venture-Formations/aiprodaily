import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { start } from 'workflow/api'
import { createCampaignWorkflow } from '@/lib/workflows/create-campaign-workflow'

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

    // Step 1: Look up newsletter UUID from slug
    const { data: newsletter, error: newsletterError } = await supabaseAdmin
      .from('newsletters')
      .select('id')
      .eq('slug', newsletter_id)
      .single()

    if (newsletterError || !newsletter) {
      console.error('[Create Campaign] Newsletter not found:', newsletter_id)
      return NextResponse.json({
        error: 'Newsletter not found',
        details: `No newsletter found with slug: ${newsletter_id}`
      }, { status: 404 })
    }

    const newsletterUuid = newsletter.id
    console.log(`[Create Campaign] Newsletter UUID: ${newsletterUuid}`)

    // Step 2: Create the campaign
    const { data: newCampaign, error: createError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .insert([{
        date: date,
        status: 'processing',
        newsletter_id: newsletterUuid
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

    // Step 3: Select AI apps and prompts (like setupCampaign does)
    try {
      const { AppSelector } = await import('@/lib/app-selector')
      const { PromptSelector } = await import('@/lib/prompt-selector')

      await AppSelector.selectAppsForCampaign(campaignId, newsletterUuid)
      await PromptSelector.selectPromptForCampaign(campaignId)
      console.log('[Create Campaign] Selected AI apps and prompts')
    } catch (error) {
      console.log('[Create Campaign] AI selection failed (non-critical):', error)
    }

    // Step 4: Select advertisement
    try {
      const { AdScheduler } = await import('@/lib/ad-scheduler')
      const selectedAd = await AdScheduler.selectAdForCampaign({
        campaignId: campaignId,
        campaignDate: date,
        newsletterId: newsletterUuid
      })

      if (selectedAd) {
        console.log(`[Create Campaign] Selected ad: ${selectedAd.title} (ID: ${selectedAd.id})`)

        try {
          // Use AdScheduler.recordAdUsage which handles everything properly
          await AdScheduler.recordAdUsage(campaignId, selectedAd.id, date, newsletterUuid)
          console.log('[Create Campaign] Advertisement recorded successfully')
        } catch (recordError) {
          console.error('[Create Campaign] Failed to record advertisement usage:', recordError)
          // Log full error details
          console.error('[Create Campaign] Error details:', JSON.stringify(recordError, null, 2))
        }
      } else {
        console.log('[Create Campaign] No advertisement available')
      }
    } catch (error) {
      console.error('[Create Campaign] Ad selection failed:', error)
      // Non-critical - campaign can proceed without ad
    }

    // Step 5: Assign top 12 posts per section (using dynamic import)
    const { RSSProcessor } = await import('@/lib/rss-processor')
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
      .eq('newsletter_id', newsletterUuid)
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

    // Step 6: Deduplicate
    const dedupeResult = await processor.handleDuplicatesForCampaign(campaignId)
    console.log(`[Create Campaign] Deduplication: ${dedupeResult.groups} groups, ${dedupeResult.duplicates} duplicates`)

    // Step 7: Start the article generation workflow
    console.log('[Create Campaign] Starting article generation workflow...')
    try {
      await start(createCampaignWorkflow, [{
        campaign_id: campaignId,
        newsletter_id: newsletterUuid
      }])
      console.log('[Create Campaign] Workflow started successfully')
    } catch (error) {
      console.error('[Create Campaign] Failed to start workflow:', error)
      // Don't fail the whole request - workflow will be retried or run manually
    }

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
