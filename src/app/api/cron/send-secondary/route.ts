import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SendGridService } from '@/lib/sendgrid'
import { MailerLiteService } from '@/lib/mailerlite'
import { getPublicationSetting, getEmailProviderSettings } from '@/lib/publication-settings'

export const maxDuration = 600 // 10 minutes

/**
 * Cron job to send secondary newsletter to a different subscriber group
 * Runs at the configured secondary send time, only on selected days
 * Reuses content from the most recent sent issue
 */
export async function POST(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('[CRON] === SECONDARY SEND CHECK ===')
    console.log('[CRON] Time:', new Date().toISOString())
    console.log('[CRON] Central Time:', new Date().toLocaleString("en-US", {timeZone: "America/Chicago"}))

    // Get first active publication for backward compatibility
    const { data: activePublication } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!activePublication) {
      return NextResponse.json({
        success: false,
        error: 'No active publication found'
      }, { status: 404 })
    }

    const publicationId = activePublication.id

    // Check if secondary schedule is enabled
    const secondaryScheduleEnabled = await getPublicationSetting(publicationId, 'email_secondaryScheduleEnabled')
    if (secondaryScheduleEnabled !== 'true') {
      console.log('[CRON] Secondary schedule is disabled, skipping')
      return NextResponse.json({
        success: true,
        message: 'Secondary schedule is disabled',
        skipped: true
      })
    }

    // Get secondary send days
    const secondarySendDaysRaw = await getPublicationSetting(publicationId, 'secondary_send_days')
    let secondarySendDays: number[] = []
    if (secondarySendDaysRaw) {
      try {
        secondarySendDays = JSON.parse(secondarySendDaysRaw)
      } catch {
        console.error('[CRON] Failed to parse secondary_send_days, using default Mon-Fri')
        secondarySendDays = [1, 2, 3, 4, 5]
      }
    } else {
      secondarySendDays = [1, 2, 3, 4, 5] // Default to Mon-Fri
    }

    // Check if today is a send day (0 = Sunday, 6 = Saturday)
    const today = new Date()
    const dayOfWeek = today.getDay()

    if (!secondarySendDays.includes(dayOfWeek)) {
      console.log(`[CRON] Today (${dayOfWeek}) is not a configured send day [${secondarySendDays.join(',')}], skipping`)
      return NextResponse.json({
        success: true,
        message: `Today is not a configured send day`,
        skipped: true,
        dayOfWeek,
        configuredDays: secondarySendDays
      })
    }

    console.log(`[CRON] Today (${dayOfWeek}) is a configured send day, proceeding...`)

    // Get secondary list ID (SendGrid)
    const secondaryListId = await getPublicationSetting(publicationId, 'sendgrid_secondary_list_id')
    if (!secondaryListId) {
      console.error('[CRON] Secondary list ID not configured')
      return NextResponse.json({
        success: false,
        error: 'Secondary list ID not configured in settings (sendgrid_secondary_list_id)'
      }, { status: 400 })
    }

    console.log('[CRON] Using secondary list ID:', secondaryListId)

    // Get today's issue (can be in_review, changes_made, or sent)
    const localDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })

    const { data: issue, error } = await supabaseAdmin
      .from('publication_issues')
      .select(`
        *,
        articles:articles(
          *,
          rss_post:rss_posts(
            *,
            rss_feed:rss_feeds(*)
          )
        ),
        secondary_articles:secondary_articles(
          *,
          rss_post:rss_posts(
            *,
            rss_feed:rss_feeds(*)
          )
        ),
        manual_articles:manual_articles(*)
      `)
      .eq('publication_id', publicationId)
      .in('status', ['in_review', 'changes_made', 'sent'])
      .eq('date', localDate)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !issue) {
      console.error('[CRON] No issue found for today:', error)
      return NextResponse.json({
        success: false,
        error: 'No issue found for today',
        date: localDate
      }, { status: 404 })
    }

    console.log(`[CRON] Found issue: ${issue.id} (date: ${issue.date}, status: ${issue.status})`)

    // Check if secondary send was already done today
    if (issue.secondary_sent_at) {
      const secondarySentDate = new Date(issue.secondary_sent_at).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
      if (secondarySentDate === localDate) {
        console.log('[CRON] Secondary send already completed today at:', issue.secondary_sent_at)
        return NextResponse.json({
          success: true,
          message: 'Secondary send already completed today',
          skipped: true,
          secondary_sent_at: issue.secondary_sent_at
        })
      }
    }

    // Check if we have any active articles
    const activeArticles = issue.articles.filter((article: any) => article.is_active && article.final_position)
    if (activeArticles.length === 0) {
      console.log('[CRON] Issue has no active articles with final positions, skipping send')
      return NextResponse.json({
        success: false,
        error: 'Issue has no active articles',
        skipped: true
      })
    }

    // Check which email provider to use
    const providerSettings = await getEmailProviderSettings(publicationId)
    console.log(`[CRON] Using email provider: ${providerSettings.provider}`)

    let result: { success: boolean; campaignId?: string; issueId?: string; error?: string }

    if (providerSettings.provider === 'sendgrid') {
      // Create and send the secondary campaign via SendGrid
      const sendGridService = new SendGridService()
      result = await sendGridService.createFinalCampaign(issue, true) // true = isSecondary

      if (!result.success) {
        throw new Error(result.error || 'Failed to create secondary SendGrid campaign')
      }
    } else {
      // Create and send the secondary campaign via MailerLite
      const mailerliteService = new MailerLiteService()
      const mlResult = await mailerliteService.createFinalissue(issue, providerSettings.secondaryGroupId, true) // true = isSecondary

      result = {
        success: mlResult.success,
        campaignId: mlResult.issueId,
        error: mlResult.success ? undefined : 'Failed to create secondary MailerLite campaign'
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to create secondary MailerLite campaign')
      }
    }

    // Update issue to record secondary send
    const { error: updateError } = await supabaseAdmin
      .from('publication_issues')
      .update({
        secondary_sent_at: new Date().toISOString(),
        metrics: {
          ...issue.metrics,
          [`${providerSettings.provider}_secondary_singlesend_id`]: result.campaignId,
          secondary_sent_timestamp: new Date().toISOString()
        }
      })
      .eq('id', issue.id)

    if (updateError) {
      console.error('[CRON] Failed to update issue with secondary send info:', updateError)
      // Don't fail the entire operation - the email was sent successfully
    } else {
      console.log('[CRON] Issue updated with secondary send timestamp')
    }

    console.log('[CRON] === SECONDARY SEND COMPLETED ===')

    return NextResponse.json({
      success: true,
      message: 'Secondary newsletter sent successfully via SendGrid',
      issue_id: issue.id,
      issue_date: issue.date,
      secondary_list_id: secondaryListId,
      sendgrid_campaign_id: result.campaignId,
      sent_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('[CRON] Secondary send error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to send secondary newsletter',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * GET handler for Vercel cron jobs
 * Vercel cron jobs make GET requests, so we need this handler
 */
export async function GET(request: NextRequest) {
  try {
    // For Vercel cron: check secret in URL params, for manual: require secret param
    const searchParams = new URL(request.url).searchParams
    const secret = searchParams.get('secret')

    // Allow both manual testing (with secret param) and Vercel cron (no auth needed)
    const isVercelCron = !secret && !searchParams.has('secret')
    const isManualTest = secret === process.env.CRON_SECRET

    if (!isVercelCron && !isManualTest) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[CRON] === SECONDARY SEND CHECK (GET) ===')
    console.log('[CRON] Time:', new Date().toISOString())
    console.log('[CRON] Central Time:', new Date().toLocaleString("en-US", {timeZone: "America/Chicago"}))
    console.log('[CRON] Request type:', isVercelCron ? 'Vercel Cron' : 'Manual Test')

    // Get first active publication for backward compatibility
    const { data: activePublication } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!activePublication) {
      return NextResponse.json({
        success: false,
        error: 'No active publication found'
      }, { status: 404 })
    }

    const publicationId = activePublication.id

    // Check if secondary schedule is enabled
    const secondaryScheduleEnabled = await getPublicationSetting(publicationId, 'email_secondaryScheduleEnabled')
    if (secondaryScheduleEnabled !== 'true') {
      console.log('[CRON] Secondary schedule is disabled, skipping')
      return NextResponse.json({
        success: true,
        message: 'Secondary schedule is disabled',
        skipped: true
      })
    }

    // Get secondary send days
    const secondarySendDaysRaw = await getPublicationSetting(publicationId, 'secondary_send_days')
    let secondarySendDays: number[] = []
    if (secondarySendDaysRaw) {
      try {
        secondarySendDays = JSON.parse(secondarySendDaysRaw)
      } catch {
        console.error('[CRON] Failed to parse secondary_send_days, using default Mon-Fri')
        secondarySendDays = [1, 2, 3, 4, 5]
      }
    } else {
      secondarySendDays = [1, 2, 3, 4, 5] // Default to Mon-Fri
    }

    // Check if today is a send day (0 = Sunday, 6 = Saturday)
    const today = new Date()
    const dayOfWeek = today.getDay()

    if (!secondarySendDays.includes(dayOfWeek)) {
      console.log(`[CRON] Today (${dayOfWeek}) is not a configured send day [${secondarySendDays.join(',')}], skipping`)
      return NextResponse.json({
        success: true,
        message: `Today is not a configured send day`,
        skipped: true,
        dayOfWeek,
        configuredDays: secondarySendDays
      })
    }

    console.log(`[CRON] Today (${dayOfWeek}) is a configured send day, proceeding...`)

    // Get secondary list ID (SendGrid)
    const secondaryListId = await getPublicationSetting(publicationId, 'sendgrid_secondary_list_id')
    if (!secondaryListId) {
      console.error('[CRON] Secondary list ID not configured')
      return NextResponse.json({
        success: false,
        error: 'Secondary list ID not configured in settings (sendgrid_secondary_list_id)'
      }, { status: 400 })
    }

    console.log('[CRON] Using secondary list ID:', secondaryListId)

    // Get today's issue (can be in_review, changes_made, or sent)
    const localDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })

    const { data: issue, error } = await supabaseAdmin
      .from('publication_issues')
      .select(`
        *,
        articles:articles(
          *,
          rss_post:rss_posts(
            *,
            rss_feed:rss_feeds(*)
          )
        ),
        secondary_articles:secondary_articles(
          *,
          rss_post:rss_posts(
            *,
            rss_feed:rss_feeds(*)
          )
        ),
        manual_articles:manual_articles(*)
      `)
      .eq('publication_id', publicationId)
      .in('status', ['in_review', 'changes_made', 'sent'])
      .eq('date', localDate)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !issue) {
      console.error('[CRON] No issue found for today:', error)
      return NextResponse.json({
        success: false,
        error: 'No issue found for today',
        date: localDate
      }, { status: 404 })
    }

    console.log(`[CRON] Found issue: ${issue.id} (date: ${issue.date}, status: ${issue.status})`)

    // Check if secondary send was already done today
    if (issue.secondary_sent_at) {
      const secondarySentDate = new Date(issue.secondary_sent_at).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
      if (secondarySentDate === localDate) {
        console.log('[CRON] Secondary send already completed today at:', issue.secondary_sent_at)
        return NextResponse.json({
          success: true,
          message: 'Secondary send already completed today',
          skipped: true,
          secondary_sent_at: issue.secondary_sent_at
        })
      }
    }

    // Check if we have any active articles
    const activeArticles = issue.articles.filter((article: any) => article.is_active && article.final_position)
    if (activeArticles.length === 0) {
      console.log('[CRON] Issue has no active articles with final positions, skipping send')
      return NextResponse.json({
        success: false,
        error: 'Issue has no active articles',
        skipped: true
      })
    }

    // Check which email provider to use
    const providerSettings = await getEmailProviderSettings(publicationId)
    console.log(`[CRON] Using email provider: ${providerSettings.provider}`)

    let result: { success: boolean; campaignId?: string; issueId?: string; error?: string }

    if (providerSettings.provider === 'sendgrid') {
      // Create and send the secondary campaign via SendGrid
      const sendGridService = new SendGridService()
      result = await sendGridService.createFinalCampaign(issue, true) // true = isSecondary

      if (!result.success) {
        throw new Error(result.error || 'Failed to create secondary SendGrid campaign')
      }
    } else {
      // Create and send the secondary campaign via MailerLite
      const mailerliteService = new MailerLiteService()
      const mlResult = await mailerliteService.createFinalissue(issue, providerSettings.secondaryGroupId, true) // true = isSecondary

      result = {
        success: mlResult.success,
        campaignId: mlResult.issueId,
        error: mlResult.success ? undefined : 'Failed to create secondary MailerLite campaign'
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to create secondary MailerLite campaign')
      }
    }

    // Update issue to record secondary send
    const { error: updateError } = await supabaseAdmin
      .from('publication_issues')
      .update({
        secondary_sent_at: new Date().toISOString(),
        metrics: {
          ...issue.metrics,
          [`${providerSettings.provider}_secondary_singlesend_id`]: result.campaignId,
          secondary_sent_timestamp: new Date().toISOString()
        }
      })
      .eq('id', issue.id)

    if (updateError) {
      console.error('[CRON] Failed to update issue with secondary send info:', updateError)
      // Don't fail the entire operation - the email was sent successfully
    } else {
      console.log('[CRON] Issue updated with secondary send timestamp')
    }

    console.log('[CRON] === SECONDARY SEND COMPLETED ===')

    return NextResponse.json({
      success: true,
      message: 'Secondary newsletter sent successfully via SendGrid',
      issue_id: issue.id,
      issue_date: issue.date,
      secondary_list_id: secondaryListId,
      sendgrid_campaign_id: result.campaignId,
      sent_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('[CRON] Secondary send error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to send secondary newsletter',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
