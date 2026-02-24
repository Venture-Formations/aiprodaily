import { withApiHandler } from '@/lib/api-handler'
import { NextResponse } from 'next/server'
import { HealthMonitor } from '@/lib/slack'

export const POST = withApiHandler(
  { authTier: 'system', logContext: 'health-check' },
  async ({ logger }) => {
    logger.info('Running scheduled health check...')

    const healthMonitor = new HealthMonitor()
    const results = await healthMonitor.runFullHealthCheck()

    const overallHealth = Object.values(results).every(result =>
      typeof result === 'object' && 'healthy' in result ? result.healthy : true
    )

    return NextResponse.json({
      success: true,
      status: overallHealth ? 'healthy' : 'degraded',
      results,
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
