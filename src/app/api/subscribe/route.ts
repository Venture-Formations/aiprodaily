import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import axios from 'axios'
import { headers } from 'next/headers'
import { getPublicationByDomain, getPublicationSetting } from '@/lib/publication-settings'

const MAILERLITE_API_BASE = 'https://connect.mailerlite.com/api'

/**
 * Subscribe email to MailerLite and add to group
 * Used by website homepage subscribe form
 * Captures Facebook Pixel data for attribution tracking
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, facebook_pixel } = body

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

    // Get MailerLite Group ID from publication_settings
    const groupId = await getPublicationSetting(publicationId, 'mailerlite_group_id')

    if (!groupId) {
      console.error('MailerLite Group ID not configured for publication:', publicationId)
      return NextResponse.json({
        error: 'Subscription service not configured'
      }, { status: 500 })
    }

    // Capture request metadata
    const userAgent = request.headers.get('user-agent') || null
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                      request.headers.get('x-real-ip') ||
                      null

    // Prepare Facebook Pixel data
    const fbData = {
      timestamp: facebook_pixel?.timestamp || new Date().toISOString(),
      fbp: facebook_pixel?.fbp || null,
      fbc: facebook_pixel?.fbc || null,
      user_agent: userAgent,
      ip: ipAddress,
      event_source_url: facebook_pixel?.event_source_url || request.url
    }

    // MailerLite API client
    const mailerliteClient = axios.create({
      baseURL: MAILERLITE_API_BASE,
      headers: {
        'Authorization': `Bearer ${process.env.MAILERLITE_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })

    console.log(`Subscribing ${email} to MailerLite group ${groupId}`)
    if (facebook_pixel) {
      console.log('Facebook Pixel data:', fbData)
    }

    // Prepare subscriber data with Facebook Pixel fields
    const subscriberData: any = {
      email: email,
      groups: [groupId],
      status: 'active',
      fields: {}
    }

    // Add Facebook Pixel data as custom fields (only if data exists)
    // Note: You'll need to create these custom fields in MailerLite first
    if (fbData.fbp) subscriberData.fields.fb_pixel_fbp = fbData.fbp
    if (fbData.fbc) subscriberData.fields.fb_pixel_fbc = fbData.fbc
    if (fbData.timestamp) subscriberData.fields.fb_pixel_timestamp = fbData.timestamp
    if (fbData.user_agent) subscriberData.fields.fb_pixel_user_agent = fbData.user_agent
    if (fbData.ip) subscriberData.fields.fb_pixel_ip = fbData.ip
    if (fbData.event_source_url) subscriberData.fields.fb_pixel_event_source_url = fbData.event_source_url

    // Try to add/update subscriber and add to group in one request
    try {
      const response = await mailerliteClient.post('/subscribers', subscriberData)

      console.log('MailerLite API response:', {
        status: response.status,
        data: response.data
      })

      return NextResponse.json({
        success: true,
        message: 'Successfully subscribed!'
      })

    } catch (apiError: any) {
      // Check if subscriber already exists
      if (apiError.response?.status === 422 || apiError.response?.data?.message?.includes('already exists')) {
        console.log(`Subscriber ${email} already exists, adding to group and updating fields...`)

        // Search for subscriber by email
        const searchResponse = await mailerliteClient.get(`/subscribers`, {
          params: { 'filter[email]': email }
        })

        if (searchResponse.data?.data && searchResponse.data.data.length > 0) {
          const subscriberId = searchResponse.data.data[0].id

          // Add subscriber to group
          await mailerliteClient.post(`/subscribers/${subscriberId}/groups/${groupId}`)

          // Update Facebook Pixel fields if provided
          if (Object.keys(subscriberData.fields).length > 0) {
            try {
              await mailerliteClient.put(`/subscribers/${subscriberId}`, {
                fields: subscriberData.fields
              })
              console.log('Updated Facebook Pixel fields for existing subscriber')
            } catch (fieldError) {
              console.error('Error updating Facebook Pixel fields:', fieldError)
              // Don't fail the subscription if field update fails
            }
          }

          console.log(`Added existing subscriber ${email} to group ${groupId}`)

          return NextResponse.json({
            success: true,
            message: 'Successfully subscribed!'
          })
        } else {
          throw new Error('Subscriber not found after creation error')
        }
      } else {
        // Re-throw other errors
        throw apiError
      }
    }

  } catch (error: any) {
    console.error('Subscription failed:', error)

    // Log detailed error info
    if (error.response) {
      console.error('MailerLite API error:', {
        status: error.response.status,
        data: error.response.data
      })
    }

    return NextResponse.json({
      error: 'Subscription failed',
      message: error.response?.data?.message || error.message || 'Unknown error'
    }, { status: 500 })
  }
}
