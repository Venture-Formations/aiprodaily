import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SlackNotificationService } from '@/lib/slack'

/**
 * Manually process a pending submission
 * This bypasses webhook signature verification to test the processing logic
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const sessionId = searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.json({
      error: 'Missing session_id parameter',
      usage: '/api/debug/manual-process-webhook?session_id=cs_test_...'
    }, { status: 400 })
  }

  try {
    console.log(`[Manual Process] Processing session: ${sessionId}`)

    // Retrieve the pending submission
    const { data: pendingSubmission, error: fetchError } = await supabaseAdmin
      .from('pending_event_submissions')
      .select('*')
      .eq('stripe_session_id', sessionId)
      .eq('processed', false)
      .single()

    if (fetchError || !pendingSubmission) {
      return NextResponse.json({
        error: 'Pending submission not found',
        details: fetchError?.message || 'No unprocessed submission found for this session',
        session_id: sessionId
      }, { status: 404 })
    }

    console.log(`[Manual Process] Found pending submission with ${pendingSubmission.events_data.length} events`)

    const events = pendingSubmission.events_data
    const insertedEvents = []

    // Insert each event into the events table
    for (const event of events) {
      const paymentAmount = event.paid_placement ? 5.00 : event.featured ? 15.00 : 0

      console.log(`[Manual Process] Inserting event: ${event.title}`)

      const { data: insertedEvent, error: insertError } = await supabaseAdmin
        .from('events')
        .insert({
          external_id: `submitted_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: event.title,
          description: event.description,
          start_date: event.start_date,
          end_date: event.end_date,
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
        console.error('[Manual Process] Error inserting event:', insertError)
        return NextResponse.json({
          error: 'Failed to insert event',
          details: insertError.message,
          event_title: event.title
        }, { status: 500 })
      }

      insertedEvents.push(insertedEvent)
      console.log(`[Manual Process] Inserted event: ${event.title}`)
    }

    // Send Slack notification
    const totalAmount = pendingSubmission.total_amount
    const eventTitles = events.map((e: any) => e.title).join('\n  • ')

    const slack = new SlackNotificationService()
    const message = [
      `🎉 New Paid Event Submission${events.length > 1 ? 's' : ''}! (Manual Processing)`,
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

    try {
      await slack.sendSimpleMessage(message)
      console.log('[Manual Process] Slack notification sent')
    } catch (slackError) {
      console.error('[Manual Process] Slack notification failed:', slackError)
      // Don't fail the whole process if Slack fails
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
      console.error('[Manual Process] Failed to mark submission as processed:', updateError)
      // Don't throw - events are already inserted
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${insertedEvents.length} events`,
      events: insertedEvents.map(e => ({ id: e.id, title: e.title })),
      slack_sent: true
    })

  } catch (error) {
    console.error('[Manual Process] Error:', error)
    return NextResponse.json({
      error: 'Processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
