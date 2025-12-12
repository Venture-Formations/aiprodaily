import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPublicationByDomain, getPublicationSetting } from '@/lib/publication-settings'
import { SendGridService } from '@/lib/sendgrid'

/**
 * Subscribe email to SendGrid and add to list
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

    // Get SendGrid List ID from publication_settings
    // Falls back to MailerLite group ID for backwards compatibility
    let listId = await getPublicationSetting(publicationId, 'sendgrid_signup_list_id')
    if (!listId) {
      listId = await getPublicationSetting(publicationId, 'sendgrid_main_list_id')
    }
    if (!listId) {
      // Fallback check for MailerLite settings (to help with migration debugging)
      const mlGroupId = await getPublicationSetting(publicationId, 'mailerlite_group_id')
      if (mlGroupId) {
        console.error('[Subscribe] Found MailerLite group ID but no SendGrid list ID. Migration incomplete.')
      }
      return NextResponse.json({
        error: 'Subscription service not configured'
      }, { status: 500 })
    }

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

    console.log(`[Subscribe] Adding ${email} to SendGrid list ${listId}`)
    if (facebook_pixel) {
      console.log('[Subscribe] Facebook Pixel data captured')
    }

    // Use SendGrid service to upsert contact
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
