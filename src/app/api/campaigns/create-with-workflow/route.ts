import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { start } from 'workflow/api'
import { createIssueWorkflow } from '@/lib/workflows/create-issue-workflow'

/**
 * Create issue with Full Workflow
 *
 * Creates a issue for a specific date and triggers the full RSS workflow
 * Returns after issue is created so UI can redirect immediately
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
      const { AppSelector } = await import('@/lib/app-selector')
      const { PromptSelector } = await import('@/lib/prompt-selector')

      await AppSelector.selectAppsForissue(issueId, newsletterUuid)
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
          // Use AdScheduler.recordAdUsage which handles everything properly
          await AdScheduler.recordAdUsage(issueId, selectedAd.id, date, newsletterUuid)
          console.log('[Create issue] Advertisement recorded successfully')
        } catch (recordError) {
          console.error('[Create issue] Failed to record advertisement usage:', recordError)
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
      .from('publication_settings')
      .select('value')
      .eq('publication_id', newsletterUuid)
      .eq('key', 'primary_article_lookback_hours')
      .maybeSingle()

    const lookbackHours = lookbackSetting ? parseInt(lookbackSetting.value) : 72
    const lookbackDate = new Date()
    lookbackDate.setHours(lookbackDate.getHours() - lookbackHours)
    const lookbackTimestamp = lookbackDate.toISOString()

    // Get and assign top primary posts
    const { data: allPrimaryPosts } = await supabaseAdmin
      .from('rss_posts')
      .select('id, post_ratings(total_score)')
      .in('feed_id', primaryFeedIds)
      .is('issue_id', null)
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
      .is('issue_id', null)
      .gte('processed_at', lookbackTimestamp)
      .not('post_ratings', 'is', null)

    const topSecondary = allSecondaryPosts
      ?.sort((a: any, b: any) => {
        const scoreA = a.post_ratings?.[0]?.total_score || 0
        const scoreB = b.post_ratings?.[0]?.total_score || 0
        return scoreB - scoreA
      })
      .slice(0, 12) || []

    // Assign to issue
    if (topPrimary.length > 0) {
      await supabaseAdmin
        .from('rss_posts')
        .update({ issue_id: issueId })
        .in('id', topPrimary.map(p => p.id))
    }

    if (topSecondary.length > 0) {
      await supabaseAdmin
        .from('rss_posts')
        .update({ issue_id: issueId })
        .in('id', topSecondary.map(p => p.id))
    }

    console.log(`[Create issue] Assigned ${topPrimary.length} primary, ${topSecondary.length} secondary posts`)

    // Step 6: Start the article generation workflow (deduplication now happens in workflow Step 2)
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

  } catch (error) {
    console.error('[Create issue] Failed:', error)
    return NextResponse.json({
      error: 'Failed to create issue',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export const maxDuration = 60
