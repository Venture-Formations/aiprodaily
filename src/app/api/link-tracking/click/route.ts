import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Ensures URL has a protocol, prepending https:// if missing
 */
function normalizeUrl(url: string): string {
  if (!url) return url
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  return `https://${url}`
}

/**
 * Determines if the click should trigger a MailerLite field update
 * Returns the field name to update, or null if no update needed
 */
function getMailerLiteFieldForSection(section: string): string | null {
  const sectionLower = section.toLowerCase()

  // Advertorial clicks -> clicked_ad field
  if (sectionLower === 'advertorial' || sectionLower.includes('sponsor')) {
    return 'clicked_ad'
  }

  // AI Apps clicks -> clicked_ai_app field
  if (sectionLower === 'ai apps' || sectionLower === 'ai applications') {
    return 'clicked_ai_app'
  }

  return null
}

/**
 * Queues a MailerLite field update for async processing
 */
async function queueMailerLiteFieldUpdate(
  email: string,
  fieldName: string,
  issueId: string | null,
  linkClickId: string | null,
  publicationId: string
): Promise<void> {
  try {
    // Check if we already have a pending/completed update for this subscriber+field
    // to avoid duplicate queue entries
    const { data: existing } = await supabaseAdmin
      .from('mailerlite_field_updates')
      .select('id, status')
      .eq('subscriber_email', email)
      .eq('field_name', fieldName)
      .in('status', ['pending', 'completed'])
      .limit(1)
      .maybeSingle()

    if (existing) {
      console.log(`[MailerLite Queue] Skipping duplicate: ${email} already has ${fieldName} update (${existing.status})`)
      return
    }

    // Insert new queue entry
    const { error } = await supabaseAdmin
      .from('mailerlite_field_updates')
      .insert({
        subscriber_email: email,
        field_name: fieldName,
        field_value: true,
        status: 'pending',
        publication_id: publicationId,
        issue_id: issueId,
        link_click_id: linkClickId
      })

    if (error) {
      console.error('[MailerLite Queue] Error queuing field update:', error)
    } else {
      console.log(`[MailerLite Queue] Queued ${fieldName}=true for ${email}`)
    }
  } catch (error) {
    console.error('[MailerLite Queue] Exception queuing field update:', error)
  }
}

/**
 * Link Click Tracking Endpoint
 * Tracks newsletter link clicks with comprehensive metadata
 *
 * Query Parameters:
 * - url: Destination URL (required)
 * - section: Newsletter section (required)
 * - date: issue date (required)
 * - issue_id: MailerLite issue ID (optional)
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
    const issueId = searchParams.get('issue_id')
    const email = searchParams.get('email')
    const subscriberId = searchParams.get('subscriber_id')

    // Validate required parameters
    if (!url || !section || !date || !email) {
      console.error('Link tracking missing parameters:', { url, section, date, email })
      // Still redirect to destination even if tracking fails
      if (url) {
        return NextResponse.redirect(normalizeUrl(url))
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
      return NextResponse.redirect(normalizeUrl(url))
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      console.error('Invalid date format:', date)
      return NextResponse.redirect(normalizeUrl(url))
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
      issueId,
      email,
      subscriberId,
      userAgent,
      ipAddress
    })

    // Insert click tracking record
    const { data, error } = await supabaseAdmin
      .from('link_clicks')
      .insert({
        issue_date: date,
        issue_id: issueId,
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
      return NextResponse.redirect(normalizeUrl(url))
    }

    console.log('Link click tracked successfully:', data.id)

    // Check if this click should queue a MailerLite field update
    const mailerliteField = getMailerLiteFieldForSection(section)
    if (mailerliteField && issueId) {
      // Look up publication_id from the issue
      const { data: issueData } = await supabaseAdmin
        .from('publication_issues')
        .select('publication_id')
        .eq('id', issueId)
        .single()

      if (issueData?.publication_id) {
        // Queue the field update asynchronously (don't await - fire and forget)
        queueMailerLiteFieldUpdate(
          email,
          mailerliteField,
          issueId,
          data.id,
          issueData.publication_id
        ).catch(err => console.error('[MailerLite Queue] Background error:', err))
      }
    }

    // Redirect to destination URL
    return NextResponse.redirect(normalizeUrl(url))

  } catch (error) {
    console.error('Link tracking error:', error)
    // Try to redirect to URL if available
    const url = new URL(request.url).searchParams.get('url')
    if (url) {
      return NextResponse.redirect(normalizeUrl(url))
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
