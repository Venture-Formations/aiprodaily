import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/polls/[id]/responses - Get responses for a poll with analytics
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get all responses for this poll
    const { data: responses, error } = await supabaseAdmin
      .from('poll_responses')
      .select('*')
      .eq('poll_id', id)
      .order('responded_at', { ascending: false })

    if (error) {
      console.error('Error fetching poll responses:', error)
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
    console.error('Error in GET /api/polls/[id]/responses:', error)
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
    const { subscriber_email, selected_option, campaign_id } = body

    if (!subscriber_email || !selected_option) {
      return NextResponse.json(
        { error: 'Missing required fields: subscriber_email, selected_option' },
        { status: 400 }
      )
    }

    // Use upsert to handle duplicate responses (update instead of error)
    const { data: response, error } = await supabaseAdmin
      .from('poll_responses')
      .upsert({
        poll_id: id,
        subscriber_email,
        selected_option,
        campaign_id: campaign_id || null
      }, {
        onConflict: 'poll_id,subscriber_email'
      })
      .select()
      .single()

    if (error) {
      console.error('Error recording poll response:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // TODO: Sync to MailerLite - count unique polls this subscriber has responded to
    // and update their "Poll Responses" field
    // This will be implemented in the MailerLite sync task

    return NextResponse.json({ response }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/polls/[id]/responses:', error)
    return NextResponse.json(
      { error: 'Failed to record poll response' },
      { status: 500 }
    )
  }
}
