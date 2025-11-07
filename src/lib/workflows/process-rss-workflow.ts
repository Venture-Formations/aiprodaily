import { supabaseAdmin } from '@/lib/supabase'
import { RSSProcessor } from '@/lib/rss-processor'

/**
 * RSS Processing Workflow (REFACTORED)
 * Each step gets its own 800-second timeout
 *
 * NEW STRUCTURE:
 * Step 1:  Setup + Deduplication
 * Step 2:  Generate 6 primary titles (fast)
 * Step 3:  Generate 3 primary bodies (batch 1)
 * Step 4:  Generate 3 primary bodies (batch 2)
 * Step 5:  Fact-check all 6 primary articles
 * Step 6:  Generate 6 secondary titles (fast)
 * Step 7:  Generate 3 secondary bodies (batch 1)
 * Step 8:  Generate 3 secondary bodies (batch 2)
 * Step 9:  Fact-check all 6 secondary articles
 * Step 10: Finalize
 */
export async function processRSSWorkflow(input: {
  trigger: 'cron' | 'manual'
  newsletter_id: string
}) {
  "use workflow"

  let campaignId: string | undefined

  try {
    console.log(`[Workflow] Starting for newsletter: ${input.newsletter_id}`)

    // STEP 1: Setup - Create campaign, assign posts, deduplicate
    const createdCampaignId = await setupCampaign(input.newsletter_id)
    campaignId = createdCampaignId

    // PRIMARY SECTION
    // STEP 2: Generate all 6 primary titles (fast, batched)
    await generatePrimaryTitles(createdCampaignId)

    // STEP 3-4: Generate primary bodies in 2 batches (3 articles each)
    await generatePrimaryBodiesBatch1(createdCampaignId)
    await generatePrimaryBodiesBatch2(createdCampaignId)

    // STEP 5: Fact-check all primary articles
    await factCheckPrimary(createdCampaignId)

    // SECONDARY SECTION
    // STEP 6: Generate all 6 secondary titles (fast, batched)
    await generateSecondaryTitles(createdCampaignId)

    // STEP 7-8: Generate secondary bodies in 2 batches (3 articles each)
    await generateSecondaryBodiesBatch1(createdCampaignId)
    await generateSecondaryBodiesBatch2(createdCampaignId)

    // STEP 9: Fact-check all secondary articles
    await factCheckSecondary(createdCampaignId)

    // STEP 10: Finalize
    await finalizeCampaign(createdCampaignId)

    console.log('=== WORKFLOW COMPLETE ===')

    return { campaignId, success: true }

  } catch (error) {
    console.error('[Workflow] FATAL ERROR after retries:', error)

    // Send Slack notification for workflow failure
    try {
      const { SlackNotificationService } = await import('@/lib/slack')
      const slack = new SlackNotificationService()

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : undefined

      await slack.sendAlert(
        `🚨 RSS Workflow Failed After Retries\n\n` +
        `Campaign ID: ${campaignId || 'unknown'}\n` +
        `Newsletter ID: ${input.newsletter_id}\n` +
        `Trigger: ${input.trigger}\n` +
        `Error: ${errorMessage}\n\n` +
        `${errorStack ? `Stack: ${errorStack.substring(0, 500)}` : ''}`,
        'error',
        'workflow_failure'
      )
    } catch (slackError) {
      console.error('[Workflow] Failed to send Slack notification:', slackError)
    }

    // Mark campaign as failed
    if (campaignId) {
      try {
        await supabaseAdmin
          .from('newsletter_campaigns')
          .update({
            status: 'failed',
            workflow_error: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', campaignId)
      } catch (updateError) {
        console.error('[Workflow] Failed to update campaign status:', updateError)
      }
    }

    throw error // Re-throw so Vercel Workflow Engine marks it as failed
  }
}

// Step functions with retry logic
async function setupCampaign(newsletterId: string) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      console.log('[Workflow Step 1/10] Setting up campaign...')

      const processor = new RSSProcessor()

      // Get the newsletter
      const { data: newsletter, error: newsletterError } = await supabaseAdmin
        .from('newsletters')
        .select('id, name, slug')
        .eq('id', newsletterId)
        .single()

      if (newsletterError || !newsletter) {
        throw new Error(`Newsletter not found: ${newsletterId}`)
      }

      console.log(`[Workflow Step 1/10] Using newsletter: ${newsletter.name} (${newsletter.id})`)

      // Calculate campaign date (Central Time + 12 hours)
      const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
      const centralDate = new Date(nowCentral)
      centralDate.setHours(centralDate.getHours() + 12)
      const campaignDate = centralDate.toISOString().split('T')[0]

      // Create new campaign with newsletter_id
      const { data: newCampaign, error: createError } = await supabaseAdmin
        .from('newsletter_campaigns')
        .insert([{
          date: campaignDate,
          status: 'processing',
          newsletter_id: newsletter.id
        }])
        .select('id')
        .single()

      if (createError || !newCampaign) {
        throw new Error('Failed to create campaign')
      }

      const id = newCampaign.id
      console.log(`[Workflow Step 1/10] Campaign created: ${id} for ${campaignDate}`)

      // Select AI apps and prompts
      try {
        const { AppSelector } = await import('@/lib/app-selector')
        const { PromptSelector } = await import('@/lib/prompt-selector')

        await AppSelector.selectAppsForCampaign(id, newsletter.id)
        await PromptSelector.selectPromptForCampaign(id)
      } catch (error) {
        console.log('[Workflow Step 1/10] AI selection failed (non-critical)')
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
        .eq('newsletter_id', newsletterId)
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

      console.log(`[Workflow Step 1/10] Assigned ${topPrimary.length} primary, ${topSecondary.length} secondary posts`)

      // Deduplicate
      const dedupeResult = await processor.handleDuplicatesForCampaign(id)
      console.log(`[Workflow Step 1/10] Deduplication: ${dedupeResult.groups} groups, ${dedupeResult.duplicates} duplicate posts found`)
      console.log('[Workflow Step 1/10] ✓ Setup complete')

      return id

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step 1/10] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step 1/10] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  throw new Error('Unexpected: Retry loop exited without return')
}

// PRIMARY SECTION
async function generatePrimaryTitles(campaignId: string) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      console.log('[Workflow Step 2/10] Generating 6 primary titles...')
      const processor = new RSSProcessor()
      await processor.generateTitlesOnly(campaignId, 'primary', 6)

      const { data: articles } = await supabaseAdmin
        .from('articles')
        .select('id, headline')
        .eq('campaign_id', campaignId)
        .not('headline', 'is', null)

      console.log(`[Workflow Step 2/10] ✓ Generated ${articles?.length || 0} primary titles`)
      return

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step 2/10] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step 2/10] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

async function generatePrimaryBodiesBatch1(campaignId: string) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      console.log('[Workflow Step 3/10] Generating 3 primary bodies (batch 1)...')
      const processor = new RSSProcessor()
      await processor.generateBodiesOnly(campaignId, 'primary', 0, 3)

      const { data: articles } = await supabaseAdmin
        .from('articles')
        .select('id, content')
        .eq('campaign_id', campaignId)
        .not('content', 'is', null)

      console.log(`[Workflow Step 3/10] ✓ Total bodies generated: ${articles?.length || 0}`)
      return

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step 3/10] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step 3/10] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

async function generatePrimaryBodiesBatch2(campaignId: string) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      console.log('[Workflow Step 4/10] Generating 3 more primary bodies (batch 2)...')
      const processor = new RSSProcessor()
      await processor.generateBodiesOnly(campaignId, 'primary', 3, 3)

      const { data: articles } = await supabaseAdmin
        .from('articles')
        .select('id, content')
        .eq('campaign_id', campaignId)
        .not('content', 'is', null)

      console.log(`[Workflow Step 4/10] ✓ Total primary bodies: ${articles?.length || 0}`)
      return

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step 4/10] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step 4/10] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

async function factCheckPrimary(campaignId: string) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
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
      return

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step 5/10] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step 5/10] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

// SECONDARY SECTION
async function generateSecondaryTitles(campaignId: string) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      console.log('[Workflow Step 6/10] Generating 6 secondary titles...')
      const processor = new RSSProcessor()
      await processor.generateTitlesOnly(campaignId, 'secondary', 6)

      const { data: articles } = await supabaseAdmin
        .from('secondary_articles')
        .select('id, headline')
        .eq('campaign_id', campaignId)
        .not('headline', 'is', null)

      console.log(`[Workflow Step 6/10] ✓ Generated ${articles?.length || 0} secondary titles`)
      return

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step 6/10] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step 6/10] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

async function generateSecondaryBodiesBatch1(campaignId: string) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      console.log('[Workflow Step 7/10] Generating 3 secondary bodies (batch 1)...')
      const processor = new RSSProcessor()
      await processor.generateBodiesOnly(campaignId, 'secondary', 0, 3)

      const { data: articles } = await supabaseAdmin
        .from('secondary_articles')
        .select('id, content')
        .eq('campaign_id', campaignId)
        .not('content', 'is', null)

      console.log(`[Workflow Step 7/10] ✓ Total bodies generated: ${articles?.length || 0}`)
      return

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step 7/10] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step 7/10] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

async function generateSecondaryBodiesBatch2(campaignId: string) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      console.log('[Workflow Step 8/10] Generating 3 more secondary bodies (batch 2)...')
      const processor = new RSSProcessor()
      await processor.generateBodiesOnly(campaignId, 'secondary', 3, 3)

      const { data: articles } = await supabaseAdmin
        .from('secondary_articles')
        .select('id, content')
        .eq('campaign_id', campaignId)
        .not('content', 'is', null)

      console.log(`[Workflow Step 8/10] ✓ Total secondary bodies: ${articles?.length || 0}`)
      return

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step 8/10] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step 8/10] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

async function factCheckSecondary(campaignId: string) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
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
      return

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step 9/10] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step 9/10] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

// FINALIZE
async function finalizeCampaign(campaignId: string) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
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
      console.log(`[Workflow Step 10/10] ✓ Finalized. Unassigned ${unassignResult.unassigned} unused posts`)
      return

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step 10/10] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step 10/10] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}
