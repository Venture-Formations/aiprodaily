import { withApiHandler } from '@/lib/api-handler'
import { NextResponse } from 'next/server'
import { HealthMonitor, SlackNotificationService } from '@/lib/slack'
import { supabaseAdmin } from '@/lib/supabase'
import { FeedHealthAnalyzer } from '@/lib/monitoring/feed-health-analyzer'

export const POST = withApiHandler(
  { authTier: 'system', logContext: 'health-check' },
  async ({ logger }) => {
    logger.info('Running scheduled health check...')

    const healthMonitor = new HealthMonitor()
    const results = await healthMonitor.runFullHealthCheck()

    const overallHealth = Object.values(results).every(result =>
      typeof result === 'object' && 'healthy' in result ? result.healthy : true
    )

    // Evaluate feed health rules across all publications
    let feedRuleBreaches: Array<{ feedName: string; ruleType: string; description: string; currentValue: number; threshold: number; unit: string }> = []
    try {
      const { data: publications } = await supabaseAdmin
        .from('publications')
        .select('id')
        .eq('is_active', true)

      for (const pub of publications || []) {
        const analyzer = new FeedHealthAnalyzer(pub.id, logger)
        const evaluations = await analyzer.evaluateRules()
        const breached = evaluations.filter(e => e.breached)

        if (breached.length > 0) {
          feedRuleBreaches.push(...breached.map(b => ({
            feedName: b.feedName,
            ruleType: b.ruleType,
            description: b.description,
            currentValue: b.currentValue,
            threshold: b.threshold,
            unit: b.unit,
          })))
        }
      }

      if (feedRuleBreaches.length > 0) {
        const slack = new SlackNotificationService()
        const breachLines = feedRuleBreaches
          .map(b => `• ${b.feedName} [${b.ruleType}]: ${b.description} (current: ${b.currentValue} ${b.unit}, threshold: ${b.threshold} ${b.unit})`)
          .join('\n')
        await slack.sendAlert(
          `Feed Health Rules Breached\n\n${breachLines}`,
          'warn',
          'health_check_alerts'
        )
      }
    } catch (ruleError) {
      logger.error({ err: ruleError }, 'Failed to evaluate feed health rules')
    }

    return NextResponse.json({
      success: true,
      status: overallHealth ? 'healthy' : 'degraded',
      results,
      feedRuleBreaches: feedRuleBreaches.length,
      timestamp: new Date().toISOString()
    })
  }
)

export const GET = withApiHandler(
  { authTier: 'system', logContext: 'health-check' },
  async () => {
    return NextResponse.json({
      message: 'Health check cron endpoint is active',
      timestamp: new Date().toISOString(),
      schedule: 'Every 15 minutes during active hours'
    })
  }
)
