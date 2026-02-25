import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { HealthMonitor } from '@/lib/slack'

export const GET = withApiHandler(
  { authTier: 'public', logContext: 'health' },
  async ({ request, logger }) => {
    const healthMonitor = new HealthMonitor()
    const results = await healthMonitor.runFullHealthCheck()

    const overallHealth = Object.values(results).every(result =>
      typeof result === 'object' && 'healthy' in result ? result.healthy : true
    )

    return NextResponse.json({
      status: overallHealth ? 'healthy' : 'degraded',
      timestamp: results.timestamp,
      checks: {
        database: results.database,
        rssFeeds: results.rssFeeds,
        recentProcessing: results.recentProcessing
      }
    }, {
      status: overallHealth ? 200 : 503
    })
  }
)
