import { withApiHandler } from '@/lib/api-handler'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { LogAnalyzer } from '@/lib/monitoring/log-analyzer'
import { SlackNotificationService } from '@/lib/slack'

/**
 * Daily Log Analysis Cron
 *
 * Runs daily at 7 AM. For each active publication:
 * 1. Aggregates the previous day's system_logs
 * 2. Calls AI to detect anomalies and generate recommendations
 * 3. Stores the report in log_analysis_reports
 * 4. Posts a Slack digest
 */
const handler = withApiHandler(
  { authTier: 'system', logContext: 'log-analysis' },
  async ({ logger }) => {
    logger.info('Starting daily log analysis')

    // Analyze yesterday's logs
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const reportDate = yesterday.toISOString().split('T')[0]

    // Get active publications
    const { data: publications, error } = await supabaseAdmin
      .from('publications')
      .select('id, name')
      .eq('is_active', true)

    if (error || !publications) {
      logger.error({ err: error }, 'Failed to fetch publications')
      return NextResponse.json({ error: 'Failed to fetch publications' }, { status: 500 })
    }

    const slack = new SlackNotificationService()
    const results = []

    for (const pub of publications) {
      try {
        const analyzer = new LogAnalyzer(pub.id, logger)
        const report = await analyzer.analyze(reportDate)

        // Post Slack digest
        await slack.sendDailyDigestAlert({
          reportDate,
          summary: report.summary,
          anomalies: report.anomalies,
          recommendations: report.recommendations,
        })

        results.push({
          publication: pub.name,
          anomalies: report.anomalies.length,
          recommendations: report.recommendations.length,
          status: 'success',
        })
      } catch (pubError) {
        logger.error({ err: pubError, publicationId: pub.id }, 'Log analysis failed for publication')
        results.push({
          publication: pub.name,
          status: 'failed',
          error: pubError instanceof Error ? pubError.message : 'Unknown error',
        })
      }
    }

    logger.info({ results }, 'Daily log analysis complete')

    return NextResponse.json({
      success: true,
      reportDate,
      results,
      timestamp: new Date().toISOString(),
    })
  }
)

export const GET = handler
export const POST = handler
export const maxDuration = 120
