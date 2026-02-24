import { withApiHandler } from '@/lib/api-handler'
import { NextResponse } from 'next/server'
import { emailMetricsService } from '@/lib/email-metrics'

/**
 * Import email metrics from the appropriate provider (SendGrid or MailerLite)
 *
 * This cron job uses the hybrid EmailMetricsService which automatically
 * selects the correct provider based on which campaign ID is present:
 * - sendgrid_singlesend_id → Fetch from SendGrid
 * - mailerlite_issue_id → Fetch from MailerLite (legacy)
 */

const handler = withApiHandler(
  { authTier: 'system', logContext: 'import-metrics' },
  async ({ logger }) => {
    logger.info('Starting hybrid metrics import')

    const result = await emailMetricsService.importMetricsForRecentIssues(30)

    logger.info(`Complete: ${result.successful} successful, ${result.skipped} skipped, ${result.failed} failed`)

    return NextResponse.json({
      success: true,
      message: 'Metrics import completed (hybrid provider)',
      ...result,
      timestamp: new Date().toISOString()
    })
  }
)

export const GET = handler
export const POST = handler
