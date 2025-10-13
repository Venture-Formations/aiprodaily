import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Payment Verification Endpoint
 *
 * Called by the success page after Stripe redirects the user back.
 * This endpoint verifies that the payment was actually completed
 * and checks if the webhook has processed the events yet.
 *
 * Note: This is a backup verification method. The primary insertion
 * happens via the Stripe webhook handler at /api/webhooks/stripe
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const sessionId = searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.json({
      error: 'Missing session_id parameter'
    }, { status: 400 })
  }

  try {
    console.log(`[Verify Payment] Checking session: ${sessionId}`)

    // Check if we have a pending submission for this session
    const { data: pendingSubmission, error: pendingError } = await supabaseAdmin
      .from('pending_event_submissions')
      .select('*')
      .eq('stripe_session_id', sessionId)
      .single()

    if (pendingError || !pendingSubmission) {
      // No pending submission found - webhook may have already processed it
      // or the session ID is invalid
      console.log(`[Verify Payment] No pending submission found for session: ${sessionId}`)

      // Check if events with this payment_intent_id already exist
      const { data: existingEvents, error: eventsError } = await supabaseAdmin
        .from('events')
        .select('id, title, payment_status')
        .eq('payment_intent_id', sessionId)

      if (eventsError) {
        console.error('[Verify Payment] Error checking existing events:', eventsError)
      }

      if (existingEvents && existingEvents.length > 0) {
        // Events already created by webhook
        return NextResponse.json({
          success: true,
          status: 'processed',
          message: 'Payment verified and events created',
          events_count: existingEvents.length
        })
      }

      // No pending submission and no events - something went wrong
      return NextResponse.json({
        error: 'Payment session not found',
        message: 'This payment session does not exist or has expired. Please contact support if you were charged.'
      }, { status: 404 })
    }

    // Found pending submission - check if it's been processed
    if (pendingSubmission.processed) {
      console.log(`[Verify Payment] Session already processed at: ${pendingSubmission.processed_at}`)

      // Find the inserted events
      const { data: insertedEvents } = await supabaseAdmin
        .from('events')
        .select('id, title')
        .eq('payment_intent_id', sessionId)

      return NextResponse.json({
        success: true,
        status: 'processed',
        message: 'Payment verified and events created',
        events_count: insertedEvents?.length || 0,
        processed_at: pendingSubmission.processed_at
      })
    }

    // Pending submission exists but hasn't been processed yet
    // This means the webhook hasn't fired yet (can take a few seconds)
    console.log(`[Verify Payment] Session pending webhook processing: ${sessionId}`)

    return NextResponse.json({
      success: true,
      status: 'pending',
      message: 'Payment received, processing events...',
      events_count: pendingSubmission.events_data.length,
      note: 'Your events will be activated shortly. You will receive an email confirmation.'
    })

  } catch (error) {
    console.error('[Verify Payment] Error:', error)
    return NextResponse.json({
      error: 'Verification failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}
