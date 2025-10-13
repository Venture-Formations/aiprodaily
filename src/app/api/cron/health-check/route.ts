import { NextRequest, NextResponse } from 'next/server'
import { HealthMonitor } from '@/lib/slack'

export async function POST(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('Running scheduled health check...')

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

  } catch (error) {
    console.error('Scheduled health check failed:', error)

    return NextResponse.json({
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// For manual testing
export async function GET() {
  return NextResponse.json({
    message: 'Health check cron endpoint is active',
    timestamp: new Date().toISOString(),
    schedule: 'Every 15 minutes during active hours'
  })
}