import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SendGridService } from '@/lib/sendgrid'

// GET /api/polls/[id]/respond - Handle poll response from email link
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const option = searchParams.get('option')
    const email = searchParams.get('email')
    const issueId = searchParams.get('issue_id')

    if (!option || !email) {
      return NextResponse.redirect(
        new URL('/poll/error?message=Missing required parameters', request.url)
      )
    }

    // Get IP address from request headers
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : request.headers.get('x-real-ip')

    // Get the poll to determine publication_id and validate option
    const { data: poll, error: pollError } = await supabaseAdmin
      .from('polls')
      .select('id, publication_id, options')
      .eq('id', id)
      .single()

    if (pollError || !poll) {
      console.error('[Polls] Poll not found:', id)
      return NextResponse.redirect(
        new URL('/poll/error?message=Poll not found', request.url)
      )
    }

    // Validate that the selected option exists in the poll
    if (!poll.options.includes(option)) {
      console.error('[Polls] Invalid option selected:', option)
      return NextResponse.redirect(
        new URL('/poll/error?message=Invalid option selected', request.url)
      )
    }

    // Record the poll response (upsert to handle duplicate responses)
    // With issue-level uniqueness: same poll + same issue = overwrite, different issues = separate responses
    // onConflict depends on whether issue_id is provided (partial unique indexes)
    const conflictColumns = issueId
      ? 'poll_id,subscriber_email,issue_id'  // For responses with issue_id
      : 'poll_id,subscriber_email'           // For responses without issue_id (legacy)

    const { error: responseError } = await supabaseAdmin
      .from('poll_responses')
      .upsert({
        poll_id: id,
        publication_id: poll.publication_id,
        subscriber_email: email,
        selected_option: option,
        issue_id: issueId || null,
        ip_address: ipAddress || null
      }, {
        onConflict: conflictColumns
      })

    if (responseError) {
      console.error('[Polls] Error recording poll response:', responseError)
      return NextResponse.redirect(
        new URL('/poll/error?message=Failed to record response', request.url)
      )
    }

    // Get count of unique polls this subscriber has responded to (for this publication)
    const { data: uniquePolls, error: countError } = await supabaseAdmin
      .from('poll_responses')
      .select('poll_id')
      .eq('subscriber_email', email)
      .eq('publication_id', poll.publication_id)

    if (countError) {
      console.error('[Polls] Error counting unique polls:', countError)
    }

    const uniquePollCount = uniquePolls ? new Set(uniquePolls.map(r => r.poll_id)).size : 0

    // Sync to SendGrid - update subscriber's "poll_responses" custom field with uniquePollCount
    try {
      const sendgrid = new SendGridService()
      const syncResult = await sendgrid.updateContactFields(
        email,
        { poll_responses: uniquePollCount }
      )

      if (syncResult.success) {
        console.log(`[Polls] Synced poll count to SendGrid for ${email}: ${uniquePollCount} polls`)
      } else {
        console.error(`[Polls] Failed to sync to SendGrid:`, syncResult.error)
        // Don't fail the whole request if SendGrid sync fails
      }
    } catch (sendgridError) {
      console.error('[Polls] Error syncing to SendGrid:', sendgridError)
      // Don't fail the whole request if SendGrid sync fails
    }

    console.log(`[Polls] Response recorded: ${email} voted "${option}" on poll ${id} from IP ${ipAddress || 'unknown'}`)

    // Redirect to thank you page
    return NextResponse.redirect(
      new URL('/poll/thank-you', request.url)
    )
  } catch (error) {
    console.error('[Polls] Error in GET /api/polls/[id]/respond:', error)
    return NextResponse.redirect(
      new URL('/poll/error?message=An unexpected error occurred', request.url)
    )
  }
}
