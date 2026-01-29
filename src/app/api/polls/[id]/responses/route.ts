import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/polls/[id]/responses - Get responses for a poll with analytics
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const publicationId = searchParams.get('publication_id')

    if (!publicationId) {
      return NextResponse.json(
        { error: 'publication_id is required' },
        { status: 400 }
      )
    }

    // Verify poll belongs to this publication
    const { data: poll, error: pollError } = await supabaseAdmin
      .from('polls')
      .select('id')
      .eq('id', id)
      .eq('publication_id', publicationId)
      .single()

    if (pollError || !poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
    }

    // Get all responses for this poll
    const { data: responses, error } = await supabaseAdmin
      .from('poll_responses')
      .select('id, poll_id, publication_id, issue_id, subscriber_email, selected_option, responded_at, ip_address')
      .eq('poll_id', id)
      .eq('publication_id', publicationId)
      .order('responded_at', { ascending: false })

    if (error) {
      console.error('[Polls] Error fetching poll responses:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Calculate analytics
    const totalResponses = responses?.length || 0
    const uniqueRespondents = new Set(responses?.map(r => r.subscriber_email) || []).size

    // Count responses by option
    const optionCounts: Record<string, number> = {}
    responses?.forEach(response => {
      const option = response.selected_option
      optionCounts[option] = (optionCounts[option] || 0) + 1
    })

    return NextResponse.json({
      responses,
      analytics: {
        total_responses: totalResponses,
        unique_respondents: uniqueRespondents,
        option_counts: optionCounts
      }
    })
  } catch (error) {
    console.error('[Polls] Error in GET /api/polls/[id]/responses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch poll responses' },
      { status: 500 }
    )
  }
}

// POST /api/polls/[id]/responses - Record a poll response
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { subscriber_email, selected_option, issue_id } = body

    if (!subscriber_email || !selected_option) {
      return NextResponse.json(
        { error: 'Missing required fields: subscriber_email, selected_option' },
        { status: 400 }
      )
    }

    // Get the poll to determine publication_id and validate option
    const { data: poll, error: pollError } = await supabaseAdmin
      .from('polls')
      .select('id, publication_id, options')
      .eq('id', id)
      .single()

    if (pollError || !poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
    }

    // Validate that the selected option exists in the poll
    if (!poll.options.includes(selected_option)) {
      return NextResponse.json(
        { error: 'Invalid option selected' },
        { status: 400 }
      )
    }

    // Get IP address from request headers
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : request.headers.get('x-real-ip')

    // Use upsert to handle duplicate responses (update instead of error)
    // With issue-level uniqueness: same poll + same issue = overwrite, different issues = separate responses
    // onConflict depends on whether issue_id is provided (partial unique indexes)
    const conflictColumns = issue_id
      ? 'poll_id,subscriber_email,issue_id'  // For responses with issue_id
      : 'poll_id,subscriber_email'           // For responses without issue_id (legacy)

    const { data: response, error } = await supabaseAdmin
      .from('poll_responses')
      .upsert({
        poll_id: id,
        publication_id: poll.publication_id,
        subscriber_email,
        selected_option,
        issue_id: issue_id || null,
        ip_address: ipAddress || null
      }, {
        onConflict: conflictColumns
      })
      .select('id, poll_id, publication_id, issue_id, subscriber_email, selected_option, responded_at, ip_address')
      .single()

    if (error) {
      console.error('[Polls] Error recording poll response:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[Polls] Recorded response from ${subscriber_email} for poll ${id}`)
    return NextResponse.json({ response }, { status: 201 })
  } catch (error) {
    console.error('[Polls] Error in POST /api/polls/[id]/responses:', error)
    return NextResponse.json(
      { error: 'Failed to record poll response' },
      { status: 500 }
    )
  }
}
