import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current settings from database (key-value structure)
    const { data: settingsRows, error } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .like('key', 'email_%')

    if (error) {
      throw error
    }

    // Convert rows to object
    const savedSettings: Record<string, string> = {}
    settingsRows?.forEach(row => {
      const settingKey = row.key.replace('email_', '')
      savedSettings[settingKey] = row.value
    })

    // Return current settings or defaults
    const defaultSettings = {
      reviewGroupId: process.env.MAILERLITE_REVIEW_GROUP_ID || '',
      mainGroupId: process.env.MAILERLITE_MAIN_GROUP_ID || '',
      fromEmail: 'scoop@stcscoop.com',
      senderName: 'St. Cloud Scoop',
      reviewScheduleEnabled: 'true',
      rssProcessingTime: '20:30',  // 8:30 PM CT
      campaignCreationTime: '20:50',  // 8:50 PM CT
      scheduledSendTime: '21:00',  // 9:00 PM CT
      dailyScheduleEnabled: 'false',
      dailyCampaignCreationTime: '04:30',  // 4:30 AM CT
      dailyScheduledSendTime: '04:55'  // 4:55 AM CT
    }

    return NextResponse.json({
      ...defaultSettings,
      ...savedSettings
    })

  } catch (error) {
    console.error('Failed to load email settings:', error)
    return NextResponse.json({
      error: 'Failed to load email settings',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const settings = await request.json()

    // Validate required fields
    if (!settings.fromEmail || !settings.senderName) {
      return NextResponse.json({
        error: 'From Email and Sender Name are required'
      }, { status: 400 })
    }

    // Validate time formats (HH:MM)
    const timeFields = ['rssProcessingTime', 'campaignCreationTime', 'scheduledSendTime', 'dailyCampaignCreationTime', 'dailyScheduledSendTime']
    for (const field of timeFields) {
      if (settings[field] && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(settings[field])) {
        return NextResponse.json({
          error: `Invalid time format for ${field}. Use HH:MM format.`
        }, { status: 400 })
      }
    }

    // Save settings as individual key-value pairs
    const settingsToSave = [
      { key: 'email_reviewGroupId', value: settings.reviewGroupId || '' },
      { key: 'email_mainGroupId', value: settings.mainGroupId || '' },
      { key: 'email_fromEmail', value: settings.fromEmail },
      { key: 'email_senderName', value: settings.senderName },
      { key: 'email_reviewScheduleEnabled', value: settings.reviewScheduleEnabled ? 'true' : 'false' },
      { key: 'email_rssProcessingTime', value: settings.rssProcessingTime },
      { key: 'email_campaignCreationTime', value: settings.campaignCreationTime },
      { key: 'email_scheduledSendTime', value: settings.scheduledSendTime },
      { key: 'email_dailyScheduleEnabled', value: settings.dailyScheduleEnabled ? 'true' : 'false' },
      { key: 'email_dailyCampaignCreationTime', value: settings.dailyCampaignCreationTime },
      { key: 'email_dailyScheduledSendTime', value: settings.dailyScheduledSendTime }
    ]

    // Upsert each setting
    for (const setting of settingsToSave) {
      const { error } = await supabaseAdmin
        .from('app_settings')
        .upsert({
          key: setting.key,
          value: setting.value,
          description: `Email configuration: ${setting.key.replace('email_', '')}`,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        })

      if (error) {
        throw error
      }
    }

    // Log the settings update
    if (session.user?.email) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

      if (user) {
        await supabaseAdmin
          .from('user_activities')
          .insert([{
            user_id: user.id,
            action: 'email_settings_updated',
            details: {
              scheduling_updated: true,
              times: {
                rss: settings.rssProcessingTime,
                campaign: settings.campaignCreationTime,
                send: settings.scheduledSendTime
              },
              note: 'Subject line generation fixed at RSS+15min'
            }
          }])
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Email settings saved successfully'
    })

  } catch (error) {
    console.error('Failed to save email settings:', error)
    return NextResponse.json({
      error: 'Failed to save email settings',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}