import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SlackNotificationService } from '@/lib/slack'

/**
 * Workflow Failure Monitor
 *
 * Runs every 5 minutes to check for failed workflows and send Slack alerts
 * Prevents duplicate alerts by tracking which failures have been notified
 */
export async function GET(request: NextRequest) {
  try {
    // For Vercel cron: check secret in URL params
    const searchParams = new URL(request.url).searchParams
    const secret = searchParams.get('secret')

    const isVercelCron = !secret && !searchParams.has('secret')
    const isManualTest = secret === process.env.CRON_SECRET

    if (!isVercelCron && !isManualTest) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Workflow Monitor] Checking for failed workflows...')

    // Find campaigns that failed but haven't been alerted yet
    const { data: failedCampaigns, error: queryError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, date, status, workflow_error, created_at, newsletter_id')
      .eq('status', 'failed')
      .is('failure_alerted_at', null) // Only get campaigns we haven't alerted about
      .order('created_at', { ascending: false })
      .limit(10) // Process up to 10 at a time

    if (queryError) {
      console.error('[Workflow Monitor] Query error:', queryError)
      return NextResponse.json({
        error: 'Failed to query campaigns',
        message: queryError.message
      }, { status: 500 })
    }

    if (!failedCampaigns || failedCampaigns.length === 0) {
      console.log('[Workflow Monitor] No new failures to report')
      return NextResponse.json({
        success: true,
        message: 'No new workflow failures',
        checked: true,
        timestamp: new Date().toISOString()
      })
    }

    console.log(`[Workflow Monitor] Found ${failedCampaigns.length} failed campaign(s) to alert`)

    const slack = new SlackNotificationService()
    const alertedCampaigns: string[] = []

    // Send alerts for each failed campaign
    for (const campaign of failedCampaigns) {
      try {
        // Get newsletter name for context
        const { data: newsletter } = await supabaseAdmin
          .from('newsletters')
          .select('name, slug')
          .eq('id', campaign.newsletter_id)
          .single()

        const newsletterName = newsletter?.name || campaign.newsletter_id

        // Send Slack alert
        await slack.sendAlert(
          `🚨 Workflow Failed After Retries\n\n` +
          `Campaign ID: ${campaign.id}\n` +
          `Newsletter: ${newsletterName}\n` +
          `Date: ${campaign.date}\n` +
          `Failed At: ${new Date(campaign.created_at).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT\n` +
          `Error: ${campaign.workflow_error || 'Unknown error'}\n\n` +
          `Check Vercel logs for full details.`,
          'error',
          'workflow_failure'
        )

        // Mark as alerted
        await supabaseAdmin
          .from('newsletter_campaigns')
          .update({ failure_alerted_at: new Date().toISOString() })
          .eq('id', campaign.id)

        alertedCampaigns.push(campaign.id)
        console.log(`[Workflow Monitor] ✓ Alerted for campaign ${campaign.id}`)

      } catch (alertError) {
        console.error(`[Workflow Monitor] Failed to alert for campaign ${campaign.id}:`, alertError)
        // Continue with next campaign even if one fails
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${alertedCampaigns.length} workflow failure alert(s)`,
      alertedCampaigns,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[Workflow Monitor] Fatal error:', error)
    return NextResponse.json({
      error: 'Workflow monitor failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export const maxDuration = 60
