import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withApiHandler } from '@/lib/api-handler'
import { start } from 'workflow/api'
import { createIssueWorkflow } from '@/lib/workflows/create-issue-workflow'

/**
 * Create issue with Full Workflow (ARTICLE MODULES VERSION)
 *
 * Creates a issue for a specific date and triggers the full RSS workflow
 * Returns after issue is created so UI can redirect immediately
 */
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'campaigns/create-with-workflow' },
  async ({ request }) => {
    const body = await request.json()
    const { date, publication_id } = body

    if (!date || !publication_id) {
      return NextResponse.json({
        error: 'date and publication_id are required'
      }, { status: 400 })
    }

    console.log(`[Create issue] Creating issue for ${date}`)

    // Step 1: Look up newsletter UUID from slug
    const { data: newsletter, error: newsletterError } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('slug', publication_id)
      .single()

    if (newsletterError || !newsletter) {
      console.error('[Create issue] Newsletter not found:', publication_id)
      return NextResponse.json({
        error: 'Newsletter not found',
        details: `No newsletter found with slug: ${publication_id}`
      }, { status: 404 })
    }

    const newsletterUuid = newsletter.id
    console.log(`[Create issue] Newsletter UUID: ${newsletterUuid}`)

    // Step 2: Create the issue
    const { data: newissue, error: createError } = await supabaseAdmin
      .from('publication_issues')
      .insert([{
        date: date,
        status: 'processing',
        publication_id: newsletterUuid
      }])
      .select('id')
      .single()

    if (createError || !newissue) {
      console.error('[Create issue] Failed to create issue:', createError)
      return NextResponse.json({
        error: 'Failed to create issue',
        details: createError?.message
      }, { status: 500 })
    }

    const issueId = newissue.id
    console.log(`[Create issue] Created issue: ${issueId}`)

    // Step 3: Select AI apps and prompts (like setupissue does)
    try {
      const { AppModuleSelector } = await import('@/lib/ai-app-modules')
      const { PromptSelector } = await import('@/lib/prompt-selector')

      await AppModuleSelector.selectAppsForIssue(issueId, newsletterUuid, new Date())
      await PromptSelector.selectPromptForissue(issueId)
      console.log('[Create issue] Selected AI apps and prompts')
    } catch (error) {
      console.log('[Create issue] AI selection failed (non-critical):', error)
    }

    // Step 4: Select advertisement
    try {
      const { AdScheduler } = await import('@/lib/ad-scheduler')
      const selectedAd = await AdScheduler.selectAdForissue({
        issueId: issueId,
        issueDate: date,
        newsletterId: newsletterUuid
      })

      if (selectedAd) {
        console.log(`[Create issue] Selected ad: ${selectedAd.title} (ID: ${selectedAd.id})`)

        try {
          // Assign ad to issue (usage will be recorded at send-final)
          await AdScheduler.assignAdToIssue(issueId, selectedAd.id, date)
          console.log('[Create issue] Advertisement assigned (usage will be recorded at send-final)')
        } catch (recordError) {
          console.error('[Create issue] Failed to assign advertisement:', recordError)
          // Log full error details
          console.error('[Create issue] Error details:', JSON.stringify(recordError, null, 2))
        }
      } else {
        console.log('[Create issue] No advertisement available')
      }
    } catch (error) {
      console.error('[Create issue] Ad selection failed:', error)
      // Non-critical - issue can proceed without ad
    }

    // Step 5: Initialize article mod selections and assign posts
    const { ArticleModuleSelector } = await import('@/lib/article-modules')

    // Get active article modules for this publication
    const activeModules = await ArticleModuleSelector.getActiveModules(newsletterUuid)
    console.log(`[Create issue] Found ${activeModules.length} active article modules`)

    // Initialize issue_article_modules entries
    await ArticleModuleSelector.initializeSelectionsForIssue(issueId, newsletterUuid)

    // Get lookback window from first mod (or default)
    const defaultLookbackHours = activeModules[0]?.lookback_hours || 72
    const lookbackDate = new Date()
    lookbackDate.setHours(lookbackDate.getHours() - defaultLookbackHours)
    const lookbackTimestamp = lookbackDate.toISOString()

    // For each mod, get feeds and assign top posts
    let totalAssigned = 0
    for (const mod of activeModules) {
      const lookbackHours = mod.lookback_hours || 72
      const moduleLookbackDate = new Date()
      moduleLookbackDate.setHours(moduleLookbackDate.getHours() - lookbackHours)
      const moduleLookbackTimestamp = moduleLookbackDate.toISOString()

      // Get feeds assigned to this mod
      const { data: moduleFeeds } = await supabaseAdmin
        .from('rss_feeds')
        .select('id')
        .eq('active', true)
        .eq('article_module_id', mod.id)

      const feedIds = moduleFeeds?.map(f => f.id) || []

      if (feedIds.length === 0) {
        console.log(`[Create issue] Module "${mod.name}": No feeds assigned`)
        continue
      }

      // Get top posts for this mod by score
      const { data: modulePosts } = await supabaseAdmin
        .from('rss_posts')
        .select('id, post_ratings(total_score)')
        .in('feed_id', feedIds)
        .is('issue_id', null)
        .gte('processed_at', moduleLookbackTimestamp)
        .not('post_ratings', 'is', null)

      // Sort by score and take top 12
      const topPosts = modulePosts
        ?.sort((a: any, b: any) => {
          const scoreA = a.post_ratings?.[0]?.total_score || 0
          const scoreB = b.post_ratings?.[0]?.total_score || 0
          return scoreB - scoreA
        })
        .slice(0, 12) || []

      // Assign posts to issue with article_module_id
      if (topPosts.length > 0) {
        await supabaseAdmin
          .from('rss_posts')
          .update({
            issue_id: issueId,
            article_module_id: mod.id
          })
          .in('id', topPosts.map(p => p.id))

        totalAssigned += topPosts.length
        console.log(`[Create issue] Module "${mod.name}": Assigned ${topPosts.length} posts`)
      } else {
        console.log(`[Create issue] Module "${mod.name}": No eligible posts found`)
      }
    }

    console.log(`[Create issue] Total posts assigned: ${totalAssigned}`)

    // Step 6: Start the article generation workflow
    console.log('[Create issue] Starting article generation workflow...')
    try {
      await start(createIssueWorkflow, [{
        issue_id: issueId,
        publication_id: newsletterUuid
      }])
      console.log('[Create issue] Workflow started successfully')
    } catch (error) {
      console.error('[Create issue] Failed to start workflow:', error)

      // CRITICAL ERROR: Alert about workflow failure
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : ''

      console.error('[CRITICAL] Workflow Start Failure:', {
        issue_id: issueId,
        error: errorMessage,
        stack: errorStack,
        timestamp: new Date().toISOString(),
        deployment_url: process.env.VERCEL_URL || 'unknown'
      })

      // Send Slack notification if webhook is configured
      if (process.env.SLACK_WEBHOOK_URL) {
        try {
          await fetch(process.env.SLACK_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `🚨 CRITICAL: Workflow Start Failure`,
              blocks: [
                {
                  type: 'header',
                  text: {
                    type: 'plain_text',
                    text: '🚨 Workflow Start Failure'
                  }
                },
                {
                  type: 'section',
                  fields: [
                    {
                      type: 'mrkdwn',
                      text: `*Issue ID:*\n${issueId}`
                    },
                    {
                      type: 'mrkdwn',
                      text: `*Error:*\n${errorMessage}`
                    },
                    {
                      type: 'mrkdwn',
                      text: `*Time:*\n${new Date().toISOString()}`
                    },
                    {
                      type: 'mrkdwn',
                      text: `*Deployment:*\n${process.env.VERCEL_URL || 'unknown'}`
                    }
                  ]
                },
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `*Action Required:*\nManually trigger workflow or use reprocess endpoint`
                  }
                }
              ]
            })
          })
        } catch (slackError) {
          console.error('[Create issue] Failed to send Slack notification:', slackError)
        }
      }

      // Don't fail the whole request - workflow will be retried or run manually
    }

    console.log('[Create issue] Setup complete, workflow started in background')

    return NextResponse.json({
      success: true,
      issue_id: issueId,
      message: 'issue created and workflow started'
    })
  }
)

export const maxDuration = 60
