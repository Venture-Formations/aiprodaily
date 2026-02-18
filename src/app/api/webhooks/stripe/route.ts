import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SlackNotificationService } from '@/lib/slack'
import { PUBLICATION_ID } from '@/lib/config'

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

  // Check if this is an ai_applications upgrade (has source: ai_applications in metadata)
  if (session.metadata?.source === 'ai_applications' || session.metadata?.listing_type) {
    await handleAIApplicationsCheckout(session)
    return
  }

  // Check if this is a legacy tools directory subscription (has metadata with tool_id but no source)
  if (session.metadata?.tool_id && !session.metadata?.listing_type) {
    await handleToolsDirectoryCheckout(session)
    return
  }

  // Otherwise, handle as event submission
  await handleEventSubmissionCheckout(session, sessionId)
}

/**
 * Handle AI Applications checkout (new system)
 * Updates ai_applications table with is_featured, listing_type, etc.
 */
async function handleAIApplicationsCheckout(session: any) {
  const toolId = session.metadata?.tool_id
  const listingType = session.metadata?.listing_type || 'paid_placement'
  const billingPeriod = session.metadata?.billing_period || 'monthly'
  const subscriptionId = session.subscription
  const customerId = session.customer

  console.log(`[Webhook] Processing AI applications checkout for tool: ${toolId}, type: ${listingType}`)

  if (!toolId) {
    console.error('[Webhook] Missing tool_id in session metadata')
    throw new Error('Missing tool_id in session metadata')
  }

  // Calculate sponsor dates
  const sponsorStartDate = new Date()
  const sponsorEndDate = new Date(sponsorStartDate)
  if (billingPeriod === 'yearly') {
    sponsorEndDate.setFullYear(sponsorEndDate.getFullYear() + 1)
  } else {
    sponsorEndDate.setMonth(sponsorEndDate.getMonth() + 1)
  }

  // Update the tool with subscription info
  const { error: updateError } = await supabaseAdmin
    .from('ai_applications')
    .update({
      is_paid_placement: listingType === 'paid_placement',
      is_featured: listingType === 'featured',
      listing_type: listingType,
      billing_period: billingPeriod,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
      stripe_payment_id: session.id,
      sponsor_start_date: sponsorStartDate.toISOString(),
      sponsor_end_date: sponsorEndDate.toISOString()
    })
    .eq('id', toolId)
    .eq('publication_id', PUBLICATION_ID)

  if (updateError) {
    console.error('[Webhook] Failed to update ai_applications after payment:', updateError)
    throw updateError
  }

  // Send Slack notification
  const { data: tool } = await supabaseAdmin
    .from('ai_applications')
    .select('app_name, submitter_email, category')
    .eq('id', toolId)
    .single()

  if (tool) {
    const slack = new SlackNotificationService()
    const listingLabel = listingType === 'featured' ? 'Featured' : 'Paid Placement'
    const periodLabel = billingPeriod === 'yearly' ? 'yearly' : 'monthly'
    await slack.sendSimpleMessage(
      `🛠️ New ${listingLabel} Tool Listing!\n\n` +
      `Tool: ${tool.app_name}\n` +
      `Category: ${tool.category}\n` +
      `Plan: ${listingLabel} (${periodLabel})\n` +
      `Email: ${tool.submitter_email}\n` +
      `Subscription ID: ${subscriptionId}`
    )
  }

  console.log(`[Webhook] Successfully activated ${listingType} listing for tool: ${toolId}`)
}

/**
 * Handle legacy tools directory checkout session completion
 * Called when a user pays for a sponsored listing (old system)
 */
async function handleToolsDirectoryCheckout(session: any) {
  const toolId = session.metadata?.tool_id
  const plan = session.metadata?.plan || 'monthly'
  const subscriptionId = session.subscription
  const customerId = session.customer

  console.log(`[Webhook] Processing legacy tools directory checkout for tool: ${toolId}`)

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
      `🛠️ New Sponsored Tool Listing (Legacy)!\n\n` +
      `Tool: ${tool.tool_name}\n` +
      `Plan: ${planLabel}\n` +
      `Email: ${tool.submitter_email}\n` +
      `Subscription ID: ${subscriptionId}`
    )
  }

  console.log(`[Webhook] Successfully activated sponsored listing for tool: ${toolId}`)
}

/**
 * Handle event submission checkout
 */
async function handleEventSubmissionCheckout(session: any, sessionId: string) {
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
      } else {
        console.log(`[Webhook] Successfully deactivated original event ${event.existing_event_id}`)
      }
    }

    // Fix malformed timestamps (remove extra :00 at the end)
    const fixTimestamp = (timestamp: string) => {
      if (!timestamp) return timestamp
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
  }

  console.log(`[Webhook] Successfully processed ${insertedEvents.length} events`)
}

/**
 * Handle subscription cancellation or expiration
 */
async function handleSubscriptionDeleted(subscription: any) {
  const subscriptionId = subscription.id
  console.log(`[Webhook] Processing subscription deletion: ${subscriptionId}`)

  // First, try to find in ai_applications (new system)
  const { data: aiApp } = await supabaseAdmin
    .from('ai_applications')
    .select('id, app_name, submitter_email')
    .eq('stripe_subscription_id', subscriptionId)
    .single()

  if (aiApp) {
    // Remove featured/paid status
    const { error: updateError } = await supabaseAdmin
      .from('ai_applications')
      .update({
        is_featured: false,
        is_paid_placement: false,
        listing_type: 'free',
        sponsor_end_date: new Date().toISOString()
      })
      .eq('id', aiApp.id)

    if (updateError) {
      console.error('[Webhook] Failed to remove paid status from ai_applications:', updateError)
      throw updateError
    }

    const slack = new SlackNotificationService()
    await slack.sendSimpleMessage(
      `⚠️ Tool Listing Downgraded\n\n` +
      `Tool: ${aiApp.app_name}\n` +
      `Email: ${aiApp.submitter_email}\n` +
      `Subscription: ${subscriptionId}\n\n` +
      `The listing has been moved to free tier.`
    )

    console.log(`[Webhook] Removed paid status for ai_application: ${aiApp.app_name}`)
    return
  }

  // Fallback: Try legacy tools_directory
  const { data: tool } = await supabaseAdmin
    .from('tools_directory')
    .select('id, tool_name, submitter_email')
    .eq('stripe_subscription_id', subscriptionId)
    .single()

  if (tool) {
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

    const slack = new SlackNotificationService()
    await slack.sendSimpleMessage(
      `⚠️ Sponsored Listing Ended (Legacy)\n\n` +
      `Tool: ${tool.tool_name}\n` +
      `Email: ${tool.submitter_email}\n` +
      `Subscription: ${subscriptionId}\n\n` +
      `The listing has been moved to free tier.`
    )

    console.log(`[Webhook] Removed sponsored status for tool: ${tool.tool_name}`)
    return
  }

  console.log(`[Webhook] No tool found for subscription: ${subscriptionId}`)
}

/**
 * Handle subscription updates
 */
async function handleSubscriptionUpdated(subscription: any) {
  const subscriptionId = subscription.id
  const status = subscription.status
  console.log(`[Webhook] Processing subscription update: ${subscriptionId}, status: ${status}`)

  // First, try to find in ai_applications (new system)
  const { data: aiApp } = await supabaseAdmin
    .from('ai_applications')
    .select('id, app_name, listing_type')
    .eq('stripe_subscription_id', subscriptionId)
    .single()

  if (aiApp) {
    if (status === 'active') {
      // Ensure tool has correct paid status
      console.log(`[Webhook] Confirmed active subscription for ai_application: ${aiApp.app_name}`)
    } else if (status === 'past_due' || status === 'unpaid') {
      console.log(`[Webhook] Subscription ${subscriptionId} has status: ${status}, awaiting payment`)
    } else if (status === 'canceled' || status === 'incomplete_expired') {
      await supabaseAdmin
        .from('ai_applications')
        .update({
          is_featured: false,
          is_paid_placement: false,
          listing_type: 'free',
          sponsor_end_date: new Date().toISOString()
        })
        .eq('id', aiApp.id)
      console.log(`[Webhook] Removed paid status for ai_application: ${aiApp.app_name} (status: ${status})`)
    }
    return
  }

  // Fallback: Try legacy tools_directory
  const { data: tool } = await supabaseAdmin
    .from('tools_directory')
    .select('id, tool_name')
    .eq('stripe_subscription_id', subscriptionId)
    .single()

  if (tool) {
    if (status === 'active') {
      await supabaseAdmin
        .from('tools_directory')
        .update({ is_sponsored: true })
        .eq('id', tool.id)
      console.log(`[Webhook] Confirmed active subscription for tool: ${tool.tool_name}`)
    } else if (status === 'past_due' || status === 'unpaid') {
      console.log(`[Webhook] Subscription ${subscriptionId} has status: ${status}, awaiting payment`)
    } else if (status === 'canceled' || status === 'incomplete_expired') {
      await supabaseAdmin
        .from('tools_directory')
        .update({
          is_sponsored: false,
          sponsor_end_date: new Date().toISOString()
        })
        .eq('id', tool.id)
      console.log(`[Webhook] Removed sponsored status for tool: ${tool.tool_name} (status: ${status})`)
    }
    return
  }

  console.log(`[Webhook] No tool found for subscription: ${subscriptionId}`)
}

/**
 * Handle failed invoice payment
 */
async function handlePaymentFailed(invoice: any) {
  const subscriptionId = invoice.subscription
  const customerEmail = invoice.customer_email
  console.log(`[Webhook] Payment failed for subscription: ${subscriptionId}`)

  if (!subscriptionId) {
    console.log('[Webhook] No subscription ID in failed invoice, skipping')
    return
  }

  // First, try to find in ai_applications (new system)
  const { data: aiApp } = await supabaseAdmin
    .from('ai_applications')
    .select('id, app_name, submitter_email')
    .eq('stripe_subscription_id', subscriptionId)
    .single()

  if (aiApp) {
    const slack = new SlackNotificationService()
    await slack.sendSimpleMessage(
      `⚠️ Payment Failed - Tool Listing\n\n` +
      `Tool: ${aiApp.app_name}\n` +
      `Email: ${aiApp.submitter_email || customerEmail}\n` +
      `Subscription: ${subscriptionId}\n\n` +
      `Stripe will retry the payment automatically.`
    )
    console.log(`[Webhook] Notified about payment failure for: ${aiApp.app_name}`)
    return
  }

  // Fallback: Try legacy tools_directory
  const { data: tool } = await supabaseAdmin
    .from('tools_directory')
    .select('id, tool_name, submitter_email')
    .eq('stripe_subscription_id', subscriptionId)
    .single()

  if (tool) {
    const slack = new SlackNotificationService()
    await slack.sendSimpleMessage(
      `⚠️ Payment Failed - Sponsored Listing (Legacy)\n\n` +
      `Tool: ${tool.tool_name}\n` +
      `Email: ${tool.submitter_email || customerEmail}\n` +
      `Subscription: ${subscriptionId}\n\n` +
      `Stripe will retry the payment automatically.`
    )
    console.log(`[Webhook] Notified about payment failure for: ${tool.tool_name}`)
  }
}
