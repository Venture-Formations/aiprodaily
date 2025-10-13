import { NextRequest, NextResponse } from 'next/server'
import { HealthMonitor } from '@/lib/slack'

export async function GET(request: NextRequest) {
  try {
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

  } catch (error) {
    console.error('Health check failed:', error)

    return NextResponse.json({
      status: 'error',
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}