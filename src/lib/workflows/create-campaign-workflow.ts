import { supabaseAdmin } from '@/lib/supabase'
import { RSSProcessor } from '@/lib/rss-processor'

/**
 * Create Campaign Workflow - Article Generation Steps
 * Runs after campaign setup (AI selection, post assignment, deduplication)
 *
 * Steps:
 * 1. Generate 6 primary titles
 * 2. Generate 3 primary bodies (batch 1)
 * 3. Generate 3 primary bodies (batch 2)
 * 4. Fact-check primary articles
 * 5. Generate 6 secondary titles
 * 6. Generate 3 secondary bodies (batch 1)
 * 7. Generate 3 secondary bodies (batch 2)
 * 8. Fact-check secondary articles
 * 9. Finalize (select top 3, generate welcome, set draft)
 */
export async function createCampaignWorkflow(input: {
  campaign_id: string
  newsletter_id: string
}) {
  "use workflow"

  const { campaign_id } = input

  try {
    console.log(`[Create Campaign Workflow] Starting for campaign: ${campaign_id}`)

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

    console.log('[Create Campaign Workflow] ✓ Complete')

    return { campaign_id, success: true }

  } catch (error) {
    console.error('[Create Campaign Workflow] FATAL ERROR after retries:', error)

    // Send Slack notification for workflow failure
    try {
      const { SlackNotificationService } = await import('@/lib/slack')
      const slack = new SlackNotificationService()

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : undefined

      await slack.sendAlert(
        `🚨 Manual Campaign Workflow Failed After Retries\n\n` +
        `Campaign ID: ${campaign_id}\n` +
        `Newsletter ID: ${input.newsletter_id}\n` +
        `Trigger: manual (create campaign button)\n` +
        `Error: ${errorMessage}\n\n` +
        `${errorStack ? `Stack: ${errorStack.substring(0, 500)}` : ''}`,
        'error',
        'workflow_failure'
      )
    } catch (slackError) {
      console.error('[Create Campaign Workflow] Failed to send Slack notification:', slackError)
    }

    // Mark campaign as failed
    try {
      await supabaseAdmin
        .from('newsletter_campaigns')
        .update({
          status: 'failed',
          workflow_error: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', campaign_id)
    } catch (updateError) {
      console.error('[Create Campaign Workflow] Failed to update campaign status:', updateError)
    }

    throw error // Re-throw so Vercel Workflow Engine marks it as failed
  }
}

// Step 1: Generate Primary Titles
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

// Step 2: Generate Primary Bodies Batch 1
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

// Step 3: Generate Primary Bodies Batch 2
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

// Step 4: Fact-check Primary Articles
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

// Step 5: Generate Secondary Titles
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

// Step 6: Generate Secondary Bodies Batch 1
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

// Step 7: Generate Secondary Bodies Batch 2
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

// Step 8: Fact-check Secondary Articles
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

// Step 9: Finalize Campaign
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
