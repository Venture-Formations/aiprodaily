import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current Slack settings from database
    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .like('key', 'slack_%_enabled')

    const slackSettings: any = {
      campaignStatusUpdates: true,
      workflowFailure: true,
      systemErrors: true,
      rssProcessingUpdates: true,
      rssProcessingIncomplete: true,
      lowArticleCount: true,
      scheduledSendFailure: true,
      scheduledSendTiming: true,
      healthCheckAlerts: true,
      emailDeliveryUpdates: true
    }

    // Convert database settings to frontend format
    settings?.forEach(setting => {
      const key = setting.key.replace('slack_', '')
      if (key.endsWith('_enabled')) {
        const notificationType = key.replace('_enabled', '')
        const camelCaseKey = notificationType.replace(/_([a-z])/g, (_: string, letter: string) => letter.toUpperCase())
        ;(slackSettings as any)[camelCaseKey] = setting.value === 'true'
      }
    })

    return NextResponse.json(slackSettings)

  } catch (error) {
    console.error('Failed to load Slack settings:', error)
    return NextResponse.json(
      { error: 'Failed to load Slack settings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('[API /settings/slack] POST request received')

    const session = await getServerSession(authOptions)
    if (!session) {
      console.log('[API /settings/slack] Unauthorized - no session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    console.log('[API /settings/slack] Request body:', body)

    // Convert frontend format to database format
    const dbSettings = [
      { key: 'slack_campaign_status_updates_enabled', value: body.campaignStatusUpdates ? 'true' : 'false' },
      { key: 'slack_workflow_failure_enabled', value: body.workflowFailure ? 'true' : 'false' },
      { key: 'slack_system_errors_enabled', value: body.systemErrors ? 'true' : 'false' },
      { key: 'slack_rss_processing_updates_enabled', value: body.rssProcessingUpdates ? 'true' : 'false' },
      { key: 'slack_rss_processing_incomplete_enabled', value: body.rssProcessingIncomplete ? 'true' : 'false' },
      { key: 'slack_low_article_count_enabled', value: body.lowArticleCount ? 'true' : 'false' },
      { key: 'slack_scheduled_send_failure_enabled', value: body.scheduledSendFailure ? 'true' : 'false' },
      { key: 'slack_scheduled_send_timing_enabled', value: body.scheduledSendTiming ? 'true' : 'false' },
      { key: 'slack_health_check_alerts_enabled', value: body.healthCheckAlerts ? 'true' : 'false' },
      { key: 'slack_email_delivery_updates_enabled', value: body.emailDeliveryUpdates ? 'true' : 'false' }
    ]

    console.log('[API /settings/slack] Upserting settings:', dbSettings.length, 'records')

    // Upsert all settings
    for (const setting of dbSettings) {
      const { error } = await supabaseAdmin
        .from('app_settings')
        .upsert(setting, { onConflict: 'key' })

      if (error) {
        console.error('[API /settings/slack] Upsert error for', setting.key, ':', error)
        throw error
      }
    }

    console.log('[API /settings/slack] All settings saved successfully')
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[API /settings/slack] Error:', error)
    return NextResponse.json(
      { error: 'Failed to save Slack settings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}