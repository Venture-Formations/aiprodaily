import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { SlackNotificationService } from '@/lib/slack'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

  } catch (error) {
    console.error('Failed to send Slack notification:', error)

    return NextResponse.json({
      error: 'Failed to send Slack notification',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}