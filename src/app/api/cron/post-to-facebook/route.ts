import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { FacebookService, withRetry } from '@/lib/facebook'
import { getFacebookSettings, updatePublicationSetting } from '@/lib/publication-settings'
import type { Logger } from '@/lib/logger'

/**
 * Get current time in Central Time zone
 */
function getCurrentTimeInCT(): { hours: number; minutes: number; timeString: string; dateString: string } {
  const now = new Date()
  const ctString = now.toLocaleString('en-US', { timeZone: 'America/Chicago' })
  const ctDate = new Date(ctString)

  const hours = ctDate.getHours()
  const minutes = ctDate.getMinutes()
  const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`

  // Get date string for comparison (YYYY-MM-DD)
  const year = ctDate.getFullYear()
  const month = (ctDate.getMonth() + 1).toString().padStart(2, '0')
  const day = ctDate.getDate().toString().padStart(2, '0')
  const dateString = `${year}-${month}-${day}`

  return { hours, minutes, timeString, dateString }
}

/**
 * Check if current time is within the posting window
 * Uses a 4-minute window to account for cron timing variations
 */
function isTimeToPost(currentTime: string, scheduledTime: string): boolean {
  const [currentHours, currentMinutes] = currentTime.split(':').map(Number)
  const [scheduledHours, scheduledMinutes] = scheduledTime.split(':').map(Number)

  const currentTotalMinutes = currentHours * 60 + currentMinutes
  const scheduledTotalMinutes = scheduledHours * 60 + scheduledMinutes

  // Within 4-minute window (0 to 4 minutes after scheduled time)
  const diff = currentTotalMinutes - scheduledTotalMinutes
  return diff >= 0 && diff < 5
}

async function handlePostToFacebook(logger: Logger) {
  console.log('[Facebook] Starting daily post check')

  const currentTime = getCurrentTimeInCT()
  console.log(`[Facebook] Current CT time: ${currentTime.timeString}, Date: ${currentTime.dateString}`)

  // Get all active publications
  const { data: publications, error: pubError } = await supabaseAdmin
    .from('publications')
    .select('id, name, slug')
    .eq('is_active', true)

  if (pubError || !publications) {
    console.error('[Facebook] Failed to fetch publications:', pubError)
    return NextResponse.json({ error: 'Failed to fetch publications' }, { status: 500 })
  }

  const results: Array<{
    publication: string
    status: string
    postId?: string
    error?: string
  }> = []

  // Process each publication
  for (const publication of publications) {
    console.log(`[Facebook] Checking publication: ${publication.name}`)

    try {
      // Get Facebook settings for this publication
      const fbSettings = await getFacebookSettings(publication.id)

      // Skip if Facebook posting is disabled
      if (!fbSettings.enabled) {
        console.log(`[Facebook] Posting disabled for ${publication.name}`)
        results.push({ publication: publication.name, status: 'disabled' })
        continue
      }

      // Skip if missing required settings
      if (!fbSettings.pageId || !fbSettings.pageAccessToken || !fbSettings.adModuleId) {
        console.log(`[Facebook] Missing required settings for ${publication.name}`)
        results.push({ publication: publication.name, status: 'missing_config' })
        continue
      }

      // Check if it's time to post
      if (!isTimeToPost(currentTime.timeString, fbSettings.postTime)) {
        console.log(`[Facebook] Not time to post for ${publication.name} (scheduled: ${fbSettings.postTime})`)
        results.push({ publication: publication.name, status: 'not_scheduled' })
        continue
      }

      // Check if already posted today
      if (fbSettings.lastPostDate === currentTime.dateString) {
        console.log(`[Facebook] Already posted today for ${publication.name}`)
        results.push({ publication: publication.name, status: 'already_posted' })
        continue
      }

      console.log(`[Facebook] Time to post for ${publication.name}!`)

      // Get today's issue for this publication
      const { data: todayIssue } = await supabaseAdmin
        .from('publication_issues')
        .select('id, date, status')
        .eq('publication_id', publication.id)
        .gte('date', currentTime.dateString)
        .lte('date', currentTime.dateString)
        .limit(1)
        .single()

      // Get the ad content from the selected module
      let adContent: {
        title: string
        body: string
        imageUrl: string | null
        buttonUrl: string | null
      } | null = null

      if (todayIssue) {
        // Try to get the ad selected for today's issue
        const { data: issueAd } = await supabaseAdmin
          .from('issue_module_ads')
          .select(`
            advertisement:advertisements(
              id, title, body, image_url, button_url
            )
          `)
          .eq('issue_id', todayIssue.id)
          .eq('ad_module_id', fbSettings.adModuleId)
          .limit(1)
          .single()

        if (issueAd?.advertisement) {
          const ad = issueAd.advertisement as any
          adContent = {
            title: ad.title,
            body: ad.body,
            imageUrl: ad.image_url,
            buttonUrl: ad.button_url,
          }
          console.log(`[Facebook] Found ad from today's issue: ${ad.title}`)
        }
      }

      // If no issue-specific ad, try the most recently sent issue's ad
      if (!adContent) {
        const { data: recentSentIssue } = await supabaseAdmin
          .from('publication_issues')
          .select('id, date')
          .eq('publication_id', publication.id)
          .eq('status', 'sent')
          .order('date', { ascending: false })
          .limit(1)
          .single()

        if (recentSentIssue) {
          const { data: recentIssueAd } = await supabaseAdmin
            .from('issue_module_ads')
            .select(`
              advertisement:advertisements(
                id, title, body, image_url, button_url
              )
            `)
            .eq('issue_id', recentSentIssue.id)
            .eq('ad_module_id', fbSettings.adModuleId)
            .limit(1)
            .single()

          if (recentIssueAd?.advertisement) {
            const ad = recentIssueAd.advertisement as any
            adContent = {
              title: ad.title,
              body: ad.body,
              imageUrl: ad.image_url,
              buttonUrl: ad.button_url,
            }
            console.log(`[Facebook] Using ad from recent issue ${recentSentIssue.date}: ${ad.title}`)
          }
        }
      }

      // Final fallback: latest active ad from the module
      if (!adContent) {
        const { data: latestAd } = await supabaseAdmin
          .from('advertisements')
          .select('id, title, body, image_url, button_url')
          .eq('ad_module_id', fbSettings.adModuleId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (latestAd) {
          adContent = {
            title: latestAd.title,
            body: latestAd.body,
            imageUrl: latestAd.image_url,
            buttonUrl: latestAd.button_url,
          }
          console.log(`[Facebook] Using latest active ad: ${latestAd.title}`)
        }
      }

      if (!adContent) {
        console.log(`[Facebook] No ad content found for ${publication.name}`)
        results.push({ publication: publication.name, status: 'no_ad_content' })
        continue
      }

      // Format the message
      const message = FacebookService.formatMessage(adContent.body, adContent.buttonUrl || undefined, adContent.title)

      // Create Facebook service and post
      const fb = new FacebookService(fbSettings.pageId, fbSettings.pageAccessToken)

      const postResult = await withRetry(async () => {
        return fb.createPagePost({
          message,
          imageUrl: adContent!.imageUrl || undefined,
          linkUrl: adContent!.buttonUrl || undefined,
        })
      })

      if (postResult.success) {
        console.log(`[Facebook] Post created for ${publication.name}: ${postResult.postId}`)

        // Update last post date and ID
        await updatePublicationSetting(publication.id, 'facebook_last_post_date', currentTime.dateString)
        await updatePublicationSetting(publication.id, 'facebook_last_post_id', postResult.postId || '')

        results.push({
          publication: publication.name,
          status: 'posted',
          postId: postResult.postId,
        })
      } else {
        console.error(`[Facebook] Failed to post for ${publication.name}:`, postResult.error)
        results.push({
          publication: publication.name,
          status: 'failed',
          error: postResult.error,
        })
      }
    } catch (error) {
      console.error(`[Facebook] Error processing ${publication.name}:`, error)
      results.push({
        publication: publication.name,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  // Summary
  const posted = results.filter((r) => r.status === 'posted').length
  const failed = results.filter((r) => r.status === 'failed' || r.status === 'error').length

  console.log(`[Facebook] Completed: ${posted} posted, ${failed} failed, ${results.length} total`)

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    currentTime: currentTime.timeString,
    results,
    summary: {
      total: results.length,
      posted,
      failed,
      skipped: results.length - posted - failed,
    },
  })
}

export const GET = withApiHandler(
  { authTier: 'system', logContext: 'post-to-facebook' },
  async ({ logger }) => handlePostToFacebook(logger)
)

export const POST = withApiHandler(
  { authTier: 'system', logContext: 'post-to-facebook' },
  async ({ logger }) => handlePostToFacebook(logger)
)

// Set max duration for Vercel
export const maxDuration = 120
