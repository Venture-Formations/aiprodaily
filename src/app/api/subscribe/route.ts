import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import axios from 'axios'
import { getPublicationByDomain, getPublicationSetting, getEmailProviderSettings } from '@/lib/publication-settings'
import { SendGridService } from '@/lib/sendgrid'

// MailerLite API client
const MAILERLITE_API_BASE = 'https://connect.mailerlite.com/api'

const mailerliteClient = axios.create({
  baseURL: MAILERLITE_API_BASE,
  headers: {
    'Authorization': `Bearer ${process.env.MAILERLITE_API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
})

/**
 * Subscribe email to email provider (MailerLite or SendGrid based on settings)
 * Used by website homepage subscribe form
 * Captures Facebook Pixel data for attribution tracking
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, facebook_pixel, name } = body

    if (!email || !email.includes('@')) {
      return NextResponse.json({
        error: 'Valid email address is required'
      }, { status: 400 })
    }

    // Get domain from headers (Next.js 15 requires await)
    const headersList = await headers()
    const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'aiaccountingdaily.com'

    // Get publication ID from domain
    const publicationId = await getPublicationByDomain(host) || 'accounting'

    // Get email provider settings (dynamic selection)
    const providerSettings = await getEmailProviderSettings(publicationId)
    console.log(`[Subscribe] Using email provider: ${providerSettings.provider}`)

    // Capture request metadata
    const userAgent = request.headers.get('user-agent') || null
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                      request.headers.get('x-real-ip') ||
                      null

    // Prepare custom fields data
    const customFields: Record<string, any> = {}

    // Add Facebook Pixel data as custom fields (if data exists)
    if (facebook_pixel) {
      if (facebook_pixel.fbp) customFields.fbp = facebook_pixel.fbp
      if (facebook_pixel.fbc) customFields.fbc = facebook_pixel.fbc
      if (facebook_pixel.timestamp) customFields.fb_pixel_timestamp = facebook_pixel.timestamp
      if (facebook_pixel.event_source_url) customFields.fb_pixel_event_source_url = facebook_pixel.event_source_url
    }
    if (userAgent) customFields.fb_pixel_user_agent = userAgent
    if (ipAddress) customFields.fb_pixel_ip = ipAddress

    if (facebook_pixel) {
      console.log('[Subscribe] Facebook Pixel data captured')
    }

    if (providerSettings.provider === 'sendgrid') {
      // Use SendGrid
      let listId = await getPublicationSetting(publicationId, 'sendgrid_signup_list_id')
      if (!listId) {
        listId = await getPublicationSetting(publicationId, 'sendgrid_main_list_id')
      }
      if (!listId) {
        console.error('[Subscribe] SendGrid list ID not configured')
        return NextResponse.json({
          error: 'Subscription service not configured'
        }, { status: 500 })
      }

      console.log(`[Subscribe] Adding ${email} to SendGrid list ${listId}`)

      const sendgridService = new SendGridService()
      const result = await sendgridService.upsertContact(email, {
        firstName: name || undefined,
        customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
        listIds: [listId]
      })

      if (!result.success) {
        console.error('[Subscribe] SendGrid upsert failed:', result.error)
        return NextResponse.json({
          error: 'Subscription failed',
          message: result.error || 'Unknown error'
        }, { status: 500 })
      }

      console.log(`[Subscribe] Successfully added ${email} to SendGrid list`)
    } else {
      // Use MailerLite (default)
      let groupId = await getPublicationSetting(publicationId, 'mailerlite_signup_group_id')
      if (!groupId) {
        groupId = providerSettings.mainGroupId
      }
      if (!groupId) {
        console.error('[Subscribe] MailerLite group ID not configured')
        return NextResponse.json({
          error: 'Subscription service not configured'
        }, { status: 500 })
      }

      console.log(`[Subscribe] Adding ${email} to MailerLite group ${groupId}`)

      // Prepare subscriber data for MailerLite
      const subscriberData: any = {
        email,
        groups: [groupId]
      }
      if (name) {
        subscriberData.fields = { name }
      }

      // Add custom fields if we have any (MailerLite uses fields object)
      if (Object.keys(customFields).length > 0) {
        subscriberData.fields = {
          ...(subscriberData.fields || {}),
          ...customFields
        }
      }

      try {
        const response = await mailerliteClient.post('/subscribers', subscriberData)

        if (response.status !== 200 && response.status !== 201) {
          console.error('[Subscribe] MailerLite API error:', response.status, response.data)
          return NextResponse.json({
            error: 'Subscription failed',
            message: 'Failed to add subscriber'
          }, { status: 500 })
        }

        console.log(`[Subscribe] Successfully added ${email} to MailerLite group`)
      } catch (mlError: any) {
        // MailerLite returns 422 for duplicate subscribers, which is OK
        if (mlError.response?.status === 422) {
          console.log(`[Subscribe] Subscriber ${email} already exists in MailerLite`)
        } else {
          console.error('[Subscribe] MailerLite API error:', mlError.response?.data || mlError.message)
          return NextResponse.json({
            error: 'Subscription failed',
            message: mlError.response?.data?.message || 'Failed to add subscriber'
          }, { status: 500 })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully subscribed!'
    })

  } catch (error: any) {
    console.error('[Subscribe] Subscription failed:', error)

    return NextResponse.json({
      error: 'Subscription failed',
      message: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
