import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('Testing MailerLite schedule format...')

    // Get current settings
    const { data: setting } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'email_scheduledSendTime')
      .single()

    const scheduledTime = setting?.value || '13:20'
    const testDate = '2025-09-24' // Tomorrow

    // Test our current method
    const centralTimeString = `${testDate}T${scheduledTime}:00.000-05:00`
    const utcTime = new Date(centralTimeString)
    const isoString = utcTime.toISOString()

    // Test alternative formats that MailerLite might expect
    const unixTimestamp = Math.floor(utcTime.getTime() / 1000)
    const unixTimestampMs = utcTime.getTime()

    // Test future time (tomorrow same time)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(13, 20, 0, 0)
    const futureIso = tomorrow.toISOString()
    const futureUnix = Math.floor(tomorrow.getTime() / 1000)

    // Show what would be sent to MailerLite
    const testCampaignData = {
      name: `Test Schedule Debug`,
      type: 'regular',
      emails: [{
        subject: '🍦 Test Schedule Format',
        from_name: 'St. Cloud Scoop',
        from: 'scoop@stcscoop.com',
        content: '<p>Test scheduling content</p>',
      }],
      groups: [process.env.MAILERLITE_REVIEW_GROUP_ID],
      delivery_schedule: {
        type: 'scheduled',
        delivery: isoString
      }
    }

    return NextResponse.json({
      success: true,
      debug: {
        settings: {
          scheduledTime,
          testDate
        },
        timeFormats: {
          centralTimeString,
          isoString,
          unixTimestamp,
          unixTimestampMs,
          futureIso,
          futureUnix
        },
        currentTime: {
          now: new Date().toISOString(),
          nowUnix: Math.floor(Date.now() / 1000)
        },
        mailerlitePayload: testCampaignData,
        possibleIssues: [
          'MailerLite might reject past timestamps',
          'MailerLite might expect Unix timestamp instead of ISO string',
          'MailerLite might expect different field format',
          'MailerLite might require specific timezone handling'
        ]
      }
    })

  } catch (error) {
    console.error('Schedule format test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to test schedule format',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}