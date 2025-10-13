import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Link Click Tracking Endpoint
 * Tracks newsletter link clicks with comprehensive metadata
 *
 * Query Parameters:
 * - url: Destination URL (required)
 * - section: Newsletter section (required)
 * - date: Campaign date (required)
 * - campaign_id: MailerLite campaign ID (optional)
 * - email: Subscriber email from MailerLite (required)
 * - subscriber_id: MailerLite subscriber ID (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Extract parameters
    const url = searchParams.get('url')
    const section = searchParams.get('section')
    const date = searchParams.get('date')
    const campaignId = searchParams.get('campaign_id')
    const email = searchParams.get('email')
    const subscriberId = searchParams.get('subscriber_id')

    // Validate required parameters
    if (!url || !section || !date || !email) {
      console.error('Link tracking missing parameters:', { url, section, date, email })
      // Still redirect to destination even if tracking fails
      if (url) {
        return NextResponse.redirect(url)
      }
      return NextResponse.json(
        { error: 'Missing required parameters: url, section, date, email' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      console.error('Invalid email format:', email)
      return NextResponse.redirect(url)
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      console.error('Invalid date format:', date)
      return NextResponse.redirect(url)
    }

    // Extract request metadata
    const userAgent = request.headers.get('user-agent') || null
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                      request.headers.get('x-real-ip') ||
                      null

    console.log('Tracking link click:', {
      url,
      section,
      date,
      campaignId,
      email,
      subscriberId,
      userAgent,
      ipAddress
    })

    // Insert click tracking record
    const { data, error } = await supabaseAdmin
      .from('link_clicks')
      .insert({
        campaign_date: date,
        campaign_id: campaignId,
        subscriber_email: email,
        subscriber_id: subscriberId,
        link_url: url,
        link_section: section,
        user_agent: userAgent,
        ip_address: ipAddress
      })
      .select()
      .single()

    if (error) {
      console.error('Error tracking link click:', error)
      // Still redirect even if tracking fails
      return NextResponse.redirect(url)
    }

    console.log('Link click tracked successfully:', data.id)

    // Redirect to destination URL
    return NextResponse.redirect(url)

  } catch (error) {
    console.error('Link tracking error:', error)
    // Try to redirect to URL if available
    const url = new URL(request.url).searchParams.get('url')
    if (url) {
      return NextResponse.redirect(url)
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
