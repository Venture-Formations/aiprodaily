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
 * Valid link types that trigger field updates
 */
type LinkType = 'ad' | 'ai_app'

/**
 * Determines if the click should trigger an email provider field update
 * Returns the field name to update, or null if no update needed
 *
 * @param section - The newsletter section name (for legacy pattern matching)
 * @param linkType - Optional explicit link type from URL parameter
 */
function getFieldForClick(section: string, linkType?: string): string | null {
  // If explicit link type is provided, use it directly
  if (linkType === 'ad') {
    return 'clicked_ad'
  }
  if (linkType === 'ai_app') {
    return 'clicked_ai_app'
  }

  // Fall back to section name pattern matching for legacy links
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
 * Queues an email provider field update for async processing
 * Includes retry logic for transient network failures
 */
async function queueFieldUpdate(
  email: string,
  fieldName: string,
  issueId: string | null,
  linkClickId: string | null,
  publicationId: string
): Promise<void> {
  const maxRetries = 2
  const retryDelay = 500 // ms

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check if we already have a pending/completed update for this subscriber+field
      // to avoid duplicate queue entries
      const { data: existing, error: checkError } = await supabaseAdmin
        .from('sendgrid_field_updates')
        .select('id, status')
        .eq('subscriber_email', email)
        .eq('field_name', fieldName)
        .in('status', ['pending', 'completed'])
        .limit(1)
        .maybeSingle()

      // Handle transient fetch errors with retry
      if (checkError && checkError.message?.includes('fetch failed')) {
        if (attempt < maxRetries) {
          console.log(`[Field Update Queue] Fetch failed on check (attempt ${attempt}/${maxRetries}), retrying...`)
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt))
          continue
        }
        console.error(`[Field Update Queue] Fetch failed after ${maxRetries} attempts:`, checkError.message)
        return
      }

      if (existing) {
        console.log(`[Field Update Queue] Skipping duplicate: ${email} already has ${fieldName} update (${existing.status})`)
        return
      }

      // Insert new queue entry
      const { error } = await supabaseAdmin
        .from('sendgrid_field_updates')
        .insert({
          subscriber_email: email,
          field_name: fieldName,
          field_value: true,
          status: 'pending',
          publication_id: publicationId,
          issue_id: issueId,
          link_click_id: linkClickId
        })

      // Handle transient fetch errors with retry
      if (error && error.message?.includes('fetch failed')) {
        if (attempt < maxRetries) {
          console.log(`[Field Update Queue] Fetch failed on insert (attempt ${attempt}/${maxRetries}), retrying...`)
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt))
          continue
        }
        console.error(`[Field Update Queue] Fetch failed after ${maxRetries} attempts:`, error.message)
        return
      }

      if (error) {
        console.error('[Field Update Queue] Error queuing field update:', error)
      } else {
        console.log(`[Field Update Queue] Queued ${fieldName}=true for ${email}`)
      }
      return // Success or non-retryable error, exit loop

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Retry on transient fetch errors
      if (errorMessage.includes('fetch failed') && attempt < maxRetries) {
        console.log(`[Field Update Queue] Exception fetch failed (attempt ${attempt}/${maxRetries}), retrying...`)
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt))
        continue
      }

      console.error('[Field Update Queue] Exception queuing field update:', error)
      return
    }
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
 * - issue_id: Database issue ID (optional)
 * - email: Subscriber email (required)
 * - subscriber_id: Subscriber ID (optional)
 * - type: Link type for field updates ('ad' | 'ai_app') (optional)
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
    const linkType = searchParams.get('type') // 'ad' or 'ai_app' for field updates

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

    // Check if this click should queue an email provider field update
    const fieldToUpdate = getFieldForClick(section, linkType || undefined)
    if (fieldToUpdate && issueId) {
      // Look up publication_id from the issue
      const { data: issueData } = await supabaseAdmin
        .from('publication_issues')
        .select('publication_id')
        .eq('id', issueId)
        .single()

      if (issueData?.publication_id) {
        // Queue the field update asynchronously (don't await - fire and forget)
        queueFieldUpdate(
          email,
          fieldToUpdate,
          issueId,
          data.id,
          issueData.publication_id
        ).catch(err => console.error('[Field Update Queue] Background error:', err))
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
