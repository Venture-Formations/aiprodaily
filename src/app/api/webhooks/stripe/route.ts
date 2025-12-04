import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SlackNotificationService } from '@/lib/slack'

// Stripe webhook event types we handle
const CHECKOUT_SESSION_COMPLETED = 'checkout.session.completed'
const CUSTOMER_SUBSCRIPTION_DELETED = 'customer.subscription.deleted'
const CUSTOMER_SUBSCRIPTION_UPDATED = 'customer.subscription.updated'
const INVOICE_PAYMENT_FAILED = 'invoice.payment_failed'

/**
 * Stripe Webhook Handler
 *
 * This endpoint receives webhook events from Stripe to process payment confirmations.
 * When a checkout session completes successfully, we:
 * 1. Retrieve the pending event submission from our database
 * 2. Insert the events into the events table
 * 3. Send Slack notification to admin
 * 4. Mark the pending submission as processed
 *
 * Security: Stripe signs all webhooks with your webhook secret.
 * Verify the signature before processing any events.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('[Webhook] STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json({
      error: 'Webhook configuration error'
    }, { status: 500 })
  }

  if (!signature) {
    console.error('[Webhook] Missing stripe-signature header')
    return NextResponse.json({
      error: 'Missing signature'
    }, { status: 400 })
  }

  let event
  const rawBody = await request.text()

  try {
    // Verify webhook signature using raw body
    const crypto = require('crypto')
    const signatureHeader = signature

    // Parse signature header: "t=timestamp,v1=signature"
    const parts = signatureHeader.split(',')
    let timestamp = ''
    let providedSignature = ''

    for (const part of parts) {
      const [key, value] = part.split('=')
      if (key === 't') timestamp = value
      if (key === 'v1') providedSignature = value
    }

    if (!timestamp || !providedSignature) {
      console.error('[Webhook] Invalid signature format')
      return NextResponse.json({
        error: 'Invalid signature format'
      }, { status: 400 })
    }

    // Construct the signed payload
    const signedPayload = `${timestamp}.${rawBody}`

    // Create the expected signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(signedPayload, 'utf8')
      .digest('hex')

    // Compare signatures (timing-safe comparison)
    if (!crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(providedSignature)
    )) {
      console.error('[Webhook] Invalid signature')
      return NextResponse.json({
        error: 'Invalid signature'
      }, { status: 401 })
    }

    // Parse the event
    event = JSON.parse(rawBody)
    console.log(`[Webhook] Received event: ${event.type}`)

  } catch (err) {
    console.error('[Webhook] Signature verification failed:', err)
    return NextResponse.json({
      error: 'Signature verification failed',
      details: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 400 })
  }

  // Handle the event
  try {
    switch (event.type) {
      case CHECKOUT_SESSION_COMPLETED:
        await handleCheckoutSessionCompleted(event.data.object)
        break

      case CUSTOMER_SUBSCRIPTION_DELETED:
        await handleSubscriptionDeleted(event.data.object)
        break

      case CUSTOMER_SUBSCRIPTION_UPDATED:
        await handleSubscriptionUpdated(event.data.object)
        break

      case INVOICE_PAYMENT_FAILED:
        await handlePaymentFailed(event.data.object)
        break

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('[Webhook] Error processing event:', error)
    console.error('[Webhook] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('[Webhook] Error details:', JSON.stringify(error, null, 2))
    return NextResponse.json({
      error: 'Webhook processing failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      error_type: error instanceof Error ? error.name : typeof error
    }, { status: 500 })
  }
}

/**
 * Handle successful checkout session completion
 * Handles both event submissions and tools directory subscriptions
 */
async function handleCheckoutSessionCompleted(session: any) {
  const sessionId = session.id
  const subscriptionId = session.subscription
  const customerId = session.customer
  console.log(`[Webhook] Processing checkout session: ${sessionId}`)

  // Check if this is a tools directory subscription (has metadata with tool_id)
  if (session.metadata?.tool_id) {
    await handleToolsDirectoryCheckout(session)
    return
  }

  // Retrieve the pending submission
  const { data: pendingSubmission, error: fetchError } = await supabaseAdmin
    .from('pending_event_submissions')
    .select('*')
    .eq('stripe_session_id', sessionId)
    .eq('processed', false)
    .single()

  if (fetchError || !pendingSubmission) {
    console.error('[Webhook] Failed to find pending submission:', fetchError)
    throw new Error(`Pending submission not found for session: ${sessionId}`)
  }

  console.log(`[Webhook] Found pending submission with ${pendingSubmission.events_data.length} events`)

  const events = pendingSubmission.events_data
  const insertedEvents = []

  // Insert each event into the events table
  for (const event of events) {
    const paymentAmount = event.paid_placement ? 5.00 : event.featured ? 15.00 : 0

    // If this is a promotion of an existing event, mark the original as inactive
    if (event.existing_event_id) {
      console.log(`[Webhook] Marking original event ${event.existing_event_id} as inactive (being promoted)`)
      const { error: deactivateError } = await supabaseAdmin
        .from('events')
        .update({ active: false })
        .eq('id', event.existing_event_id)

      if (deactivateError) {
        console.error('[Webhook] Error deactivating original event:', deactivateError)
        // Don't throw - continue with creating the promoted event
      } else {
        console.log(`[Webhook] Successfully deactivated original event ${event.existing_event_id}`)
      }
    }

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
      console.error('[Webhook] Error inserting event:', insertError)
      throw insertError
    }

    insertedEvents.push(insertedEvent)
    console.log(`[Webhook] Inserted event: ${event.title}${event.existing_event_id ? ' (promoted from existing)' : ''}`)
  }

  // Send Slack notification
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
  console.log('[Webhook] Slack notification sent')

  // Mark the pending submission as processed
  const { error: updateError } = await supabaseAdmin
    .from('pending_event_submissions')
    .update({
      processed: true,
      processed_at: new Date().toISOString()
    })
    .eq('id', pendingSubmission.id)

  if (updateError) {
    console.error('[Webhook] Failed to mark submission as processed:', updateError)
    // Don't throw - events are already inserted
  }

  console.log(`[Webhook] Successfully processed ${insertedEvents.length} events`)
}

/**
 * Handle tools directory checkout session completion
 * Called when a user pays for a sponsored listing
 */
async function handleToolsDirectoryCheckout(session: any) {
  const toolId = session.metadata?.tool_id
  const plan = session.metadata?.plan || 'monthly'
  const subscriptionId = session.subscription
  const customerId = session.customer

  console.log(`[Webhook] Processing tools directory checkout for tool: ${toolId}`)

  if (!toolId) {
    console.error('[Webhook] Missing tool_id in session metadata')
    throw new Error('Missing tool_id in session metadata')
  }

  // Update the tool with subscription info
  const { error: updateError } = await supabaseAdmin
    .from('tools_directory')
    .update({
      is_sponsored: true,
      plan: plan,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
      stripe_payment_id: session.id,
      sponsor_start_date: new Date().toISOString()
    })
    .eq('id', toolId)

  if (updateError) {
    console.error('[Webhook] Failed to update tool after payment:', updateError)
    throw updateError
  }

  // Send Slack notification
  const { data: tool } = await supabaseAdmin
    .from('tools_directory')
    .select('tool_name, submitter_email')
    .eq('id', toolId)
    .single()

  if (tool) {
    const slack = new SlackNotificationService()
    const planLabel = plan === 'yearly' ? '$250/year' : '$30/month'
    await slack.sendSimpleMessage(
      `🛠️ New Sponsored Tool Listing!\n\n` +
      `Tool: ${tool.tool_name}\n` +
      `Plan: ${planLabel}\n` +
      `Email: ${tool.submitter_email}\n` +
      `Subscription ID: ${subscriptionId}`
    )
  }

  console.log(`[Webhook] Successfully activated sponsored listing for tool: ${toolId}`)
}

/**
 * Handle subscription cancellation or expiration
 * This is called when:
 * - Customer cancels their subscription
 * - Subscription expires after failed payment retries
 * - Subscription is deleted via Stripe dashboard
 */
async function handleSubscriptionDeleted(subscription: any) {
  const subscriptionId = subscription.id
  console.log(`[Webhook] Processing subscription deletion: ${subscriptionId}`)

  // Find the tool with this subscription
  const { data: tool, error: fetchError } = await supabaseAdmin
    .from('tools_directory')
    .select('id, tool_name, submitter_email')
    .eq('stripe_subscription_id', subscriptionId)
    .single()

  if (fetchError || !tool) {
    // No tool found - might be a different product subscription
    console.log(`[Webhook] No tools directory entry found for subscription: ${subscriptionId}`)
    return
  }

  // Remove sponsored status
  const { error: updateError } = await supabaseAdmin
    .from('tools_directory')
    .update({
      is_sponsored: false,
      sponsor_end_date: new Date().toISOString()
    })
    .eq('id', tool.id)

  if (updateError) {
    console.error('[Webhook] Failed to remove sponsored status:', updateError)
    throw updateError
  }

  // Send Slack notification
  const slack = new SlackNotificationService()
  await slack.sendSimpleMessage(
    `⚠️ Sponsored Listing Ended\n\n` +
    `Tool: ${tool.tool_name}\n` +
    `Email: ${tool.submitter_email}\n` +
    `Subscription: ${subscriptionId}\n\n` +
    `The listing has been moved to free tier.`
  )

  console.log(`[Webhook] Removed sponsored status for tool: ${tool.tool_name}`)
}

/**
 * Handle subscription updates
 * This is called when:
 * - Plan changes (upgrade/downgrade)
 * - Subscription renews successfully
 * - Payment method updates
 */
async function handleSubscriptionUpdated(subscription: any) {
  const subscriptionId = subscription.id
  const status = subscription.status
  console.log(`[Webhook] Processing subscription update: ${subscriptionId}, status: ${status}`)

  // Find the tool with this subscription
  const { data: tool, error: fetchError } = await supabaseAdmin
    .from('tools_directory')
    .select('id, tool_name')
    .eq('stripe_subscription_id', subscriptionId)
    .single()

  if (fetchError || !tool) {
    // No tool found - might be a different product subscription
    console.log(`[Webhook] No tools directory entry found for subscription: ${subscriptionId}`)
    return
  }

  // Handle based on subscription status
  if (status === 'active') {
    // Subscription is active - ensure tool is sponsored
    await supabaseAdmin
      .from('tools_directory')
      .update({ is_sponsored: true })
      .eq('id', tool.id)
    console.log(`[Webhook] Confirmed active subscription for tool: ${tool.tool_name}`)
  } else if (status === 'past_due' || status === 'unpaid') {
    // Payment issues - keep sponsored for now, Stripe will retry
    console.log(`[Webhook] Subscription ${subscriptionId} has status: ${status}, awaiting payment`)
  } else if (status === 'canceled' || status === 'incomplete_expired') {
    // Subscription ended - remove sponsored status
    await supabaseAdmin
      .from('tools_directory')
      .update({
        is_sponsored: false,
        sponsor_end_date: new Date().toISOString()
      })
      .eq('id', tool.id)
    console.log(`[Webhook] Removed sponsored status for tool: ${tool.tool_name} (status: ${status})`)
  }
}

/**
 * Handle failed invoice payment
 * Stripe will retry payments automatically, but we log this for visibility
 */
async function handlePaymentFailed(invoice: any) {
  const subscriptionId = invoice.subscription
  const customerEmail = invoice.customer_email
  console.log(`[Webhook] Payment failed for subscription: ${subscriptionId}`)

  if (!subscriptionId) {
    console.log('[Webhook] No subscription ID in failed invoice, skipping')
    return
  }

  // Find the tool with this subscription
  const { data: tool } = await supabaseAdmin
    .from('tools_directory')
    .select('id, tool_name, submitter_email')
    .eq('stripe_subscription_id', subscriptionId)
    .single()

  if (tool) {
    // Send Slack notification about payment issue
    const slack = new SlackNotificationService()
    await slack.sendSimpleMessage(
      `⚠️ Payment Failed - Sponsored Listing\n\n` +
      `Tool: ${tool.tool_name}\n` +
      `Email: ${tool.submitter_email || customerEmail}\n` +
      `Subscription: ${subscriptionId}\n\n` +
      `Stripe will retry the payment automatically.`
    )
    console.log(`[Webhook] Notified about payment failure for: ${tool.tool_name}`)
  }
}
