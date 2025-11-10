import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SlackNotificationService } from '@/lib/slack'

/**
 * Manually process a pending submission (for debugging webhook issues)
 * Usage: /api/debug/process-webhook-manually?session_id=cs_test_...
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
    console.log(`[Manual Webhook] Processing session: ${sessionId}`)

    // Retrieve the pending submission
    const { data: pendingSubmission, error: fetchError } = await supabaseAdmin
      .from('pending_event_submissions')
      .select('*')
      .eq('stripe_session_id', sessionId)
      .eq('processed', false)
      .single()

    if (fetchError || !pendingSubmission) {
      console.error('[Manual Webhook] Failed to find pending submission:', fetchError)
      return NextResponse.json({
        error: 'Pending submission not found or already processed',
        details: fetchError?.message
      }, { status: 404 })
    }

    console.log(`[Manual Webhook] Found pending submission with ${pendingSubmission.events_data.length} events`)

    const events = pendingSubmission.events_data
    const insertedEvents = []
    const errors = []

    // Insert each event into the events table
    for (let i = 0; i < events.length; i++) {
      const event = events[i]

      try {
        const paymentAmount = event.paid_placement ? 5.00 : event.featured ? 15.00 : 0

        console.log(`[Manual Webhook] Processing event ${i + 1}/${events.length}: ${event.title}`)

        // Fix malformed timestamps (remove extra :00 at the end)
        const fixTimestamp = (timestamp: string) => {
          if (!timestamp) return timestamp
          // Fix format like "2025-10-08T15:15:00:00" to "2025-10-08T15:15:00"
          return timestamp.replace(/T(\d{2}:\d{2}:\d{2}):\d{2}$/, 'T$1')
        }

        const { data: insertedEvent, error: insertError } = await supabaseAdmin
          .from('events')
          .insert({
            external_id: `submitted_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: event.title,
            description: event.description,
            start_date: fixTimestamp(event.start_date),
            end_date: fixTimestamp(event.end_date),
            venue: event.venue,
            address: event.address,
            url: event.url,
            image_url: event.cropped_image_url || event.image_url,
            original_image_url: event.original_image_url,
            cropped_image_url: event.cropped_image_url,
            submitter_name: event.submitter_name || pendingSubmission.submitter_name,
            submitter_email: event.submitter_email || pendingSubmission.submitter_email,
            submitter_phone: event.submitter_phone,
            submission_status: 'pending',
            paid_placement: event.paid_placement || false,
            featured: event.featured || false,
            active: true,
            payment_status: 'completed',
            payment_intent_id: sessionId,
            payment_amount: paymentAmount,
            raw_data: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (insertError) {
          console.error(`[Manual Webhook] Error inserting event ${i + 1}:`, insertError)
          errors.push({
            event_title: event.title,
            error: insertError.message,
            details: insertError
          })
        } else {
          insertedEvents.push(insertedEvent)
          console.log(`[Manual Webhook] ✓ Inserted event: ${event.title}`)
        }
      } catch (eventError) {
        console.error(`[Manual Webhook] Exception inserting event ${i + 1}:`, eventError)
        errors.push({
          event_title: event.title,
          error: eventError instanceof Error ? eventError.message : 'Unknown error',
          stack: eventError instanceof Error ? eventError.stack : undefined
        })
      }
    }

    // Send Slack notification
    let slackSuccess = false
    let slackError = null

    try {
      const totalAmount = pendingSubmission.total_amount
      const eventTitles = events.map((e: any) => e.title).join('\n  • ')

      const slack = new SlackNotificationService()
      const message = [
        `🎉 New Paid Event Submission${events.length > 1 ? 's' : ''}!`,
        ``,
        `Submitted by: ${pendingSubmission.submitter_name}`,
        `Email: ${pendingSubmission.submitter_email}`,
        ``,
        `💰 Payment Confirmed: $${totalAmount.toFixed(2)}`,
        `Payment ID: ${sessionId}`,
        ``,
        `Event${events.length > 1 ? 's' : ''} (${events.length}):`,
        `  • ${eventTitles}`,
        ``,
        `Review: ${process.env.NEXT_PUBLIC_URL || 'https://st-cloud-scoop.vercel.app'}/dashboard/events/review`
      ].join('\n')

      await slack.sendSimpleMessage(message)
      console.log('[Manual Webhook] Slack notification sent')
      slackSuccess = true
    } catch (slackErr) {
      console.error('[Manual Webhook] Slack notification failed:', slackErr)
      slackError = slackErr instanceof Error ? slackErr.message : 'Unknown slack error'
    }

    // Mark the pending submission as processed
    const { error: updateError } = await supabaseAdmin
      .from('pending_event_submissions')
      .update({
        processed: true,
        processed_at: new Date().toISOString()
      })
      .eq('id', pendingSubmission.id)

    if (updateError) {
      console.error('[Manual Webhook] Failed to mark submission as processed:', updateError)
    }

    return NextResponse.json({
      success: true,
      session_id: sessionId,
      events_processed: insertedEvents.length,
      events_failed: errors.length,
      inserted_events: insertedEvents.map(e => ({
        id: e.id,
        title: e.title,
        featured: e.featured,
        paid_placement: e.paid_placement
      })),
      errors: errors,
      slack_notification_sent: slackSuccess,
      slack_error: slackError,
      pending_submission_marked_processed: !updateError,
      message: errors.length > 0
        ? `Processed ${insertedEvents.length} events successfully, ${errors.length} failed`
        : `Successfully processed all ${insertedEvents.length} events`
    })

  } catch (error) {
    console.error('[Manual Webhook] Fatal error:', error)
    return NextResponse.json({
      success: false,
      error: 'Processing failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error_type: error instanceof Error ? error.name : typeof error
    }, { status: 500 })
  }
}
