import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/check-pending-submissions' },
  async ({ request, logger }) => {
    // Check all pending submissions
    const { data: allSubmissions, error: allError } = await supabaseAdmin
      .from('pending_event_submissions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    // Check processed submissions
    const { data: processed, error: processedError } = await supabaseAdmin
      .from('pending_event_submissions')
      .select('*')
      .eq('processed', true)
      .order('processed_at', { ascending: false })
      .limit(10)

    // Check events with payment info
    const { data: paidEvents, error: eventsError } = await supabaseAdmin
      .from('events')
      .select('id, title, payment_status, payment_intent_id, submitter_email, created_at')
      .not('payment_intent_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      pending_submissions: {
        count: allSubmissions?.length || 0,
        data: allSubmissions,
        error: allError?.message || null
      },
      processed_submissions: {
        count: processed?.length || 0,
        data: processed,
        error: processedError?.message || null
      },
      paid_events: {
        count: paidEvents?.length || 0,
        data: paidEvents,
        error: eventsError?.message || null
      }
    })
  }
)
