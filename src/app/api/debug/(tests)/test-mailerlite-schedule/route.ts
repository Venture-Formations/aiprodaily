import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('Testing MailerLite schedule generation...')

    // Test the same logic as getReviewDeliveryTime
    const { data: setting } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'email_scheduledSendTime')
      .single()

    const scheduledTime = setting?.value || '21:00'
    console.log('Scheduled time from settings:', scheduledTime)

    // Parse the time (format: "HH:mm")
    const [hours, minutes] = scheduledTime.split(':').map(Number)

    // Test with today's date
    const today = new Date().toISOString().split('T')[0]
    const deliveryDate = new Date(today)
    deliveryDate.setHours(hours, minutes, 0, 0)

    // Current method (potentially incorrect)
    const centralTimeString = deliveryDate.toLocaleString("en-US", {timeZone: "America/Chicago"})
    const centralDate = new Date(centralTimeString)
    const utcTime = new Date(deliveryDate.getTime() + (deliveryDate.getTimezoneOffset() * 60 * 1000))

    // Alternative method (more reliable)
    const correctUtcTime = new Date(today + 'T' + scheduledTime + ':00.000-05:00')

    // Test what MailerLite expects
    const mailerliteFormat1 = utcTime.toISOString()
    const mailerliteFormat2 = correctUtcTime.toISOString()
    const mailerliteFormat3 = deliveryDate.toISOString() // Local time as ISO

    // Test Unix timestamp (some APIs prefer this)
    const unixTimestamp = Math.floor(correctUtcTime.getTime() / 1000)

    return NextResponse.json({
      success: true,
      debug: {
        scheduledTime,
        today,
        hours,
        minutes,
        centralTimeString,
        currentMethod: mailerliteFormat1,
        alternativeMethod: mailerliteFormat2,
        localTimeISO: mailerliteFormat3,
        unixTimestamp,
        testCampaignData: {
          name: `Test Schedule Debug`,
          type: 'regular',
          emails: [{
            subject: '🍦 Test Schedule',
            from_name: 'St. Cloud Scoop',
            from: 'scoop@stcscoop.com',
            content: '<p>Test content</p>',
          }],
          groups: [process.env.MAILERLITE_REVIEW_GROUP_ID],
          delivery_schedule: {
            type: 'scheduled',
            delivery: mailerliteFormat2 // Use the more reliable format
          }
        }
      }
    })

  } catch (error) {
    console.error('Schedule test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to test schedule generation',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}