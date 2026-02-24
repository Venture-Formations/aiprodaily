import { withApiHandler } from '@/lib/api-handler'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SlackNotificationService } from '@/lib/slack'

/**
 * Workflow Failure Monitor
 *
 * Runs every 5 minutes to check for failed workflows and send Slack alerts
 * Prevents duplicate alerts by tracking which failures have been notified
 */
export const GET = withApiHandler(
  { authTier: 'system', logContext: 'monitor-workflows' },
  async ({ logger }) => {
    logger.info('Checking for failed workflows...')

    // Find issues that failed but haven't been alerted yet
    const { data: failedIssues, error: queryError } = await supabaseAdmin
      .from('publication_issues')
      .select('id, date, status, workflow_error, created_at, publication_id')
      .eq('status', 'failed')
      .is('failure_alerted_at', null) // Only get issues we haven't alerted about
      .order('created_at', { ascending: false })
      .limit(10) // Process up to 10 at a time

    if (queryError) {
      logger.error({ err: queryError }, 'Query error')
      return NextResponse.json({
        error: 'Failed to query issues',
        message: queryError.message
      }, { status: 500 })
    }

    if (!failedIssues || failedIssues.length === 0) {
      logger.info('No new failures to report')
      return NextResponse.json({
        success: true,
        message: 'No new workflow failures',
        checked: true,
        timestamp: new Date().toISOString()
      })
    }

    logger.info(`Found ${failedIssues.length} failed issue(s) to alert`)

    const slack = new SlackNotificationService()
    const alertedIssues: string[] = []

    // Send alerts for each failed issue
    for (const issue of failedIssues) {
      try {
        // Get newsletter name for context
        const { data: newsletter } = await supabaseAdmin
          .from('publications')
          .select('name, slug')
          .eq('id', issue.publication_id)
          .single()

        const newsletterName = newsletter?.name || issue.publication_id

        // Send Slack alert
        await slack.sendAlert(
          `🚨 Workflow Failed After Retries\n\n` +
          `issue ID: ${issue.id}\n` +
          `Newsletter: ${newsletterName}\n` +
          `Date: ${issue.date}\n` +
          `Failed At: ${new Date(issue.created_at).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT\n` +
          `Error: ${issue.workflow_error || 'Unknown error'}\n\n` +
          `Check Vercel logs for full details.`,
          'error',
          'workflow_failure'
        )

        // Mark as alerted
        await supabaseAdmin
          .from('publication_issues')
          .update({ failure_alerted_at: new Date().toISOString() })
          .eq('id', issue.id)

        alertedIssues.push(issue.id)
        logger.info(`Alerted for issue ${issue.id}`)

      } catch (alertError) {
        logger.error({ err: alertError, issueId: issue.id }, 'Failed to alert for issue')
        // Continue with next issue even if one fails
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${alertedIssues.length} workflow failure alert(s)`,
      alertedIssues,
      timestamp: new Date().toISOString()
    })
  }
)

export const maxDuration = 60
