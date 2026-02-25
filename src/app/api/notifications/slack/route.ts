import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { SlackNotificationService } from '@/lib/slack'

export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'notifications/slack' },
  async ({ request }) => {
    const body = await request.json()
    const { message, level = 'info', context } = body

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const slackService = new SlackNotificationService()
    await slackService.sendAlert(message, level, context)

    return NextResponse.json({
      success: true,
      message: 'Slack notification sent successfully'
    })
  }
)
