import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(maintenance)/fix-oct-8-featured' },
  async ({ logger }) => {
  try {
    const issueId = '90d64237-fd7e-4dd8-a17a-342ad86a83db'

    console.log('Fixing featured events for Oct 8 issue:', issueId)

    // Step 1: Get the correct active featured events for Oct 9
    const { data: correctEvents, error: eventsError } = await supabaseAdmin
      .from('events')
      .select('*')
      .gte('start_date', '2025-10-09')
      .lte('start_date', '2025-10-09T23:59:59')
      .eq('active', true)
      .eq('featured', true)

    if (eventsError || !correctEvents) {
      return NextResponse.json({
        error: 'Failed to fetch correct events',
        details: eventsError
      }, { status: 500 })
    }

    console.log(`Found ${correctEvents.length} active featured events for Oct 9:`,
      correctEvents.map(e => ({ id: e.id, title: e.title })))

    // Step 2: Update issue_events to mark these as featured
    const results = []
    for (const event of correctEvents) {
      const { data, error } = await supabaseAdmin
        .from('issue_events')
        .update({ is_featured: true })
        .eq('issue_id', issueId)
        .eq('event_id', event.id)
        .eq('event_date', '2025-10-09')
        .select()

      if (error) {
        results.push({
          event_id: event.id,
          title: event.title,
          success: false,
          error: error.message
        })
      } else {
        results.push({
          event_id: event.id,
          title: event.title,
          success: true,
          updated: data?.length || 0
        })
      }
    }

    // Step 3: Remove inactive/duplicate issue_events for Oct 9
    const { data: inactiveEvents, error: inactiveError } = await supabaseAdmin
      .from('issue_events')
      .select('*, event:events(*)')
      .eq('issue_id', issueId)
      .eq('event_date', '2025-10-09')

    if (inactiveError) {
      return NextResponse.json({
        error: 'Failed to fetch issue events',
        details: inactiveError
      }, { status: 500 })
    }

    // Find issue_events pointing to inactive events
    const toRemove = inactiveEvents?.filter(ce => ce.event?.active === false) || []

    const removalResults = []
    for (const ce of toRemove) {
      const { error: deleteError } = await supabaseAdmin
        .from('issue_events')
        .delete()
        .eq('id', ce.id)

      removalResults.push({
        issue_event_id: ce.id,
        event_title: ce.event?.title,
        event_id: ce.event_id,
        removed: !deleteError,
        error: deleteError?.message
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Fixed featured events for Oct 8 issue',
      featuredUpdates: results,
      inactiveRemoved: removalResults,
      summary: {
        featured_updated: results.filter(r => r.success).length,
        inactive_removed: removalResults.filter(r => r.removed).length
      }
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Unexpected error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
  }
)
