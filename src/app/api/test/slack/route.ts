import { NextRequest, NextResponse } from 'next/server'
import { SlackNotificationService } from '@/lib/slack'

export async function GET(request: NextRequest) {
  try {
    // Check if secret parameter is provided
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')

    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Test Slack notification
    const slack = new SlackNotificationService()

    await slack.sendAlert(
      'Test notification from St. Cloud Scoop approval system',
      'info',
      'system_errors'
    )

    return NextResponse.json({
      success: true,
      message: 'Slack notification test sent successfully',
      webhook_configured: !!process.env.SLACK_WEBHOOK_URL,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Slack test failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to send Slack notification',
      message: error instanceof Error ? error.message : 'Unknown error',
      webhook_configured: !!process.env.SLACK_WEBHOOK_URL
    }, { status: 500 })
  }
}