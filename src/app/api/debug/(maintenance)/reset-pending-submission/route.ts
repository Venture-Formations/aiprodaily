import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Reset a pending submission to allow reprocessing
 * Usage: /api/debug/reset-pending-submission?session_id=cs_test_...
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.json({
      error: 'Please provide ?session_id=cs_test_...'
    }, { status: 400 })
  }

  try {
    // Reset the pending submission to unprocessed
    const { data, error } = await supabaseAdmin
      .from('pending_event_submissions')
      .update({
        processed: false,
        processed_at: null
      })
      .eq('stripe_session_id', sessionId)
      .select()

    if (error) {
      return NextResponse.json({
        error: 'Failed to reset submission',
        details: error.message
      }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        error: 'No pending submission found for this session ID'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Pending submission reset to unprocessed',
      session_id: sessionId,
      next_step: `Now visit: /api/debug/process-webhook-manually?session_id=${sessionId}`
    })

  } catch (error) {
    console.error('Reset pending submission error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
