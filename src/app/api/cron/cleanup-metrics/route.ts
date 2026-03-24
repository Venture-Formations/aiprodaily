import { withApiHandler } from '@/lib/api-handler'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { MetricsRecorder } from '@/lib/monitoring/metrics-recorder'
import { SlackNotificationService } from '@/lib/slack'

/**
 * Metrics Cleanup & Deviation Check Cron
 *
 * Runs daily at 3 AM:
 * 1. Deletes system_metrics rows older than 90 days
 * 2. Checks each publication's metrics for anomalous deviations
 * 3. Fires Slack alerts for significant deviations
 */
const handler = withApiHandler(
  { authTier: 'system', logContext: 'cleanup-metrics' },
  async ({ logger }) => {
    logger.info('Starting metrics cleanup and deviation check')

    // 1. Cleanup old metrics
    const deleted = await MetricsRecorder.cleanupOldMetrics(90)

    // 2. Check for deviations across all publications
    const { data: publications } = await supabaseAdmin
      .from('publications')
      .select('id, name')
      .eq('is_active', true)

    const allDeviations = []

    for (const pub of publications || []) {
      try {
        const deviations = await MetricsRecorder.checkDeviations(pub.id)
        if (deviations.length > 0) {
          allDeviations.push({ publication: pub.name, deviations })
        }
      } catch (error) {
        logger.error({ err: error, publicationId: pub.id }, 'Deviation check failed')
      }
    }

    // 3. Alert on deviations
    if (allDeviations.length > 0) {
      const slack = new SlackNotificationService()
      const lines = allDeviations.flatMap(d =>
        d.deviations.map(dev =>
          `• ${d.publication} — ${dev.metric}: ${dev.current} (avg: ${dev.avg}, ${dev.deviations}x stddev)`
        )
      )
      await slack.sendAlert(
        `Metric Deviations Detected\n\n${lines.join('\n')}`,
        'warn',
        'system_errors'
      )
    }

    logger.info({ deleted, deviationCount: allDeviations.length }, 'Metrics cleanup complete')

    return NextResponse.json({
      success: true,
      deleted,
      deviations: allDeviations,
      timestamp: new Date().toISOString(),
    })
  }
)

export const GET = handler
export const POST = handler
export const maxDuration = 120
